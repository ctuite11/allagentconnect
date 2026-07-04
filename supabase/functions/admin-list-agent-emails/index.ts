import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { email?: string; templates?: string[] } = {}
    try {
      body = await req.json()
    } catch {
      // empty body
    }
    const email = (body.email ?? '').trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const templates = body.templates && body.templates.length > 0
      ? body.templates
      : ['license-verified']

    const admin = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch last 50 candidate email_jobs by recipient, then filter templates in JS
    // (PostgREST `in` on JSON accessors is unreliable across versions).
    const { data: rawJobs, error: jobsErr } = await admin
      .from('email_jobs')
      .select(
        'id, created_at, status, delivery_status, delivery_status_at, provider_message_id, idempotency_key, last_error, payload',
      )
      .eq('payload->>to', email)
      .order('created_at', { ascending: false })
      .limit(50)
    const jobs = (rawJobs ?? [])
      .filter((j: any) => templates.includes(j.payload?.template))
      .slice(0, 25)

    if (jobsErr) {
      return new Response(JSON.stringify({ error: jobsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jobIds = (jobs ?? []).map((j: any) => j.id)
    let events: any[] = []
    let opens: any[] = []
    let clicks: any[] = []
    if (jobIds.length > 0) {
      const [evRes, opRes, clRes] = await Promise.all([
        admin
          .from('email_events')
          .select('job_id, event, provider_event_at, created_at, detail')
          .in('job_id', jobIds)
          .order('created_at', { ascending: true }),
        admin
          .from('email_job_opens')
          .select('job_id, opened_at')
          .in('job_id', jobIds)
          .order('opened_at', { ascending: true }),
        admin
          .from('email_job_clicks')
          .select('job_id, clicked_at, url')
          .in('job_id', jobIds)
          .order('clicked_at', { ascending: true }),
      ])
      events = evRes.data ?? []
      opens = opRes.data ?? []
      clicks = clRes.data ?? []
    }

    const byJob = <T extends { job_id: string }>(rows: T[]) => {
      const map = new Map<string, T[]>()
      for (const r of rows) {
        const arr = map.get(r.job_id) ?? []
        arr.push(r)
        map.set(r.job_id, arr)
      }
      return map
    }
    const evMap = byJob(events)
    const opMap = byJob(opens)
    const clMap = byJob(clicks)

    const extractBounceReason = (evs: any[]): string | null => {
      const bounce = [...evs]
        .reverse()
        .find((e) => ['bounced', 'failed', 'complained'].includes(e.event))
      if (!bounce) return null
      const raw = bounce.detail?.raw?.data ?? bounce.detail ?? {}
      return (
        raw.reason ||
        raw.bounce?.message ||
        raw.bounce?.subType ||
        raw.message ||
        raw.text ||
        bounce.event
      )
    }

    const result = (jobs ?? []).map((j: any) => {
      const payload = j.payload ?? {}
      const evs = evMap.get(j.id) ?? []
      const ops = opMap.get(j.id) ?? []
      const cls = clMap.get(j.id) ?? []
      return {
        id: j.id,
        created_at: j.created_at,
        status: j.status,
        delivery_status: j.delivery_status,
        delivery_status_at: j.delivery_status_at,
        provider_message_id: j.provider_message_id,
        idempotency_key: j.idempotency_key,
        last_error: j.last_error,
        template: payload.template ?? null,
        subject: payload.subject ?? null,
        from: 'All Agent Connect <hello@allagentconnect.com>',
        reply_to: payload.reply_to ?? null,
        to: payload.to ?? null,
        opens: ops.map((o: any) => ({ opened_at: o.opened_at })),
        clicks: cls.map((c: any) => ({ clicked_at: c.clicked_at, url: c.url })),
        events: evs.map((e: any) => ({
          event: e.event,
          at: e.provider_event_at ?? e.created_at,
        })),
        bounce_reason: extractBounceReason(evs),
      }
    })

    return new Response(JSON.stringify({ jobs: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})