// Creates (lazily, once per agent) the agent's bundle.social Team and returns a
// hosted portal link for connecting Facebook / Instagram / LinkedIn / Threads.
import { z } from 'npm:zod@3'
import {
  authenticateGated,
  bundleFetch,
  corsHeaders,
  json,
  PLATFORMS,
  providerErrorDetail,
  serviceClient,
} from '../_shared/bundleSocial.ts'

const BodySchema = z.object({
  returnUrl: z.string().url().max(500).optional(),
})

const DEFAULT_RETURN_URL = 'https://allagentconnect.com/agent-settings'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateGated(req)
  if (!auth) return json({ error: 'Not authorized for social publishing' }, 403)

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400)
  }

  const svc = serviceClient()

  // One Bundle Team per AAC agent: reuse the persisted team, create lazily once.
  let { data: account } = await svc
    .from('agent_social_accounts')
    .select('id, bundle_team_id')
    .eq('agent_id', auth.userId)
    .maybeSingle()

  if (!account) {
    const teamRes = await bundleFetch('/api/v1/team/', {
      method: 'POST',
      body: JSON.stringify({ name: `AAC Agent ${auth.userId.slice(0, 8)}` }),
    })
    if (!teamRes.ok) {
      return json({ error: 'Could not create social team', detail: await providerErrorDetail(teamRes) }, 502)
    }
    const team = await teamRes.json()
    if (!team?.id) return json({ error: 'Social team response missing id' }, 502)

    // Insert-on-conflict: a concurrent request may have created the row first.
    const { data: inserted, error: insertError } = await svc
      .from('agent_social_accounts')
      .upsert(
        { agent_id: auth.userId, bundle_team_id: team.id },
        { onConflict: 'agent_id' },
      )
      .select('id, bundle_team_id')
      .single()

    if (insertError || !inserted) {
      const { data: existing } = await svc
        .from('agent_social_accounts')
        .select('id, bundle_team_id')
        .eq('agent_id', auth.userId)
        .single()
      if (!existing) return json({ error: 'Could not persist social team' }, 500)
      account = existing
    } else {
      account = inserted
    }
  }

  const portalRes = await bundleFetch('/api/v1/social-account/create-portal-link', {
    method: 'POST',
    body: JSON.stringify({
      teamId: account.bundle_team_id,
      redirectUrl: parsed.data.returnUrl ?? DEFAULT_RETURN_URL,
      socialAccountTypes: [...PLATFORMS],
    }),
  })
  if (!portalRes.ok) {
    return json({ error: 'Could not create connection portal', detail: await providerErrorDetail(portalRes) }, 502)
  }
  const portal = await portalRes.json()
  const portalUrl = portal?.url ?? portal?.portalUrl ?? portal?.link
  if (!portalUrl) return json({ error: 'Portal response missing url' }, 502)

  return json({ portalUrl })
})
