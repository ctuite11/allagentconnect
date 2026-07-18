import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Canonical auth-user deletion path.
 *
 * Guarantees (paired with the auth_user_deletion_queue outbox written by
 * admin_delete_agent in the same transaction as the app-row cleanup):
 *   - Resolves the CANONICAL auth user id (by id, then normalized email);
 *     never assumes agent_profiles.id == auth.users.id.
 *   - Returns a structured per-target result (deleted / already_absent /
 *     failed with stage + exact reason) — never a vague auth error.
 *   - Failed auth deletions stay pending in the outbox and are retried by a
 *     pg_cron pump every 10 minutes (idempotent).
 *   - Also drains pending outbox rows opportunistically on every call.
 *
 * Callers:
 *   - Admin UI (admin JWT, verified via has_role)
 *   - pg_cron pump (service-role key as bearer → internal caller)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Identity tables — if any of these still reference the user, a queue-driven
// deletion refuses to proceed (the app-level delete never happened).
const IDENTITY_SAFETY_CHECKS = [
  { table: 'profiles', column: 'id' },
  { table: 'agent_profiles', column: 'id' },
  { table: 'user_roles', column: 'user_id' },
] as const;

// Known FK tables that can block auth.users deletion
const BLOCKER_CHECKS = [
  { table: 'profiles', column: 'id' },
  { table: 'user_roles', column: 'user_id' },
  { table: 'favorites', column: 'user_id' },
  { table: 'buyer_qualifications', column: 'user_id' },
  { table: 'buyer_credentials', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'client_agent_relationships', column: 'client_id' },
  { table: 'conversation_participants', column: 'user_id' },
  { table: 'hot_sheet_comments', column: 'sender_id' },
] as const;

// FK columns that can be SET NULL safely (non-cascading FKs to auth.users)
const NULLABLE_FK_CHECKS = [
  { table: 'share_tokens', column: 'accepted_by_user_id' },
  { table: 'listing_status_history', column: 'changed_by' },
  { table: 'agent_invites', column: 'accepted_user_id' },
  { table: 'buyer_credentials', column: 'verified_by' },
] as const;

type SupabaseAdmin = ReturnType<typeof createClient>;

interface TargetInput {
  userId?: string;
  email?: string;
}

interface TargetResult {
  input: TargetInput;
  authUserId: string | null;
  email: string | null;
  status: 'deleted' | 'already_absent' | 'failed';
  stage?: 'resolve' | 'clear_blockers' | 'auth_delete';
  reason?: string;
  blockers?: Record<string, number>;
  queuedForRetry?: boolean;
}

async function detectBlockers(supabase: SupabaseAdmin, userId: string) {
  const blockers: Record<string, number> = {};
  for (const { table, column } of [...BLOCKER_CHECKS, ...NULLABLE_FK_CHECKS]) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, userId);
    if (!error && count && count > 0) {
      blockers[`${table}.${column}`] = count;
    }
  }
  return blockers;
}

async function clearBlockers(supabase: SupabaseAdmin, userId: string) {
  const cleared: string[] = [];

  for (const { table, column } of NULLABLE_FK_CHECKS) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);
    if (!error) cleared.push(`${table}.${column}`);
  }

  for (const { table, column } of BLOCKER_CHECKS) {
    if (table === 'profiles') continue; // Delete last
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(column, userId);
    if (!error) cleared.push(table);
  }

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (!error) cleared.push('profiles');

  return cleared;
}

/**
 * Resolve the canonical auth user for a target. Prefers the SQL resolver RPC
 * (exact, O(1)); falls back to the Admin API if the RPC isn't deployed yet.
 */
async function resolveAuthUser(
  supabase: SupabaseAdmin,
  input: TargetInput,
): Promise<{ authUserId: string | null; email: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('resolve_auth_user_for_deletion', {
      p_user_id: input.userId ?? null,
      p_email: input.email ?? null,
    });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : null;
      return row
        ? { authUserId: row.auth_user_id as string, email: (row.auth_email as string) ?? null }
        : { authUserId: null, email: input.email?.toLowerCase() ?? null };
    }
    console.warn(`resolve_auth_user_for_deletion RPC unavailable (${error.message}); falling back to Admin API`);
  } catch (err) {
    console.warn(`resolve_auth_user_for_deletion RPC threw (${(err as Error).message}); falling back to Admin API`);
  }

  // Fallback 1: direct id lookup
  if (input.userId) {
    const { data, error } = await supabase.auth.admin.getUserById(input.userId);
    if (!error && data?.user) {
      return { authUserId: data.user.id, email: data.user.email?.toLowerCase() ?? null };
    }
  }

  // Fallback 2: paginated email scan
  if (input.email) {
    const wanted = input.email.toLowerCase();
    let page = 1;
    const perPage = 100;
    while (page <= 50) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) return { authUserId: null, email: wanted, error: `listUsers failed: ${error.message}` };
      const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
      if (hit) return { authUserId: hit.id, email: wanted };
      if (data.users.length < perPage) break;
      page++;
    }
  }

  return { authUserId: null, email: input.email?.toLowerCase() ?? null };
}

/** Outbox helpers — tolerate the table not existing yet (migration lag). */
async function enqueueRetry(
  supabase: SupabaseAdmin,
  authUserId: string | null,
  email: string | null,
  reason: string,
): Promise<boolean> {
  try {
    const orFilter = authUserId
      ? `auth_user_id.eq.${authUserId}`
      : `email.eq.${email}`;
    const { data: existing } = await supabase
      .from('auth_user_deletion_queue')
      .select('id, attempts')
      .eq('status', 'pending')
      .or(orFilter)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('auth_user_deletion_queue')
        .update({
          attempts: (existing[0].attempts as number) + 1,
          last_error: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
      return true;
    }

    const { error } = await supabase.from('auth_user_deletion_queue').insert({
      auth_user_id: authUserId,
      email,
      status: 'pending',
      attempts: 1,
      last_error: reason,
      source: 'delete_users_failure',
    });
    return !error;
  } catch (err) {
    console.warn(`enqueueRetry unavailable: ${(err as Error).message}`);
    return false;
  }
}

async function markQueueCompleted(
  supabase: SupabaseAdmin,
  authUserId: string | null,
  email: string | null,
) {
  try {
    const filters: string[] = [];
    if (authUserId) filters.push(`auth_user_id.eq.${authUserId}`);
    if (email) filters.push(`email.eq.${email}`);
    if (filters.length === 0) return;
    await supabase
      .from('auth_user_deletion_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .or(filters.join(','));
  } catch (err) {
    console.warn(`markQueueCompleted unavailable: ${(err as Error).message}`);
  }
}

/** Delete one resolved auth user: clear blockers, then admin.deleteUser. */
async function deleteResolvedAuthUser(
  supabase: SupabaseAdmin,
  authUserId: string,
): Promise<{ ok: boolean; stage?: 'clear_blockers' | 'auth_delete'; reason?: string; blockers?: Record<string, number> }> {
  try {
    const blockersBefore = await detectBlockers(supabase, authUserId);
    if (Object.keys(blockersBefore).length > 0) {
      console.log(`User ${authUserId} has blockers:`, blockersBefore);
      const cleared = await clearBlockers(supabase, authUserId);
      console.log(`Cleared blockers for ${authUserId}:`, cleared);
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(authUserId);
    if (authError) {
      const remaining = await detectBlockers(supabase, authUserId);
      return {
        ok: false,
        stage: 'auth_delete',
        reason: authError.message,
        blockers: Object.keys(remaining).length > 0 ? remaining : undefined,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, stage: 'auth_delete', reason: (err as Error).message };
  }
}

/** Drain pending outbox rows (queue-driven deletions with identity safety check). */
async function drainQueue(
  supabase: SupabaseAdmin,
  alreadyHandled: Set<string>,
  limit = 25,
): Promise<{ processed: number; completed: number; failed: number; remaining: number }> {
  const stats = { processed: 0, completed: 0, failed: 0, remaining: 0 };
  let rows: Array<{ id: string; auth_user_id: string | null; email: string | null; attempts: number }> = [];
  try {
    const { data, error } = await supabase
      .from('auth_user_deletion_queue')
      .select('id, auth_user_id, email, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    rows = data ?? [];
  } catch (err) {
    console.warn(`drainQueue unavailable: ${(err as Error).message}`);
    return stats;
  }

  for (const row of rows) {
    stats.processed++;
    const resolved = await resolveAuthUser(supabase, {
      userId: row.auth_user_id ?? undefined,
      email: row.email ?? undefined,
    });

    // Already gone (or handled earlier in this invocation) → done.
    if (!resolved.authUserId || alreadyHandled.has(resolved.authUserId)) {
      await supabase
        .from('auth_user_deletion_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id);
      stats.completed++;
      continue;
    }

    // Safety: never delete an auth user who still has application identity
    // rows — that means the app-level deletion never actually happened.
    let hasIdentityRows = false;
    for (const { table, column } of IDENTITY_SAFETY_CHECKS) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, resolved.authUserId);
      if (!error && count && count > 0) {
        hasIdentityRows = true;
        break;
      }
    }
    if (hasIdentityRows) {
      await supabase
        .from('auth_user_deletion_queue')
        .update({
          status: 'abandoned',
          last_error: 'Refused: user still has application identity rows (profiles/agent_profiles/user_roles)',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      console.warn(`Queue row ${row.id}: abandoned — ${resolved.authUserId} still has identity rows`);
      continue;
    }

    const result = await deleteResolvedAuthUser(supabase, resolved.authUserId);
    if (result.ok) {
      alreadyHandled.add(resolved.authUserId);
      await supabase
        .from('auth_user_deletion_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id);
      stats.completed++;
      console.log(`Queue row ${row.id}: deleted auth user ${resolved.authUserId}`);
    } else {
      await supabase
        .from('auth_user_deletion_queue')
        .update({
          attempts: row.attempts + 1,
          last_error: `${result.stage}: ${result.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      stats.failed++;
      console.warn(`Queue row ${row.id}: retry failed — ${result.stage}: ${result.reason}`);
    }
  }

  try {
    const { count } = await supabase
      .from('auth_user_deletion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    stats.remaining = count ?? 0;
  } catch { /* non-fatal */ }

  return stats;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // --- AuthN/AuthZ: admin caller, or internal service-role caller (cron) ---
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ success: false, deleted: 0, error: "Unauthorized: missing bearer token" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const jwt = authHeader.replace(/^[Bb]earer\s+/, "");
    const isInternalCaller = jwt === supabaseServiceKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isInternalCaller) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ success: false, deleted: 0, error: "Unauthorized: session invalid or expired" }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (roleErr || isAdmin !== true) {
        return new Response(JSON.stringify({ success: false, deleted: 0, error: "Forbidden: admin role required" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log(`delete-users authorized for admin ${userData.user.id}`);
    } else {
      console.log("delete-users invoked by internal service-role caller");
    }

    const body = await req.json().catch(() => ({}));
    const { userIds, emails, targets, processQueue } = body as {
      userIds?: string[];
      emails?: string[];
      targets?: TargetInput[];
      processQueue?: boolean;
    };

    // Normalize all input shapes into a target list
    const inputs: TargetInput[] = [];
    if (Array.isArray(targets)) {
      for (const t of targets) {
        if (t && (t.userId || t.email)) inputs.push({ userId: t.userId, email: t.email?.toLowerCase() });
      }
    }
    if (Array.isArray(userIds)) {
      for (const id of userIds) if (id) inputs.push({ userId: id });
    }
    if (Array.isArray(emails)) {
      for (const e of emails) if (e) inputs.push({ email: String(e).toLowerCase() });
    }

    if (inputs.length === 0 && !processQueue) {
      return new Response(JSON.stringify({
        success: false, deleted: 0,
        error: "No valid targets provided (userIds, emails, targets, or processQueue)",
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Resolve every input to a canonical auth user, dedupe by id ---
    const results: TargetResult[] = [];
    const resolvedIds = new Map<string, string | null>(); // authUserId -> email
    for (const input of inputs) {
      const resolved = await resolveAuthUser(supabase, input);
      if (resolved.error) {
        results.push({
          input, authUserId: null, email: resolved.email,
          status: 'failed', stage: 'resolve', reason: resolved.error,
          queuedForRetry: await enqueueRetry(supabase, null, resolved.email, resolved.error),
        });
        continue;
      }
      if (!resolved.authUserId) {
        // No auth account exists — nothing to delete (this is success for
        // Phase-3 leads and already-purged users).
        results.push({ input, authUserId: null, email: resolved.email, status: 'already_absent' });
        await markQueueCompleted(supabase, input.userId ?? null, resolved.email);
        continue;
      }
      if (!resolvedIds.has(resolved.authUserId)) {
        resolvedIds.set(resolved.authUserId, resolved.email);
      }
      results.push({ input, authUserId: resolved.authUserId, email: resolved.email, status: 'deleted' /* provisional */ });
    }

    // --- Delete each unique auth user ---
    const deletedIds = new Set<string>();
    const failedIds = new Map<string, { stage?: string; reason?: string; blockers?: Record<string, number>; queued: boolean }>();
    for (const [authUserId, email] of resolvedIds) {
      const outcome = await deleteResolvedAuthUser(supabase, authUserId);
      if (outcome.ok) {
        deletedIds.add(authUserId);
        await markQueueCompleted(supabase, authUserId, email);
        console.log(`Successfully deleted auth user: ${authUserId}`);
      } else {
        const queued = await enqueueRetry(supabase, authUserId, email, `${outcome.stage}: ${outcome.reason}`);
        failedIds.set(authUserId, { stage: outcome.stage, reason: outcome.reason, blockers: outcome.blockers, queued });
        console.error(`Failed to delete auth user ${authUserId}: ${outcome.stage}: ${outcome.reason}`);
      }
    }

    // Finalize per-target results
    for (const r of results) {
      if (!r.authUserId || r.status === 'already_absent' || r.status === 'failed') continue;
      if (deletedIds.has(r.authUserId)) {
        r.status = 'deleted';
      } else {
        const failure = failedIds.get(r.authUserId);
        r.status = 'failed';
        r.stage = (failure?.stage as TargetResult['stage']) ?? 'auth_delete';
        r.reason = failure?.reason ?? 'unknown error';
        r.blockers = failure?.blockers;
        r.queuedForRetry = failure?.queued ?? false;
      }
    }

    // --- Opportunistic queue drain (also the cron entry point) ---
    const queueStats = await drainQueue(supabase, deletedIds);

    // --- Clear orphaned pending_verifications rows for provided emails ---
    let pendingCleared = 0;
    const emailsForCleanup = inputs.map((i) => i.email).filter((e): e is string => Boolean(e));
    if (emailsForCleanup.length > 0) {
      const { data: pvRows, error: pvErr } = await supabase
        .from("pending_verifications")
        .update({ status: "rejected" })
        .in("email", emailsForCleanup)
        .eq("status", "pending")
        .select("id");
      if (pvErr) {
        console.log(`pending_verifications cleanup error: ${pvErr.message}`);
      } else {
        pendingCleared = pvRows?.length ?? 0;
      }
    }

    const failedResults = results.filter((r) => r.status === 'failed');
    const fullyDeleted = failedResults.length === 0;
    const partialFailure = !fullyDeleted && results.some((r) => r.status !== 'failed');

    return new Response(JSON.stringify({
      success: true, // request processed; per-target outcomes below
      fullyDeleted,
      partialFailure,
      deleted: deletedIds.size,
      deletedUserIds: Array.from(deletedIds),
      results,
      queue: queueStats,
      pendingVerificationsCleared: pendingCleared,
      message: fullyDeleted
        ? `Deleted ${deletedIds.size} auth account(s); ${results.filter((r) => r.status === 'already_absent').length} already absent`
        : `Deleted ${deletedIds.size} auth account(s); ${failedResults.length} failed (${failedResults.every((r) => r.queuedForRetry) ? 'queued for automatic retry' : 'retry queue unavailable'})`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Error in delete-users function:", error);
    return new Response(JSON.stringify({
      success: false, deleted: 0, error: (error as Error).message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
