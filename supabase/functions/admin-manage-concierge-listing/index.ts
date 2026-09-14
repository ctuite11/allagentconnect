/**
 * Admin concierge: securely LOAD, UPDATE and LIST admin-created DRAFT listings.
 *
 * Admins cannot read another member's draft through normal listing access, and
 * that access is deliberately NOT broadened. This narrowly gated server-side
 * action is the only path, and it is restricted to rows that are both
 * `status = 'draft'` and `creation_source = 'admin_concierge'`.
 *
 * Draft only: the update action never changes status, agent_id or the audit
 * fields, so it can never publish a listing or trigger any alert/email.
 */
import {
  CONCIERGE_SOURCE,
  corsHeaders,
  isUuid,
  jsonResponse,
  requireAdmin,
  sanitizeListingPayload,
} from '../_shared/conciergeListing.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof Response) return ctx
    const { adminId, service } = ctx

    const body = await req.json().catch(() => ({})) as {
      action?: string
      listing_id?: string
      listing?: Record<string, unknown>
    }

    const action = body.action ?? 'load'

    if (action === 'list') {
      const { data, error } = await service
        .from('listings')
        .select('id, agent_id, address, city, state, zip_code, price, status, created_at, updated_at, created_by_user_id')
        .eq('creation_source', CONCIERGE_SOURCE)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(200)

      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ listings: data ?? [] })
    }

    if (!isUuid(body.listing_id)) {
      return jsonResponse({ error: 'listing_id (uuid) is required' }, 400)
    }

    // Gate: only admin-created drafts are reachable through this function.
    const { data: existing, error: loadError } = await service
      .from('listings')
      .select('*')
      .eq('id', body.listing_id)
      .maybeSingle()

    if (loadError) return jsonResponse({ error: loadError.message }, 400)
    if (!existing) return jsonResponse({ error: 'Listing not found' }, 404)
    if (existing.creation_source !== CONCIERGE_SOURCE || existing.status !== 'draft') {
      return jsonResponse(
        { error: 'Only admin-created draft listings can be managed here' },
        403,
      )
    }

    if (action === 'load') {
      return jsonResponse({ listing: existing })
    }

    if (action === 'update') {
      const payload = sanitizeListingPayload(body.listing)
      if (Object.keys(payload).length === 0) {
        return jsonResponse({ error: 'No updatable fields supplied' }, 400)
      }

      const { data, error } = await service
        .from('listings')
        .update({ ...payload, status: 'draft' })
        .eq('id', body.listing_id)
        .eq('status', 'draft')
        .eq('creation_source', CONCIERGE_SOURCE)
        .select('id, agent_id, status, updated_at')
        .maybeSingle()

      if (error) {
        console.error('[admin-manage-concierge-listing] update failed', error)
        return jsonResponse({ error: error.message, details: error.details ?? null }, 400)
      }
      if (!data) return jsonResponse({ error: 'Draft update was blocked or not found' }, 404)

      console.log('[admin-manage-concierge-listing] draft updated', {
        listing_id: data.id,
        agent_id: data.agent_id,
        admin_id: adminId,
      })
      return jsonResponse({ listing: data })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('[admin-manage-concierge-listing] unexpected error', err)
    return jsonResponse({ error: (err as Error).message ?? 'Unexpected error' }, 500)
  }
})
