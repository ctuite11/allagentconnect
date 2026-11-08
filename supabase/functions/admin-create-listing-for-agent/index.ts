/**
 * Admin concierge: create a DRAFT listing owned by an existing AAC member.
 *
 * No impersonation, no agent session, no auth/credential data is read or
 * returned. The listing is owned by the member (`agent_id`); the acting admin
 * is recorded internally via created_by_user_id / creation_source.
 *
 * Draft only — this function cannot create a live listing, so it can never
 * generate listing alerts, Hot Sheet events or emails.
 */
import {
  assertEligibleAgent,
  CONCIERGE_CREATE_FUNCTION,
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
      agent_id?: string
      listing?: Record<string, unknown>
      request_id?: string
    }

    if (!isUuid(body.agent_id)) {
      return jsonResponse({ error: 'agent_id (uuid) is required' }, 400)
    }

    const ineligible = await assertEligibleAgent(service, body.agent_id)
    if (ineligible) return ineligible

    const payload = sanitizeListingPayload(body.listing)

    const insertRow = {
      ...payload,
      agent_id: body.agent_id,
      status: 'draft',
      address: (payload.address as string | undefined)?.trim() || 'Draft',
      city: (payload.city as string | undefined) || 'TBD',
      state: (payload.state as string | undefined) || 'MA',
      zip_code: (payload.zip_code as string | undefined) || '00000',
      price: typeof payload.price === 'number' ? payload.price : 0,
      created_by_user_id: adminId,
      creation_source: CONCIERGE_SOURCE,
      created_via_function: CONCIERGE_CREATE_FUNCTION,
      creation_request_id: typeof body.request_id === 'string' ? body.request_id : null,
    }

    const { data, error } = await service
      .from('listings')
      .insert(insertRow)
      .select('id, agent_id, status, created_by_user_id, creation_source, created_at')
      .single()

    if (error) {
      console.error('[admin-create-listing-for-agent] insert failed', error)
      return jsonResponse({ error: error.message, details: error.details ?? null }, 400)
    }

    console.log('[admin-create-listing-for-agent] draft created', {
      listing_id: data.id,
      agent_id: data.agent_id,
      admin_id: adminId,
    })

    return jsonResponse({ listing: data })
  } catch (err) {
    console.error('[admin-create-listing-for-agent] unexpected error', err)
    return jsonResponse({ error: (err as Error).message ?? 'Unexpected error' }, 500)
  }
})
