// Publishes one listing event to the agent's connected social platforms.
// Idempotent: one event row per (listing, client_request_id); retries reuse the
// same event id and referenceKey so bundle.social deduplicates. A bundle.social
// failure never alters listing data — this function only reads listings.
import { z } from 'npm:zod@3'
import {
  authenticateGated,
  buildCaption,
  bundleFetch,
  canActOnListing,
  corsHeaders,
  enforceCaptionLimit,
  getConnectedPlatforms,
  heroPhotoUrl,
  json,
  ListingForPost,
  PLATFORMS,
  providerErrorDetail,
  publicListingUrl,
  serviceClient,
  SOCIAL_EXCLUDED_STATUSES,
} from '../_shared/bundleSocial.ts'

const BodySchema = z.object({
  listingId: z.string().uuid(),
  eventType: z.string().min(1).max(50),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(4),
  caption: z.string().max(5000).optional(),
  clientRequestId: z.string().min(8).max(128),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateGated(req)
  if (!auth) return json({ error: 'Not authorized for social publishing' }, 403)

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400)
  }
  const { listingId, eventType, platforms, caption, clientRequestId } = parsed.data

  const svc = serviceClient()

  // Re-read the listing (read-only — social can never alter listing data).
  const { data: listing, error: listingError } = await svc
    .from('listings')
    .select('id, agent_id, status, address, city, state, price, bedrooms, bathrooms, description, photos')
    .eq('id', listingId)
    .maybeSingle()
  if (listingError || !listing) return json({ error: 'Listing not found' }, 404)

  const allowed = await canActOnListing(svc, auth.userId, auth.admin, listing.agent_id)
  if (!allowed) return json({ error: 'You do not own this listing' }, 403)

  if (SOCIAL_EXCLUDED_STATUSES.includes(listing.status)) {
    return json({ error: 'This listing status is not eligible for social publishing', status: listing.status }, 409)
  }

  // The agent must have a Bundle team with actually connected accounts.
  const { data: account } = await svc
    .from('agent_social_accounts')
    .select('bundle_team_id')
    .eq('agent_id', auth.userId)
    .maybeSingle()
  if (!account) return json({ error: 'No social accounts connected' }, 409)

  const connected = await getConnectedPlatforms(account.bundle_team_id)
  const requested = [...new Set(platforms)]
  const targets = requested.filter((p) => connected.has(p))
  const notConnected = requested.filter((p) => !connected.has(p))
  if (targets.length === 0) {
    return json({ error: 'None of the selected platforms are connected', notConnected }, 409)
  }

  // Hero photo: image-required platforms (Instagram) are skipped with a reason
  // when the listing has no photo; text/link platforms continue.
  const imageUrl = heroPhotoUrl(listing.photos)
  const skipped: { platform: string; reason: string }[] = notConnected.map((p) => ({
    platform: p,
    reason: 'not_connected',
  }))
  const finalTargets = targets.filter((p) => {
    if (p === 'INSTAGRAM' && !imageUrl) {
      skipped.push({ platform: p, reason: 'image_required' })
      return false
    }
    return true
  })
  if (finalTargets.length === 0) {
    return json({ error: 'No platform can receive this post', skipped }, 409)
  }

  // Idempotent event: reuse the existing row for this save attempt, else create.
  let eventId: string
  const { data: existingEvent } = await svc
    .from('listing_social_events')
    .select('id, status')
    .eq('listing_id', listingId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle()

  if (existingEvent) {
    eventId = existingEvent.id
    if (existingEvent.status === 'published') {
      return json({ eventId, status: 'published', posted: [], skipped, duplicate: true })
    }
  } else {
    const { data: inserted, error: insertError } = await svc
      .from('listing_social_events')
      .insert({
        listing_id: listingId,
        agent_id: auth.userId,
        event_type: eventType,
        platforms: finalTargets,
        caption: caption ?? null,
        image_url: imageUrl,
        reference_key: `pending:${crypto.randomUUID()}`,
        status: 'queued',
        client_request_id: clientRequestId,
      })
      .select('id')
      .single()
    if (insertError || !inserted) {
      return json({ error: 'Could not create social event' }, 500)
    }
    eventId = inserted.id
  }

  const referenceKey = `aac-social:${eventId}`

  // Upload the hero photo once, reuse for every platform.
  let uploadId: string | null = null
  if (imageUrl) {
    const uploadRes = await bundleFetch('/api/v1/upload/from-url', {
      method: 'POST',
      body: JSON.stringify({ teamId: account.bundle_team_id, url: imageUrl }),
    })
    if (uploadRes.ok) {
      const upload = await uploadRes.json().catch(() => null)
      uploadId = upload?.id ?? null
    }
  }

  const data: Record<string, unknown> = {}
  for (const platform of finalTargets) {
    const text = enforceCaptionLimit(platform, buildCaption(eventType, listing as ListingForPost, caption))
    const base: Record<string, unknown> = { text }
    if (uploadId) base.uploadIds = [uploadId]
    if (platform === 'FACEBOOK' || platform === 'LINKEDIN') {
      base.link = publicListingUrl(listingId)
    }
    data[platform] = base
  }

  const postRes = await bundleFetch('/api/v1/post/', {
    method: 'POST',
    body: JSON.stringify({
      teamId: account.bundle_team_id,
      title: `AAC ${eventType} ${listing.address ?? listingId}`,
      referenceKey,
      socialAccountTypes: finalTargets,
      data,
    }),
  })

  if (!postRes.ok) {
    const detail = await providerErrorDetail(postRes)
    await svc
      .from('listing_social_events')
      .update({
        status: 'failed',
        failure_detail: detail,
        reference_key: referenceKey,
        bundle_upload_id: uploadId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
    return json({ eventId, status: 'failed', error: 'Social publishing failed', detail, skipped }, 502)
  }

  const post = await postRes.json().catch(() => null)
  await svc
    .from('listing_social_events')
    .update({
      status: 'published',
      reference_key: referenceKey,
      bundle_upload_id: uploadId,
      bundle_post_id: post?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  return json({ eventId, status: 'published', posted: finalTargets, skipped })
})
