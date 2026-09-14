/**
 * Shared helpers for the Admin "Create Listing for Agent" (concierge) flow.
 *
 * Hard rules enforced here, in one place:
 *  - caller must be an authenticated admin (no impersonation, no agent session)
 *  - the listing owner (`agent_id`) is the selected member, never the admin
 *  - concierge listings are DRAFT ONLY — these functions can never move a
 *    listing to a live status. Publishing is the member's action, in the
 *    normal listing workflow, which is what triggers the normal alerts.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const CONCIERGE_SOURCE = 'admin_concierge'
export const CONCIERGE_CREATE_FUNCTION = 'admin-create-listing-for-agent'

/** Columns the client may never set on a concierge listing. */
const PROTECTED_COLUMNS = new Set([
  'id',
  'agent_id',
  'status',
  'created_at',
  'updated_at',
  'created_by_user_id',
  'creation_source',
  'created_via_function',
  'creation_request_id',
  'listing_number',
])

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function sanitizeListingPayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PROTECTED_COLUMNS.has(key)) continue
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

export interface AdminContext {
  adminId: string
  service: SupabaseClient
}

/**
 * Verifies the caller's own JWT and admin role. Never reads or returns any
 * auth/account data for the target agent.
 */
export async function requireAdmin(req: Request): Promise<AdminContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized - no auth header' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Unauthorized - invalid session' }, 401)

  const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  })
  if (roleError) return jsonResponse({ error: 'Failed to verify admin role' }, 500)
  if (!isAdmin) return jsonResponse({ error: 'Forbidden - admin role required' }, 403)

  return {
    adminId: user.id,
    service: createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }),
  }
}

/** Target must be an existing verified + activated AAC member. */
export async function assertEligibleAgent(
  service: SupabaseClient,
  agentId: string,
): Promise<Response | null> {
  const { data, error } = await service
    .from('agent_settings')
    .select('user_id, agent_status, account_activated_at')
    .eq('user_id', agentId)
    .maybeSingle()

  if (error) return jsonResponse({ error: 'Failed to verify member eligibility' }, 500)
  if (!data || data.agent_status !== 'verified' || !data.account_activated_at) {
    return jsonResponse(
      { error: 'Selected member is not a verified, activated agent' },
      422,
    )
  }
  return null
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
