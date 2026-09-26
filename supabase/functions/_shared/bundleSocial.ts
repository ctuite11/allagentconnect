// Shared server-side helpers for AAC social publishing via bundle.social.
// Server-only: BUNDLE_SOCIAL_API_KEY must never reach the browser.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

export { corsHeaders }

export const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'THREADS'] as const
export type Platform = (typeof PLATFORMS)[number]

// Statuses that must never be socially promoted.
export const SOCIAL_EXCLUDED_STATUSES = ['temporarily_withdrawn', 'cancelled', 'canceled']

// Per-platform caption limits enforced server-side.
export const PLATFORM_CAPTION_LIMITS: Partial<Record<Platform, number>> = {
  THREADS: 500,
}

const BUNDLE_BASE_URL = 'https://api.bundle.social'

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

export interface AuthContext {
  userId: string
  userClient: SupabaseClient
  admin: boolean
}

/**
 * Validates the caller's JWT in code and enforces the server-side launch gate.
 * Returns null when the caller is not allowed to use social publishing.
 *
 * Gate rules (exactly as approved):
 * - SOCIAL_LAUNCH_OPEN === 'true'  -> any authenticated user (production launch)
 * - AAC admins (has_role 'admin')  -> always allowed
 * - SOCIAL_TEST_USER_IDS (comma-separated auth user ids) -> allowed test accounts
 * - everyone else                  -> refused, even calling the endpoint directly
 */
export async function authenticateGated(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return null
  const userId = user.id

  if (Deno.env.get('SOCIAL_LAUNCH_OPEN') === 'true') {
    return { userId, userClient, admin: false }
  }

  const svc = serviceClient()
  const { data: isAdmin } = await svc.rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (isAdmin === true) return { userId, userClient, admin: true }

  const testIds = (Deno.env.get('SOCIAL_TEST_USER_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (testIds.includes(userId)) return { userId, userClient, admin: false }

  return null
}

/** Server-side call to bundle.social. The API key is only ever read here. */
export async function bundleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = Deno.env.get('BUNDLE_SOCIAL_API_KEY')?.trim()
  if (!apiKey) throw new Error('BUNDLE_SOCIAL_API_KEY is not configured')
  if (!/^[\x21-\x7E]+$/.test(apiKey)) {
    throw new Error('BUNDLE_SOCIAL_API_KEY is not a valid API key value (non-ASCII content) — re-save the secret')
  }
  return fetch(`${BUNDLE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(init.headers ?? {}),
    },
  })
}

/** Display-safe provider error detail (status + truncated body, never the key). */
export async function providerErrorDetail(res: Response): Promise<string> {
  let body = ''
  try {
    body = (await res.text()).slice(0, 500)
  } catch {
    body = ''
  }
  return `bundle.social ${res.status}: ${body}`
}

/** Returns the set of platforms actually connected on the agent's Bundle team. */
export async function getConnectedPlatforms(teamId: string): Promise<Set<Platform>> {
  const connected = new Set<Platform>()
  for (const platform of PLATFORMS) {
    const res = await bundleFetch(
      `/api/v1/social-account/by-type?teamId=${encodeURIComponent(teamId)}&type=${platform}`,
    )
    if (!res.ok) continue
    const account = await res.json().catch(() => null)
    if (account && account.id && !account.deletedAt) connected.add(platform)
  }
  return connected
}

export function enforceCaptionLimit(platform: Platform, caption: string): string {
  const limit = PLATFORM_CAPTION_LIMITS[platform]
  if (limit && caption.length > limit) return caption.slice(0, limit - 1).trimEnd() + '…'
  return caption
}

const EVENT_HEADLINES: Record<string, string> = {
  just_listed: 'JUST LISTED',
  off_market: 'OFF MARKET',
  coming_soon: 'COMING SOON',
  back_on_market: 'BACK ON MARKET',
  pending: 'PENDING',
  under_agreement: 'UNDER AGREEMENT',
  sold: 'JUST SOLD',
  price_reduced: 'PRICE REDUCED',
  price_updated: 'PRICE UPDATED',
  open_house: 'OPEN HOUSE',
  update: 'LISTING UPDATE',
}

export interface ListingForPost {
  id: string
  agent_id: string
  status: string
  address: string | null
  city: string | null
  state: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  description: string | null
  photos: unknown
}

export function publicListingUrl(listingId: string): string {
  return `https://allagentconnect.com/property/${listingId}`
}

export function heroPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null
  const first = photos[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object') {
    const obj = first as Record<string, unknown>
    for (const key of ['url', 'src', 'publicUrl', 'public_url']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
    }
  }
  return null
}

export function buildCaption(
  eventType: string,
  listing: ListingForPost,
  override?: string | null,
): string {
  if (override && override.trim()) return override.trim()

  const headline = EVENT_HEADLINES[eventType] ?? EVENT_HEADLINES.update
  const place = [listing.address, listing.city].filter(Boolean).join(', ')
  const lines = [`${headline} | ${place}`]

  if (listing.price != null) {
    lines.push(`$${Number(listing.price).toLocaleString('en-US')}`)
  }
  const bedsBaths: string[] = []
  if (listing.bedrooms != null) bedsBaths.push(`${listing.bedrooms} bd`)
  if (listing.bathrooms != null) bedsBaths.push(`${listing.bathrooms} ba`)
  if (bedsBaths.length) lines.push(bedsBaths.join(' / '))

  if (listing.description) {
    const desc = listing.description.replace(/\s+/g, ' ').trim()
    if (desc) lines.push(desc.length > 200 ? `${desc.slice(0, 197)}…` : desc)
  }

  lines.push(publicListingUrl(listing.id))
  return lines.join('\n')
}

/**
 * Listing ownership / delegate check. Returns true when the caller owns the
 * listing, is an AAC admin, or may act for the owning agent (delegate).
 */
export async function canActOnListing(
  svc: SupabaseClient,
  userId: string,
  admin: boolean,
  listingAgentId: string,
): Promise<boolean> {
  if (listingAgentId === userId || admin) return true
  const { data, error } = await svc.rpc('can_act_for_agent', {
    _user_id: userId,
    _agent_id: listingAgentId,
  })
  if (error) return false
  return data === true
}
