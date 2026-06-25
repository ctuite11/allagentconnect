/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyTurnstileToken, TURNSTILE_GENERIC_ERROR } from "../_shared/verifyTurnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitePayload = {
  type?: string;
  client_id?: string;
  client_email?: string;
  client_first_name?: string;
  client_last_name?: string;
  client_phone?: string;
  hot_sheet_id?: string;
};

type RequestBody = {
  token?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  /** When true, user must already exist and password is verified (not overwritten). */
  existingAccount?: boolean;
  turnstile_token?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  const target = normalizeEmail(email);
  // Authoritative lookup via service role SQL on auth.users
  try {
    const { data, error } = await admin
      .schema("auth" as never)
      .from("users" as never)
      .select("id, email")
      .ilike("email", target)
      .limit(1)
      .maybeSingle();
    if (!error && data && (data as { id: string }).id) {
      return { id: (data as { id: string }).id, email: (data as { email: string }).email } as { id: string; email: string };
    }
  } catch (_e) {
    // fall through to pagination
  }
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => normalizeEmail(u.email ?? "") === target);
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function activateRelationshipForBuyer(
  admin: SupabaseClient,
  clientId: string,
  agentId: string,
  crmClientId: string | null,
): Promise<string | null> {
  const nullUuid = "00000000-0000-0000-0000-000000000000";

  const { data: otherActiveRows } = await admin
    .from("client_agent_relationships")
    .select("id, agent_id, crm_client_id")
    .eq("client_id", clientId)
    .is("ended_at", null)
    .eq("status", "active");

  for (const row of otherActiveRows ?? []) {
    const samePair =
      row.agent_id === agentId &&
      String(row.crm_client_id ?? nullUuid) === String(crmClientId ?? nullUuid);
    if (!samePair) {
      await admin
        .from("client_agent_relationships")
        .update({ status: "inactive", ended_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  let existingId: string | null = null;

  if (crmClientId) {
    const { data: byCrm } = await admin
      .from("client_agent_relationships")
      .select("id")
      .eq("agent_id", agentId)
      .eq("crm_client_id", crmClientId)
      .is("ended_at", null)
      .maybeSingle();
    existingId = byCrm?.id ?? null;
  }

  if (!existingId) {
    const { data: byClientAgent } = await admin
      .from("client_agent_relationships")
      .select("id, status")
      .eq("client_id", clientId)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingId = byClientAgent?.id ?? null;
  }

  if (!existingId && crmClientId) {
    const { data: endedRow } = await admin
      .from("client_agent_relationships")
      .select("id")
      .eq("agent_id", agentId)
      .eq("crm_client_id", crmClientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingId = endedRow?.id ?? null;
  }

  if (existingId) {
    const { error } = await admin
      .from("client_agent_relationships")
      .update({
        status: "active",
        ended_at: null,
        client_id: clientId,
        crm_client_id: crmClientId,
      })
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data: inserted, error: insertError } = await admin
    .from("client_agent_relationships")
    .insert({
      client_id: clientId,
      agent_id: agentId,
      status: "active",
      created_at: new Date().toISOString(),
      ended_at: null,
      crm_client_id: crmClientId,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted?.id ?? null;
}

serve(async (req) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[accept-client-hot-sheet-invite] missing required environment variables", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return json({ success: false, error: "Invite acceptance is temporarily unavailable" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  // Server-side Cloudflare Turnstile verification — blocks direct API abuse.
  const turnstileResult = await verifyTurnstileToken(body.turnstile_token, req);
  if (!turnstileResult.ok) {
    return json({ success: false, error: TURNSTILE_GENERIC_ERROR }, 403);
  }

  const token = body.token?.trim();
  const email = body.email ? normalizeEmail(body.email) : "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const password = body.password ?? "";
  const existingAccount = body.existingAccount === true;

  if (!token) return json({ success: false, error: "token is required" }, 400);
  if (!email) return json({ success: false, error: "email is required" }, 400);
  if (!firstName || !lastName) return json({ success: false, error: "first and last name are required" }, 400);
  if (!password || password.length < 8) {
    return json({ success: false, error: "Password must be at least 8 characters" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("share_tokens")
    .select("id, token, agent_id, payload, accepted_at, accepted_by_user_id, revoked_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return json({ success: false, error: "Invalid invite token" }, 400);
  }

  if (tokenRow.revoked_at) {
    return json({ success: false, error: "This invite has been revoked" }, 400);
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return json({ success: false, error: "This invite has expired" }, 400);
  }

  const payload = (tokenRow.payload ?? null) as InvitePayload | null;
  if (!payload || payload.type !== "client_hotsheet_invite") {
    return json({ success: false, error: "Invalid invite type" }, 400);
  }

  const inviteEmail = payload.client_email ? normalizeEmail(payload.client_email) : "";
  if (!inviteEmail) {
    return json({ success: false, error: "Invite is missing recipient email" }, 400);
  }
  if (email !== inviteEmail) {
    return json({ success: false, error: "Email does not match this invitation" }, 403);
  }

  const agentId = String(tokenRow.agent_id ?? "").trim();
  const crmClientId = payload.client_id ? String(payload.client_id).trim() : null;
  if (!agentId) {
    return json({ success: false, error: "Invite is missing agent context" }, 400);
  }

  let userId: string;
  let alreadyAccepted = false;

  if (tokenRow.accepted_at && tokenRow.accepted_by_user_id) {
    userId = String(tokenRow.accepted_by_user_id);
    alreadyAccepted = true;

    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!existingUser || existingUser.id !== userId) {
      return json({ success: false, error: "This invite has already been used" }, 400);
    }

    if (existingAccount) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
      if (signInError) {
        return json({ success: false, error: "Invalid password" }, 401);
      }
    }
  } else {
    let authUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (authUser) {
      if (existingAccount) {
        const anonClient = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
        if (signInError) {
          return json({ success: false, error: "Invalid password" }, 401);
        }
      } else {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            phone: payload.client_phone ?? null,
            intended_role: "buyer",
          },
        });
        if (updateError) {
          console.error("Password update failed:", updateError);
          return json({ success: false, error: "Could not update account password" }, 500);
        }
      }
      userId = authUser.id;
    } else {
      if (existingAccount) {
        return json({ success: false, error: "No account exists for this email. Create a password instead." }, 404);
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone: payload.client_phone ?? null,
          intended_role: "buyer",
        },
      });

      if (createError || !created?.user) {
        const msg = createError?.message ?? "Failed to create account";
        const isExists =
          (createError as { code?: string } | null)?.code === "email_exists" ||
          msg.toLowerCase().includes("already");

        if (isExists) {
          // Try cleaning up stale auth.identities rows that block account creation:
          // 1) orphan identity rows with no auth.users row, and
          // 2) identity rows whose email matches this buyer invite but are attached to a different auth user email.
          try {
            const { data: orphanCleanedCount, error: orphanCleanupError } = await supabaseAdmin.rpc(
              "cleanup_orphan_auth_identity",
              { _email: email },
            );
            if (orphanCleanupError) {
              console.error("[accept-client-hot-sheet-invite] orphan cleanup RPC failed", orphanCleanupError);
            }

            const { data: blockingCleanedCount, error: blockingCleanupError } = await supabaseAdmin.rpc(
              "cleanup_blocking_auth_identity",
              { _email: email },
            );
            if (blockingCleanupError) {
              console.error("[accept-client-hot-sheet-invite] blocking identity cleanup RPC failed", blockingCleanupError);
            }

            const cleanedCount =
              (typeof orphanCleanedCount === "number" ? orphanCleanedCount : 0) +
              (typeof blockingCleanedCount === "number" ? blockingCleanedCount : 0);

            if (cleanedCount <= 0) {
              // No stale identity was removed — a real live account exists for this email.
              return json({ success: false, error: "Account already exists", code: "existing_account" }, 409);
            }

            const retry = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                first_name: firstName,
                last_name: lastName,
                phone: payload.client_phone ?? null,
                intended_role: "buyer",
              },
            });
            if (!retry.error && retry.data?.user) {
              userId = retry.data.user.id;
            } else {
              console.error("[accept-client-hot-sheet-invite] retry after identity cleanup failed", retry.error);
              return json({ success: false, error: "Account already exists", code: "existing_account" }, 409);
            }
          } catch (cleanupErr) {
            console.error("[accept-client-hot-sheet-invite] identity cleanup error", cleanupErr);
            return json({ success: false, error: "Account already exists", code: "existing_account" }, 409);
          }
        } else {
          console.error("Auth user creation failed:", createError);
          return json({ success: false, error: msg }, 500);
        }
      } else {
        userId = created.user.id;
      }
    }
  }

  const profilePayload = {
    email,
    first_name: firstName || payload.client_first_name?.trim() || null,
    last_name: lastName || payload.client_last_name?.trim() || null,
    phone: payload.client_phone?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile?.id) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profilePayload)
      .eq("id", userId);
    if (profileError) {
      console.error("Profile update failed:", profileError);
      return json({ success: false, error: "Failed to update buyer profile" }, 500);
    }
  } else {
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      ...profilePayload,
    });
    if (profileError) {
      console.error("Profile insert failed:", profileError);
      return json({ success: false, error: "Failed to create buyer profile" }, 500);
    }
  }

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: "buyer" });

  if (roleError && !String(roleError.message ?? "").includes("duplicate") && roleError.code !== "23505") {
    console.error("Buyer role assignment failed:", roleError);
    return json({ success: false, error: "Failed to assign buyer role" }, 500);
  }

  try {
    await activateRelationshipForBuyer(supabaseAdmin, userId, agentId, crmClientId);
  } catch (relError) {
    console.error("Relationship activation failed:", relError);
    return json({ success: false, error: "Failed to activate agent relationship" }, 500);
  }

  const hotSheetId = payload.hot_sheet_id ? String(payload.hot_sheet_id).trim() : "";
  if (hotSheetId && crmClientId) {
    const { error: hscError } = await supabaseAdmin
      .from("hot_sheet_clients")
      .upsert(
        { hot_sheet_id: hotSheetId, client_id: crmClientId },
        { onConflict: "hot_sheet_id,client_id", ignoreDuplicates: true },
      );

    if (hscError) {
      console.error("[accept-client-hot-sheet-invite] hot_sheet_clients link failed:", hscError);
      return json({ success: false, error: "Failed to link accepted hot sheet to buyer account" }, 500);
    }
  }

  if (!tokenRow.accepted_at) {
    const { error: tokenUpdateError } = await supabaseAdmin
      .from("share_tokens")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq("id", tokenRow.id)
      .is("accepted_at", null);

    if (tokenUpdateError) {
      console.error("Token acceptance update failed:", tokenUpdateError);
      return json({ success: false, error: "Account ready but invite token could not be finalized" }, 500);
    }
  }

  return json({
    success: true,
    userId,
    agentId,
    crmClientId,
    hotSheetId: hotSheetId || null,
    alreadyAccepted,
  });
  } catch (error) {
    console.error("[accept-client-hot-sheet-invite] unhandled runtime error", error);
    return json({ success: false, error: "Invite acceptance failed. Please try again." }, 500);
  }
});
