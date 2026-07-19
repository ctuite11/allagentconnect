import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgentProfile {
  id: string
  aac_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  bio: string | null
  created_at: string | null
}

interface AgentSettings {
  user_id: string
  agent_status: string
  license_number: string | null
  license_state: string | null
  verified_at: string | null
  account_activated_at: string | null
  approval_email_sent: boolean | null
}

interface MergedAgent {
  id: string
  aac_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  bio: string | null
  license_number: string | null
  license_state: string | null
  agent_status: string
  verified_at: string | null
  created_at: string
  is_early_access?: boolean
  has_auth_account?: boolean
  last_sign_in_at?: string | null
  account_activated_at?: string | null
  approval_email_sent?: boolean | null
  invite_email?: EmailStatusInfo | null
  license_verified_email?: EmailStatusInfo | null
  profile_complete?: boolean
  headshot_url?: string | null
}

interface EmailStatusInfo {
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'
  created_at: string
  event_at: string | null
  attempts: number | null
  last_error: string | null
}

function deriveEmailStatus(row: {
  status: string | null
  delivery_status: string | null
}): EmailStatusInfo['status'] {
  const ds = (row.delivery_status || '').toLowerCase()
  if (ds === 'delivered') return 'delivered'
  if (ds === 'bounced' || ds === 'bounce') return 'bounced'
  if (ds === 'complained' || ds === 'complaint') return 'complained'
  const s = (row.status || '').toLowerCase()
  if (s === 'sent') return 'sent'
  if (s === 'failed' || s === 'dlq' || s === 'error') return 'failed'
  return 'queued'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Get authorization header for verifying caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[admin-list-agents] No authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.error('[admin-list-agents] Auth error:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[admin-list-agents] Caller:', user.email)

    // Check if caller has admin role using RPC
    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (roleError) {
      console.error('[admin-list-agents] Role check error:', roleError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isAdmin) {
      console.error('[admin-list-agents] Not admin:', user.email)
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[admin-list-agents] Admin verified, fetching agents...')

    // Use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Build maps of auth.users by lowercase email — drives has_auth_account + last_sign_in_at
    const authEmails = new Set<string>()
    const lastSignInByEmail = new Map<string, string | null>()
    try {
      let page = 1
      const perPage = 1000
      // Hard cap to avoid runaway loops
      while (page <= 50) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage })
        if (listErr) {
          console.error('[admin-list-agents] auth.admin.listUsers error:', listErr.message)
          break
        }
        const users = list?.users ?? []
        for (const u of users) {
          const email = (u.email ?? '').toLowerCase()
          if (!email) continue
          authEmails.add(email)
          const prev = lastSignInByEmail.get(email)
          const next = u.last_sign_in_at ?? null
          // Keep most-recent sign-in if duplicate email rows exist
          if (!prev || (next && new Date(next).getTime() > new Date(prev).getTime())) {
            lastSignInByEmail.set(email, next)
          }
        }
        if (users.length < perPage) break
        page++
      }
      console.log('[admin-list-agents] auth users scanned:', authEmails.size)
    } catch (e) {
      console.error('[admin-list-agents] auth listUsers exception:', e)
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('agent_profiles')
      .select('id, aac_id, first_name, last_name, email, phone, company, bio, headshot_url, created_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('[admin-list-agents] Profiles error:', profilesError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[admin-list-agents] Profiles fetched:', profiles?.length ?? 0)

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ agents: [], profilesCount: 0, settingsCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all settings
    const userIds = profiles.map(p => p.id)
    const { data: settings, error: settingsError } = await adminClient
      .from('agent_settings')
      .select('user_id, agent_status, license_number, license_state, verified_at, account_activated_at, approval_email_sent')
      .in('user_id', userIds)

    if (settingsError) {
      console.error('[admin-list-agents] Settings error:', settingsError.message)
      // Continue anyway - we'll just show unknown status
    }

    console.log('[admin-list-agents] Settings fetched:', settings?.length ?? 0)

    // Merge profiles with settings
    const settingsByUser = new Map<string, AgentSettings>(
      (settings || []).map(s => [s.user_id, s])
    )

    const agents: MergedAgent[] = profiles.map(p => {
      const s = settingsByUser.get(p.id)
      const emailKey = (p.email ?? '').toLowerCase()
      const headshotUrl = (p as any).headshot_url as string | null | undefined
      const profileComplete =
        !!(p.first_name && p.first_name.trim()) &&
        !!(p.last_name && p.last_name.trim()) &&
        !!(headshotUrl && String(headshotUrl).trim()) &&
        !!(p.company && p.company.trim()) &&
        !!((p.phone && p.phone.trim()) || (p.email && p.email.trim()))
      return {
        id: p.id,
        aac_id: p.aac_id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        company: p.company,
        bio: p.bio,
        license_number: s?.license_number ?? null,
        license_state: s?.license_state ?? null,
        agent_status: s?.agent_status ?? 'unknown',
        verified_at: s?.verified_at ?? null,
        created_at: p.created_at || new Date().toISOString(),
        has_auth_account: authEmails.has(emailKey),
        last_sign_in_at: lastSignInByEmail.get(emailKey) ?? null,
        account_activated_at: s?.account_activated_at ?? null,
        approval_email_sent: s?.approval_email_sent ?? null,
        profile_complete: profileComplete,
        headshot_url: headshotUrl ?? null,
      }
    })

    // Log status distribution
    const statusCounts = agents.reduce((acc, a) => {
      acc[a.agent_status] = (acc[a.agent_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('[admin-list-agents] Status distribution:', statusCounts)

    // Fetch early access registrations
    const { data: earlyAccess, error: earlyAccessError } = await adminClient
      .from('agent_early_access')
      .select('id, first_name, last_name, email, phone, brokerage, state, license_number, status, created_at')
      .order('created_at', { ascending: false })

    if (earlyAccessError) {
      console.error('[admin-list-agents] Early access error:', earlyAccessError.message)
    }

    console.log('[admin-list-agents] Early access fetched:', earlyAccess?.length ?? 0)

    // Filter out early access entries that already have an agent profile (by email)
    const existingEmails = new Set(agents.map(a => a.email.toLowerCase()))
    const newEarlyAccess = (earlyAccess || []).filter(ea => !existingEmails.has(ea.email.toLowerCase()))

    // Map early access records to MergedAgent format - RESPECT actual status from DB
    const earlyAccessAgents: MergedAgent[] = newEarlyAccess.map(ea => {
      const emailKey = (ea.email ?? '').toLowerCase()
      return {
      id: ea.id,
      aac_id: `EA-${ea.id.slice(0, 6).toUpperCase()}`,
      first_name: ea.first_name,
      last_name: ea.last_name,
      email: ea.email,
      phone: ea.phone,
      company: ea.brokerage,
      bio: null,
      license_number: ea.license_number,
      license_state: ea.state,
      agent_status: ea.status ?? 'pending', // Use actual status from agent_early_access table
      verified_at: null,
      created_at: ea.created_at,
      is_early_access: true,
      has_auth_account: authEmails.has(emailKey),
      last_sign_in_at: lastSignInByEmail.get(emailKey) ?? null,
      account_activated_at: null,
      profile_complete: false,
      }
    })

    // Combine both lists
    const allAgents = [...agents, ...earlyAccessAgents]

    // Sort by "most recently became a real, usable agent" — max of
    // account_activated_at, verified_at, created_at. Keeps late activators
    // (e.g. verified weeks ago, activated today) at the top.
    const recency = (a: MergedAgent) => {
      const t = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0)
      return Math.max(t(a.account_activated_at), t(a.verified_at), t(a.created_at))
    }
    allAgents.sort((a, b) => recency(b) - recency(a))

    // Fetch latest License Verified and Admin-Created Invite email status per recipient.
    // Read-only surfacing — no template, sender, or Resend config is touched here.
    try {
      const emailsLower = new Set(allAgents.map(a => (a.email ?? '').toLowerCase()).filter(Boolean))
      const templates = ['license-verified', 'admin-created-invite']
      const { data: jobs, error: jobsErr } = await adminClient
        .from('email_jobs')
        .select('id, status, delivery_status, delivery_status_at, created_at, attempts, last_error, payload')
        .in('payload->>template', templates)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (jobsErr) {
        console.error('[admin-list-agents] email_jobs error:', jobsErr.message)
      } else if (jobs) {
        const latest = new Map<string, EmailStatusInfo & { template: string }>()
        for (const j of jobs as any[]) {
          const to = String(j?.payload?.to ?? '').toLowerCase()
          const template = String(j?.payload?.template ?? '')
          if (!to || !template || !emailsLower.has(to)) continue
          const key = `${to}::${template}`
          if (latest.has(key)) continue // first row is the latest thanks to desc order
          latest.set(key, {
            template,
            status: deriveEmailStatus(j),
            created_at: j.created_at,
            event_at: j.delivery_status_at ?? null,
            attempts: j.attempts ?? null,
            last_error: j.last_error ?? null,
          })
        }
        for (const a of allAgents) {
          const key = (a.email ?? '').toLowerCase()
          if (!key) continue
          const inv = latest.get(`${key}::admin-created-invite`)
          const lic = latest.get(`${key}::license-verified`)
          if (inv) {
            const { template: _t, ...rest } = inv
            a.invite_email = rest
          }
          if (lic) {
            const { template: _t, ...rest } = lic
            a.license_verified_email = rest
          }
        }
      }
    } catch (e) {
      console.error('[admin-list-agents] email_jobs exception:', e)
    }

    // Recalculate status distribution with early access included
    const allStatusCounts = allAgents.reduce((acc, a) => {
      acc[a.agent_status] = (acc[a.agent_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('[admin-list-agents] Combined status distribution:', allStatusCounts)

    return new Response(
      JSON.stringify({
        agents: allAgents,
        profilesCount: profiles.length,
        settingsCount: settings?.length ?? 0,
        earlyAccessCount: earlyAccessAgents.length,
        statusDistribution: allStatusCounts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[admin-list-agents] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
