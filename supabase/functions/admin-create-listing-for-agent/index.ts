/**
 * Admin concierge: create a DRAFT listing owned by an existing AAC member.
 *
 * Request-backed draft creation reads property facts from the private intake
 * itself, never from client-supplied listing overrides. Repeated clicks return
 * the same draft. Creation stays silent: no publish, alerts or network email.
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

type ListingIntake = {
  id: string
  agent_id: string
  status: string
  request_type: string
  property_address: string | null
  property_type: string | null
  asking_price: number | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  lot_acres: number | null
}

/** Only split addresses that include a recognizable state + 5-digit ZIP. */
function parseAddress(raw: string): {
  address: string
  city: string
  state: string
  zip_code: string
} {
  const text = raw.trim()
  const sections = text.split(',').map((s) => s.trim()).filter(Boolean)
  if (sections.length >= 3) {
    const tail = sections[sections.length - 1]
    const match = /^([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/.exec(tail)
    if (match && /^[A-Za-z]{2}$/.test(match[1])) {
      return {
        address: sections.slice(0, -2).join(', '),
        city: sections[sections.length - 2],
        state: match[1].toUpperCase(),
        zip_code: match[2],
      }
    }
  }
  // This is still a private draft: never guess a missing location.
  // Existing concierge drafts use these placeholders pending staff review.
  return { address: text, city: 'TBD', state: 'MA', zip_code: '00000' }
}

function dataFromIntake(request: ListingIntake): Record<string, unknown> {
  const address = request.property_address?.trim()
  if (!address || !request.property_type || !request.asking_price) {
    throw new Error('Incomplete concierge property request')
  }
  const location = parseAddress(address)
  return {
    ...location,
    listing_type: 'for_sale',
    property_type: request.property_type,
    price: Number(request.asking_price),
    bedrooms: request.bedrooms,
    bathrooms: request.bathrooms,
    square_feet: request.square_feet,
    // AddListing stores lot_size in acres.
    lot_size: request.property_type === 'single_family' ? request.lot_acres : null,
    // Deliberately do NOT copy staff instructions into public description.
    // All photo originals stay in the PRIVATE intake until transfer is reviewed.
    photos: [],
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

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

    let payload: Record<string, unknown>
    let requestId: string | null = null

    if (body.request_id !== undefined && body.request_id !== null) {
      if (!isUuid(body.request_id)) return jsonResponse({ error: 'Invalid request_id' }, 400)
      requestId = body.request_id

      // Existing linked drafts must be returned rather than duplicated.
      // Disallow creating another draft when an earlier draft was published.
      const { data: linked, error: linkedErr } = await service.from('listings')
        .select('id, agent_id, status, creation_source')
        .eq('creation_request_id', requestId)
        .eq('creation_source', CONCIERGE_SOURCE)
        .maybeSingle()
      if (linkedErr) return jsonResponse({ error: 'Unable to check existing draft' }, 500)
      if (linked) {
        if (linked.agent_id !== body.agent_id) return jsonResponse({ error: 'Request owner mismatch' }, 403)
        if (linked.status !== 'draft') {
          return jsonResponse({ error: 'This request has already been prepared and is no longer a draft', listing_id: linked.id }, 409)
        }
        return jsonResponse({ listing: linked, existing: true })
      }

      const { data: intake, error: intakeErr } = await service
        .from('agent_concierge_requests')
        .select('id, agent_id, status, request_type, property_address, property_type, asking_price, bedrooms, bathrooms, square_feet, lot_acres')
        .eq('id', requestId)
        .maybeSingle()
      if (intakeErr) return jsonResponse({ error: 'Unable to load concierge request' }, 500)
      if (!intake || intake.request_type !== 'listing' || intake.agent_id !== body.agent_id) {
        return jsonResponse({ error: 'A matching property request is required' }, 403)
      }
      if (intake.status === 'declined' || intake.status === 'completed') {
        return jsonResponse({ error: 'This request is already closed' }, 409)
      }
      try {
        payload = dataFromIntake(intake)
      } catch {
        return jsonResponse({ error: 'Complete the essential property details first' }, 422)
      }
    } else {
      // Preserve existing, admin-only manual Create Listing for Agent flow.
      payload = sanitizeListingPayload(body.listing)
    }

    const ineligible = await assertEligibleAgent(service, body.agent_id)
    if (ineligible) return ineligible

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
      creation_request_id: requestId,
    }

    const { data, error } = await service.from('listings')
      .insert(insertRow)
      .select('id, agent_id, status, created_by_user_id, creation_source, created_at')
      .single()

    if (error) {
      // Concurrent click raced the unique request-to-listing index:
      // retrieve the original draft rather than creating another listing.
      if (requestId && error.code === '23505') {
        const { data: linked } = await service.from('listings')
          .select('id, agent_id, status')
          .eq('creation_request_id', requestId)
          .eq('creation_source', CONCIERGE_SOURCE)
          .maybeSingle()
        if (linked && linked.agent_id === body.agent_id && linked.status === 'draft') {
          return jsonResponse({ listing: linked, existing: true })
        }
      }
      console.error('[admin-create-listing-for-agent] draft insert failed', error)
      return jsonResponse({ error: error.message, details: error.details ?? null }, 400)
    }

    // In-progress is informational. A failure to mark it does not undo a valid
    // draft; subsequent clicks still return the same draft.
    if (requestId) {
      const { error: statusError } = await service.from('agent_concierge_requests')
        .update({ status: 'in_progress' }).eq('id', requestId)
        .in('status', ['new', 'in_progress'])
      if (statusError) {
        console.warn('[admin-create-listing-for-agent] unable to mark request in_progress', statusError.message)
      }
    }

    console.log('[admin-create-listing-for-agent] draft prepared', {
      listing_id: data.id,
      agent_id: data.agent_id,
      admin_id: adminId,
      request_id: requestId,
    })

    return jsonResponse({ listing: data, existing: false })
  } catch (err) {
    console.error('[admin-create-listing-for-agent] unexpected error', err)
    return jsonResponse({ error: (err as Error).message ?? 'Unexpected error' }, 500)
  }
})
