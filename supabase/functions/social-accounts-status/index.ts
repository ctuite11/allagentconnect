// Returns Connected / Not Connected per platform for the caller's own
// bundle.social team. Never exposes other agents' teams or accounts.
import {
  authenticateGated,
  corsHeaders,
  getConnectedPlatforms,
  json,
  PLATFORMS,
  serviceClient,
} from '../_shared/bundleSocial.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authenticateGated(req)
  if (!auth) return json({ error: 'Not authorized for social publishing' }, 403)

  const svc = serviceClient()
  const { data: account } = await svc
    .from('agent_social_accounts')
    .select('bundle_team_id')
    .eq('agent_id', auth.userId)
    .maybeSingle()

  const platforms: Record<string, boolean> = {}
  if (!account) {
    for (const p of PLATFORMS) platforms[p] = false
    return json({ platforms })
  }

  const connected = await getConnectedPlatforms(account.bundle_team_id)
  for (const p of PLATFORMS) platforms[p] = connected.has(p)
  return json({ platforms })
})
