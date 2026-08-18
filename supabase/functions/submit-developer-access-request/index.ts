// @auth-classification: public-read
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  website?: string;
  project_name?: string;
  market?: string;
  note?: string;
  source?: string;
}

const MAX = {
  first_name: 80,
  last_name: 80,
  email: 254,
  phone: 32,
  company_name: 160,
  website: 300,
  project_name: 160,
  market: 120,
  note: 1000,
  source: 80,
};

/** Trim, collapse whitespace, strip control chars, enforce max length. */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

async function consume(supabase: any, key: string, windowSeconds: number, limit: number) {
  const { data, error } = await supabase.rpc('rate_limit_consume', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) {
    console.error('[developer-access-request] rate limit RPC error:', error.message ?? error);
    return { allowed: true, reset_at: new Date().toISOString() };
  }
  return data as { allowed: boolean; reset_at: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const first_name = clean(body.first_name, MAX.first_name);
  const last_name = clean(body.last_name, MAX.last_name);
  const email = clean(body.email, MAX.email).toLowerCase();
  const phone = clean(body.phone, MAX.phone);
  const company_name = clean(body.company_name, MAX.company_name);
  const website = clean(body.website, MAX.website);
  const project_name = clean(body.project_name, MAX.project_name);
  const market = clean(body.market, MAX.market);
  const note = clean(body.note, MAX.note);
  const source = clean(body.source, MAX.source) || 'developer-access';

  const errors: string[] = [];
  if (!first_name) errors.push('first_name is required');
  if (!last_name) errors.push('last_name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('a valid work email is required');
  if (!company_name) errors.push('company_name is required');
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone || phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.push('a valid phone number is required');
  }
  let normalizedWebsite: string | null = null;
  if (website) {
    const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    try {
      const u = new URL(candidate);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
      normalizedWebsite = u.toString();
    } catch {
      errors.push('website must be a valid URL');
    }
  }
  if (errors.length > 0) return json({ error: 'Validation failed', details: errors }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const ipShort = await consume(supabase, `route:developer-access-request|ip:${ip}`, 600, 5);
  if (!ipShort.allowed) {
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': '600' });
  }
  const ipDay = await consume(supabase, `route:developer-access-request|ip:${ip}|day`, 86400, 20);
  if (!ipDay.allowed) {
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': '3600' });
  }
  const emailDay = await consume(
    supabase,
    `route:developer-access-request|email:${email}|day`,
    86400,
    3,
  );
  if (!emailDay.allowed) {
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': '3600' });
  }

  const { data, error } = await supabase
    .from('developer_access_requests')
    .insert({
      first_name,
      last_name,
      email,
      phone,
      company_name,
      website: normalizedWebsite,
      project_name: project_name || null,
      market: market || null,
      note: note || null,
      source,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // Duplicate open request for the same email — treat as success, no data leak.
    if (error.code === '23505') {
      return json({
        success: true,
        duplicate: true,
        message: "We already have a pending request for this email. Our team will be in touch.",
      });
    }
    console.error('[developer-access-request] insert error:', error.message ?? error);
    return json({ error: 'Failed to submit. Please try again.' }, 500);
  }

  console.log(`[developer-access-request] created request ${data.id}`);

  // Best-effort admin alert (never blocks or fails the submission).
  try {
    const fullName = `${first_name} ${last_name}`.trim();
    const { error: notifyError } = await supabase.from('email_jobs').insert({
      idempotency_key: `developer-access-request:${data.id}`,
      payload: {
        provider: 'resend',
        template: 'developer-access-request-submitted',
        to: 'chris@allagentconnect.com',
        subject: `New Developer Access Request — ${fullName}`,
        reply_to: email,
        variables: {
          fullName,
          email,
          phone,
          companyName: company_name,
          website: normalizedWebsite ?? '',
          projectName: project_name,
          market,
          note,
          submittedAt: new Date().toISOString(),
          adminUrl: 'https://allagentconnect.com/admin/developments',
        },
      },
    });
    if (notifyError && notifyError.code !== '23505') {
      console.error('[developer-access-request] admin notify enqueue failed:', notifyError.message);
    } else if (!notifyError) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/kick-email-queue`, {
        method: 'POST',
        signal: AbortSignal.timeout(1500),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        },
        body: '{}',
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[developer-access-request] admin notify skipped:', e instanceof Error ? e.message : String(e));
  }

  return json({
    success: true,
    duplicate: false,
    request_id: data.id,
    message: 'Request received. Our team will review it and follow up by email.',
  });
});