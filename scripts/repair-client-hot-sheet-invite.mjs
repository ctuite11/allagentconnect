#!/usr/bin/env node
/**
 * Repair / test client hot sheet invite acceptance for a buyer email.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/repair-client-hot-sheet-invite.mjs tuite.chris11@gmail.com \
 *     --first-name Chris --last-name Tuite --password 'YourSecurePass1!'
 *
 * Optional:
 *   --token <share_tokens.token>   Skip lookup and use this token directly
 *   --dry-run                      Print invite state only; do not call accept function
 *   --verify-only                  After accept, print validation checklist
 *
 * Requires the `accept-client-hot-sheet-invite` edge function to be deployed.
 */

import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function normalizeEmail(raw) {
  return String(raw ?? "").trim().toLowerCase();
}

async function findAuthUserByEmail(admin, email) {
  const target = normalizeEmail(email);
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

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const email = normalizeEmail(positional[0]);
  if (!email) {
    console.error("Usage: node scripts/repair-client-hot-sheet-invite.mjs <email> [--token ...] [--first-name ...] [--last-name ...] [--password ...]");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let token = flags.token ? String(flags.token).trim() : null;
  let tokenRow = null;

  if (token) {
    const { data, error } = await admin
      .from("share_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) throw error;
    tokenRow = data;
  } else {
    const { data, error } = await admin
      .from("share_tokens")
      .select("*")
      .is("revoked_at", null)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    tokenRow = (data ?? []).find((row) => {
      const payload = row.payload ?? {};
      if (payload.type !== "client_hotsheet_invite") return false;
      return normalizeEmail(payload.client_email ?? "") === email;
    }) ?? null;
    token = tokenRow?.token ?? null;
  }

  console.log("\n=== Invite state ===");
  if (!tokenRow) {
    console.log("No outstanding client_hotsheet_invite token found for", email);
  } else {
    const payload = tokenRow.payload ?? {};
    console.log("token:", tokenRow.token);
    console.log("agent_id:", tokenRow.agent_id);
    console.log("crm_client_id:", payload.client_id ?? "(missing)");
    console.log("accepted_at:", tokenRow.accepted_at ?? "(null)");
    console.log("revoked_at:", tokenRow.revoked_at ?? "(null)");
  }

  const authUser = await findAuthUserByEmail(admin, email);
  console.log("\n=== Auth user ===");
  console.log(authUser ? `exists: ${authUser.id}` : "none");

  if (tokenRow?.payload?.client_id) {
    const crmClientId = String(tokenRow.payload.client_id);
    const { data: rel } = await admin
      .from("client_agent_relationships")
      .select("id, status, client_id, crm_client_id, ended_at")
      .eq("agent_id", tokenRow.agent_id)
      .eq("crm_client_id", crmClientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("\n=== Relationship ===");
    console.log(rel ?? "none");
  }

  if (flags["dry-run"]) {
    console.log("\nDry run — no changes made.");
    return;
  }

  const password = flags.password ? String(flags.password) : null;
  const firstName = flags["first-name"] ? String(flags["first-name"]) : null;
  const lastName = flags["last-name"] ? String(flags["last-name"]) : null;

  if (!token || !password || !firstName || !lastName) {
    console.log("\nTo accept/repair, pass --first-name, --last-name, --password (and optionally --token).");
    return;
  }

  const fnUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/accept-client-hot-sheet-invite`;
  const response = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      token,
      email,
      firstName,
      lastName,
      password,
      existingAccount: Boolean(authUser),
    }),
  });

  const result = await response.json();
  console.log("\n=== Accept function response ===");
  console.log(JSON.stringify(result, null, 2));

  if (!response.ok || !result.success) {
    process.exit(1);
  }

  if (flags["verify-only"] || result.success) {
    const userId = result.userId;
    const agentId = result.agentId;
    const crmClientId = result.crmClientId;

    const checks = {};
    checks.authUser = Boolean(await findAuthUserByEmail(admin, email));
    const { data: profile } = await admin.from("profiles").select("id, email").eq("id", userId).maybeSingle();
    checks.profile = Boolean(profile);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "buyer").maybeSingle();
    checks.buyerRole = Boolean(role);
    const { data: relationship } = await admin
      .from("client_agent_relationships")
      .select("status, client_id, crm_client_id")
      .eq("agent_id", agentId)
      .eq("crm_client_id", crmClientId)
      .eq("client_id", userId)
      .eq("status", "active")
      .maybeSingle();
    checks.activeRelationship = Boolean(relationship);
    checks.relationshipClientId = relationship?.client_id ?? null;
    const { data: acceptedToken } = await admin
      .from("share_tokens")
      .select("accepted_at, accepted_by_user_id")
      .eq("token", token)
      .maybeSingle();
    checks.tokenAccepted = Boolean(acceptedToken?.accepted_at);

    console.log("\n=== Validation checklist ===");
    for (const [key, value] of Object.entries(checks)) {
      console.log(`${key}:`, value);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
