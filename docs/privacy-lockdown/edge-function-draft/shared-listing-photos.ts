// DRAFT ONLY - not deployed. Proposed supabase/functions/shared-listing-photos/index.ts
// Option B: the share token travels in the POST body only. Response = short-lived (10 min) signed URLs
// for a PRIVATE bucket; URLs carry no reusable buyer token and expire on their own.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

const Body = z.object({ token: z.string().min(40).max(60) })
const PRIVATE_BUCKET = 'listing-photos-private'
const TTL_SECONDS = 600

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: 'invalid_link' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: paths, error } = await admin.rpc('get_shared_listing_photo_paths', { p_token: parsed.data.token })
  if (error || !Array.isArray(paths)) return json({ error: 'invalid_link' }, 404) // same answer for expired/revoked/unknown

  const objectPaths = paths.map((p: unknown) => (typeof p === 'string' ? p : (p as { path?: string })?.path)).filter(Boolean) as string[]
  const { data: signed } = await admin.storage.from(PRIVATE_BUCKET).createSignedUrls(objectPaths.slice(0, 60), TTL_SECONDS)
  return json({ photos: (signed ?? []).map((s) => s.signedUrl).filter(Boolean) }, 200)
})
