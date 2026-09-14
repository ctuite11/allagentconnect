// @auth-classification: admin-jwt
//
// Admin -> "Send to Agent for Review".
//
// Sends the concierge listing review email for a concierge DRAFT that AAC staff
// prepared on behalf of a verified member. This is the ONLY action in the
// concierge flow that produces an email — creating and editing the draft stays
// completely silent.
//
// Rules enforced here:
//  - caller must be an authenticated admin
//  - listing must exist, be a concierge draft (creation_source = 'admin_concierge')
//    and still be in status 'draft'
//  - target must be a VERIFIED member; activation state only decides which
//    existing 30-day AAC token flow is used:
//        not activated -> activation/setup token -> /activate#t=...
//        activated     -> login token            -> /signin-link#t=...
//  - the plaintext token is never persisted; the queue worker re-derives it at
//    send time (same contract as the activation and sign-in link emails)
//  - nothing here publishes anything; the buttons are navigation only
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  CONCIERGE_SOURCE,
  getAgentEligibility,
  isUuid,
  jsonResponse,
  requireAdmin,
  corsHeaders,
} from '../_shared/conciergeListing.ts'
import {
  ACTIVATION_TOKEN_TTL_DAYS,
  sha256Hex,
  signActivationToken,
} from '../_shared/activationTokens.ts'
import {
  LOGIN_TOKEN_TTL_DAYS,
  sha256Hex as sha256HexLogin,
  signLoginToken,
} from '../_shared/loginTokens.ts'
import { CONCIERGE_REVIEW_TEMPLATE } from '../_shared/hydrateConciergeReviewEmail.ts'

function expiryFromNow(days: number): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000 + days * 24 * 60 * 60 * 1000)
}

const ISSUANCE_REASONS: Record<string, string> = {
  ineligible: 'This member is not eligible for an account access link right now.',
  blocked: 'A link for this member is being redeemed right now. Try again in a few minutes.',
  no_recipient: 'This member has no valid email address on file.',
  deduped: 'A link was just generated for this member. Try again in a minute.',
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof Response) return ctx
    const { adminId, service } = ctx

    const secret = Deno.env.get('ACTIVATION_TOKEN_SECRET')
    if (!secret) return jsonResponse({ error: 'Server misconfigured' }, 500)

    const body = (await req.json().catch(() => ({}))) as { listing_id?: string }
    if (!isUuid(body.listing_id)) return jsonResponse({ error: 'Invalid listing_id' }, 400)

    // ── Listing must be a concierge draft ───────────────────────────────────
    const { data: listing, error: listingErr } = await service
      .from('listings')
      .select('id, agent_id, status, address, city, creation_source')
      .eq('id', body.listing_id)
      .maybeSingle()

    if (listingErr) return jsonResponse({ error: 'Failed to load listing' }, 500)
    if (!listing || listing.creation_source !== CONCIERGE_SOURCE || listing.status !== 'draft') {
      return jsonResponse({ error: 'Not a concierge draft listing' }, 403)
    }

    // ── Target member must be verified (activated or not) ───────────────────
    const eligibility = await getAgentEligibility(service, listing.agent_id as string)
    if (eligibility instanceof Response) return eligibility

    const { data: profile, error: profileErr } = await service
      .from('agent_profiles')
      .select('email, first_name')
      .eq('id', listing.agent_id)
      .maybeSingle()

    if (profileErr) return jsonResponse({ error: 'Failed to load member contact' }, 500)
    const recipient = (profile?.email ?? '').trim().toLowerCase()
    if (!recipient || !recipient.includes('@')) {
      return jsonResponse({ error: 'This member has no valid email address on file.' }, 422)
    }

    // ── Issue the matching 30-day AAC token, silently (no email_jobs row) ───
    const tokenId = crypto.randomUUID()
    const tokenKind: 'activation' | 'login' = eligibility.isActivated ? 'login' : 'activation'
    const expiresAt = expiryFromNow(
      tokenKind === 'activation' ? ACTIVATION_TOKEN_TTL_DAYS : LOGIN_TOKEN_TTL_DAYS,
    )

    let issuance: unknown
    if (tokenKind === 'activation') {
      const plaintext = await signActivationToken(secret, {
        id: tokenId,
        userId: listing.agent_id as string,
        expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
      })
      const { data, error } = await service.rpc('issue_agent_activation_token_no_email', {
        p_id: tokenId,
        p_user_id: listing.agent_id,
        p_token_hash: await sha256Hex(plaintext),
        p_expires_at: expiresAt.toISOString(),
        p_allow_previously_deleted: false,
      })
      if (error) {
        console.error('[send-concierge-review-email] activation issuance failed:', error.message)
        return jsonResponse({ error: 'Failed to prepare the review link' }, 500)
      }
      issuance = data
    } else {
      const plaintext = await signLoginToken(secret, {
        id: tokenId,
        userId: listing.agent_id as string,
        expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
      })
      const { data, error } = await service.rpc('issue_agent_login_token_no_email', {
        p_id: tokenId,
        p_user_id: listing.agent_id,
        p_token_hash: await sha256HexLogin(plaintext),
        p_expires_at: expiresAt.toISOString(),
      })
      if (error) {
        console.error('[send-concierge-review-email] login issuance failed:', error.message)
        return jsonResponse({ error: 'Failed to prepare the review link' }, 500)
      }
      issuance = data
    }

    const status = (issuance as { status?: string } | null)?.status ?? 'unknown'
    if (status !== 'created') {
      return jsonResponse(
        { status, error: ISSUANCE_REASONS[status] ?? `Could not prepare the review link (${status}).` },
        422,
      )
    }

    // ── Enqueue the review email (body is rendered at send time) ────────────
    const subject = 'Your listing is ready to review on All Agent Connect'
    const { error: jobErr } = await service.from('email_jobs').insert({
      payload: {
        provider: 'resend',
        template: CONCIERGE_REVIEW_TEMPLATE,
        to: recipient,
        subject,
        reply_to: 'hello@allagentconnect.com',
        listing_id: listing.id,
        agent_name: profile?.first_name ?? null,
        access_token_id: tokenId,
        access_token_kind: tokenKind,
        idempotency_key: `${CONCIERGE_REVIEW_TEMPLATE}/${tokenId}`,
      },
    })

    if (jobErr) {
      console.error('[send-concierge-review-email] enqueue failed:', jobErr.message)
      return jsonResponse({ error: 'Failed to queue the review email' }, 500)
    }

    // ── Internal audit trail (never public) ─────────────────────────────────
    await service.from('listing_audit_events').insert({
      listing_id: listing.id,
      listing_agent_id: listing.agent_id,
      acting_user_id: adminId,
      event_type: 'concierge_review_email_sent',
      creation_source: CONCIERGE_SOURCE,
      created_via_function: 'send-concierge-review-email',
      listing_status: listing.status,
      address: listing.address,
      details: {
        recipient_email: recipient,
        token_kind: tokenKind,
        expires_at: expiresAt.toISOString(),
      },
    })

    return jsonResponse({
      sent: true,
      email: recipient,
      tokenType: tokenKind,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('[send-concierge-review-email] error:', (err as Error).message)
    return jsonResponse({ error: 'Unexpected error' }, 500)
  }
})
