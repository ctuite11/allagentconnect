// Saves a listing's social defaults on its first publish (all-false allowed).
// Browser has SELECT-only on listing_social_defaults; writes happen here with
// the service role. V1: only the listing's owner may set defaults, because
// social posts go through the caller's own connected accounts.
import { z } from 'npm:zod@3'
import { authenticateGated, corsHeaders, json, serviceClient } from '../_shared/bundleSocial.ts'

const BodySchema = z.object({
  listingId: z.string().uuid(),
  facebook: z.boolean(),
  instagram: z.boolean(),
  linkedin: z.boolean(),
  threads: z.boolean(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateGated(req)
  if (!auth) return json({ error: 'Not authorized for social publishing' }, 403)

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  const { listingId, facebook, instagram, linkedin, threads } = parsed.data

  const svc = serviceClient()
  const { data: listing, error: listingError } = await svc
    .from('listings')
    .select('id, agent_id')
    .eq('id', listingId)
    .maybeSingle()
  if (listingError || !listing) return json({ error: 'Listing not found' }, 404)
  if (listing.agent_id !== auth.userId) {
    return json({ error: 'Only the listing owner can set social defaults' }, 403)
  }

  const { error } = await svc.from('listing_social_defaults').upsert(
    { listing_id: listingId, facebook, instagram, linkedin, threads, updated_at: new Date().toISOString() },
    { onConflict: 'listing_id' },
  )
  if (error) return json({ error: 'Could not save social defaults' }, 500)
  return json({ ok: true })
})
