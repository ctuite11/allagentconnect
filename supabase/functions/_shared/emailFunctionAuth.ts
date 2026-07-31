/**
 * Authority gates for email workers and privileged producers.
 * Fail closed: missing Authorization ⇒ reject.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type EmailAuthorityMode =
  | "service_role"
  | "admin"
  | "internal_cron"
  | "authenticated_user";

export type EmailAuthorityResult =
  | { ok: true; mode: EmailAuthorityMode; userId?: string }
  | { ok: false; status: number; error: string };

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Queue workers: service role, admin JWT, or internal cron secret. */
export async function assertEmailWorkerAuthority(
  req: Request,
): Promise<EmailAuthorityResult> {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (serviceKey && timingSafeEqual(token, serviceKey)) {
    return { ok: true, mode: "service_role" };
  }

  const cronSecret = (Deno.env.get("EMAIL_CRON_SECRET") ?? "").trim();
  const cronHeader = (req.headers.get("x-email-cron-secret") ?? "").trim();
  if (cronSecret && cronHeader && timingSafeEqual(cronHeader, cronSecret)) {
    // Cron still needs a valid service bearer (or we accept cron+service).
    if (serviceKey && timingSafeEqual(token, serviceKey)) {
      return { ok: true, mode: "internal_cron" };
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: "config" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || isAdmin !== true) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, mode: "admin", userId: userData.user.id };
}

/**
 * Privileged producers (fan-out / queue writers): service role or admin only.
 * Ordinary authenticated users and anonymous callers are rejected.
 */
export async function assertPrivilegedEmailProducerAuthority(
  req: Request,
): Promise<EmailAuthorityResult> {
  return assertEmailWorkerAuthority(req);
}

/**
 * User-initiated transactional producers: any authenticated (non-anon) user,
 * or service role / admin.
 */
export async function assertAuthenticatedEmailProducerAuthority(
  req: Request,
): Promise<EmailAuthorityResult> {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (serviceKey && timingSafeEqual(token, serviceKey)) {
    return { ok: true, mode: "service_role" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: "config" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Reject truly anonymous sessions if present.
  const isAnon = Boolean(
    (userData.user as { is_anonymous?: boolean }).is_anonymous,
  );
  if (isAnon) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: isAdmin } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (isAdmin === true) {
    return { ok: true, mode: "admin", userId: userData.user.id };
  }

  return {
    ok: true,
    mode: "authenticated_user",
    userId: userData.user.id,
  };
}
