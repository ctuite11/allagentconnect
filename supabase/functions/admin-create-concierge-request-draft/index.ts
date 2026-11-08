/**
 * AAC Concierge intake -> one agent-owned listing DRAFT.
 *
 * This is intentionally a NEW endpoint, not a modification to the existing
 * admin-create-listing-for-agent function. Netlify preview may use an older
 * backend, and failing with a missing endpoint is safer than unexpectedly
 * creating a blank listing through the old admin API.
 *
 * No publishing, broadcasting, network emails, or copying photos from the
 * private intake into any public storage location.
 */
import {
  assertEligibleAgent,
  CONCIERGE_SOURCE,
  corsHeaders,
  isUuid,
  jsonResponse,
  requireAdmin,
} from '../_shared/conciergeListing.ts'

type ListingIntake = {
  id: string
  agent_id: string
  status: string
  request_type: string
  property_address: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  condo_fee_monthly: number | null
  parking_spaces: number | null
  parking_type: string | null
  property_type: string | null
  asking_price: number | null
  bedrooms: number | null
  bathrooms: number | null
  square_feet: number | null
  lot_acres: number | null
}

/** Conservative parser: incomplete locations remain clearly marked in draft. */
function parseAddress(raw: string) {
  const parts = raw.trim().split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 3) {
    const match = /^([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/.exec(parts[parts.length - 1])
    if (match) {
      return {
        address: parts.slice(0, -2).join(', '),
        city: parts[parts.length - 2],
        state: match[1].toUpperCase(),
        zip_code: match[2],
      }
    }
  }
  // Same placeholders as the existing admin concierge draft creation path.
  // Staff must complete location fields before requesting agent publication.
  return { address: raw.trim(), city: 'TBD', state: 'MA', zip_code: '00000' }
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof Response) return ctx
    const { adminId, service } = ctx

    const body = await req.json().catch(() => ({})) as {
      request_id?: string
      agent_id?: string
    }
    if (!isUuid(body.request_id) || !isUuid(body.agent_id)) {
      return jsonResponse({ error: 'Valid request_id and agent_id are required' }, 400)
    }

    // Check request ID, type, owner, state. Never trust client-supplied property
    // data for this handoff; always load the saved, private intake.
    const { data: intake, error: intakeErr } = await service
      .from('agent_concierge_requests')
      .select('id, agent_id, status, request_type, property_address, address_street, address_city, address_state, address_zip, property_type, asking_price, bedrooms, bathrooms, square_feet, lot_acres, condo_fee_monthly, parking_spaces, parking_type')
      .eq('id', body.request_id)
      .maybeSingle()
    if (intakeErr) return jsonResponse({ error: 'Failed to load concierge request' }, 500)
    if (!intake || intake.request_type !== 'listing' || intake.agent_id !== body.agent_id) {
      return jsonResponse({ error: 'Matching property request required' }, 403)
    }

    const { data: linked, error: linkedErr } = await service.from('listings')
      .select('id, agent_id, status')
      .eq('creation_request_id', body.request_id)
      .eq('creation_source', CONCIERGE_SOURCE)
      .maybeSingle()
    if (linkedErr) return jsonResponse({ error: 'Failed to check linked draft' }, 500)
    if (linked) {
      if (linked.agent_id !== intake.agent_id) return jsonResponse({ error: 'Linked owner mismatch' }, 409)
      if (linked.status !== 'draft') {
        return jsonResponse({ error: 'This request already has a listing that is no longer a draft' }, 409)
      }
      return jsonResponse({ listing: linked, existing: true })
    }

    if (!['new', 'in_progress'].includes(intake.status)) {
      return jsonResponse({ error: 'This concierge request has been closed' }, 409)
    }

    const ineligible = await assertEligibleAgent(service, intake.agent_id)
    if (ineligible) return ineligible

    const address = intake.property_address?.trim() ?? ''
    const price = Number(intake.asking_price)
    if (!address || !intake.property_type || !Number.isFinite(price) || price <= 0 ||
        intake.bedrooms == null || intake.bathrooms == null || intake.square_feet == null ||
        (intake.property_type === 'single_family' && intake.lot_acres == null)) {
      return jsonResponse({ error: 'Request is missing essential property fields' }, 422)
    }

    // The only listing fields we may derive from intake. Agent instructions
    // remain internal; no description, broker comments, or public photo URLs.
    const structuredAddress =
      intake.address_street?.trim() && intake.address_city?.trim() &&
      intake.address_state?.trim() && intake.address_zip?.trim()
        ? {
            address: intake.address_street.trim(),
            city: intake.address_city.trim(),
            state: intake.address_state.trim(),
            zip_code: intake.address_zip.trim(),
          }
        : parseAddress(address)

    const { data, error } = await service.from('listings').insert({
      ...structuredAddress,
      agent_id: intake.agent_id,
      status: 'draft',
      listing_type: 'for_sale',
      property_type: intake.property_type,
      price,
      bedrooms: intake.bedrooms,
      bathrooms: intake.bathrooms,
      square_feet: intake.square_feet,
      lot_size: intake.property_type === 'single_family' ? intake.lot_acres : null,
      ...(intake.property_type === 'condo' ? {
        condo_details: intake.condo_fee_monthly != null
          ? { hoa_fee: Number(intake.condo_fee_monthly) } : null,
        parking_spaces: intake.parking_spaces,
        total_parking_spaces: intake.parking_spaces,
        parking_features_list: intake.parking_type && intake.parking_type !== 'none'
          ? [intake.parking_type.replace(/_/g, ' ')] : null,
      } : {}),
      photos: [],
      created_by_user_id: adminId,
      creation_source: CONCIERGE_SOURCE,
      created_via_function: 'admin-create-concierge-request-draft',
      creation_request_id: body.request_id,
    }).select('id, agent_id, status').single()

    if (error) {
      if (error.code === '23505') {
        // Competing clicks: one wins the unique request-ID index.
        const { data: existing } = await service.from('listings')
          .select('id, agent_id, status')
          .eq('creation_request_id', body.request_id)
          .eq('creation_source', CONCIERGE_SOURCE)
          .maybeSingle()
        if (existing?.agent_id === intake.agent_id && existing.status === 'draft') {
          return jsonResponse({ listing: existing, existing: true })
        }
      }
      console.error('[admin-create-concierge-request-draft] insert error', error)
      return jsonResponse({ error: 'Could not prepare listing draft' }, 500)
    }

    const { error: statusError } = await service.from('agent_concierge_requests')
      .update({ status: 'in_progress' }).eq('id', body.request_id)
      .in('status', ['new', 'in_progress'])
    if (statusError) console.warn('[concierge] status update failed', statusError.message)

    return jsonResponse({ listing: data, existing: false })
  } catch (error) {
    console.error('[admin-create-concierge-request-draft] error', error)
    return jsonResponse({ error: 'Unexpected error' }, 500)
  }
})
