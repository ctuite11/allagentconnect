import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailStatusInfo {
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed'
  created_at: string
  event_at: string | null
  attempts: number | null
  last_error: string | null
}

function deriveEmailStatus(row: { status: string | null; delivery_status: string | null }) {
  const ds = (row.delivery_status || '').toLowerCase()
  if (ds === 'delivered') return 'delivered'
  if (ds === 'bounced' || ds === 'bounce') return 'bounced'
  if (ds === 'complained' || ds === 'complaint') return 'complained'
  const s = (row.status || '').toLowerCase()
  if (s === 'sent') return 'sent'
  if (s === 'failed' || s === 'dlq' || s === 'error') return 'failed'
  return 'queued'
}

/**
 * Per-recipient email status for the admin roster. Split out of
 * admin-list-agents so the agent table can render before this resolves —
 * it was ~3s of a ~6-7s page load.
 *
 * Semantics are unchanged from the previous inline call: the same
 * admin_agent_email_summary RPC, the same `_templates` pair driving the
 * Invite / License Verified columns. `last_email` follows the RPC's
 * personal-send allowlist (mass/campaign/notification templates excluded).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError) {
      return new Response(JSON.stringify({ error: 'Failed to verify admin role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const started = Date.now()
    let emails: string[] = []
    try {
      const body = await req.json()
      if (Array.isArray(body?.emails)) {
        emails = body.emails
          .map((e: unknown) => String(e ?? '').trim().toLowerCase())
          .filter(Boolean)
      }
    } catch {
      // No body -> fall back to the full roster below.
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    if (emails.length === 0) {
      const { data: profiles, error } = await adminClient
        .from('agent_profiles')
        .select('email')
      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to resolve recipients' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      emails = (profiles ?? [])
        .map((p: { email: string | null }) => (p.email ?? '').trim().toLowerCase())
        .filter(Boolean)
    }

    const recipients = Array.from(new Set(emails))
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ summaries: {} }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rows, error: rpcError } = await adminClient.rpc('admin_agent_email_summary', {
      _emails: recipients,
      _templates: ['admin-created-invite', 'license-verified'],
    })

    if (rpcError) {
      console.error('[admin-agent-email-summary] rpc error:', rpcError.message)
      return new Response(JSON.stringify({ error: 'Failed to load email summary' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const summaries: Record<string, {
      last_email: { sent_at: string; template: string | null; status: string | null } | null
      invite_email: EmailStatusInfo | null
      license_verified_email: EmailStatusInfo | null
    }> = {}

    const ensure = (email: string) => {
      if (!summaries[email]) {
        summaries[email] = { last_email: null, invite_email: null, license_verified_email: null }
      }
      return summaries[email]
    }

    for (const j of (rows ?? []) as any[]) {
      const to = String(j?.email ?? '').toLowerCase()
      if (!to) continue
      const template = String(j?.template ?? '')
      const entry = ensure(to)
      if (j.kind === 'latest') {
        entry.last_email = {
          sent_at: j.created_at,
          template: template || null,
          status: deriveEmailStatus(j) ?? null,
        }
      } else if (template) {
        const info: EmailStatusInfo = {
          status: deriveEmailStatus(j),
          created_at: j.created_at,
          event_at: j.delivery_status_at ?? null,
          attempts: j.attempts ?? null,
          last_error: j.last_error ?? null,
        }
        if (template === 'admin-created-invite') entry.invite_email = info
        if (template === 'license-verified') entry.license_verified_email = info
      }
    }

    console.log(
      `[admin-agent-email-summary] recipients=${recipients.length} rows=${(rows ?? []).length} ms=${Date.now() - started}`,
    )

    return new Response(JSON.stringify({ summaries }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-agent-email-summary] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
