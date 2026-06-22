#!/usr/bin/env node
/**
 * Read-only verification for a buyer/contact CRM row (e.g. Debbie test case).
 *
 * Usage (service role — full cross-table read):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/verify-buyer-contact-row.mjs --client-id <uuid>
 *
 * Usage (agent JWT — matches in-app verify_buyer_contact_row RPC):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_ACCESS_TOKEN=... \
 *   node scripts/verify-buyer-contact-row.mjs --client-id <uuid> --agent
 *
 * Find by name (service role only):
 *   node scripts/verify-buyer-contact-row.mjs --name Debbie --agent-id <uuid>
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

async function resolveClientId(admin, flags) {
  if (flags["client-id"]) return String(flags["client-id"]).trim();

  const name = String(flags.name ?? flags["first-name"] ?? "").trim();
  if (!name) {
    throw new Error("Provide --client-id <uuid> or --name <first name> (with --agent-id for name lookup).");
  }

  const agentId = flags["agent-id"] ? String(flags["agent-id"]).trim() : null;
  let query = admin
    .from("clients")
    .select("id, first_name, last_name, email, agent_id")
    .ilike("first_name", name);

  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(5);
  if (error) throw error;

  if (!data?.length) {
    throw new Error(`No clients found matching first name "${name}".`);
  }
  if (data.length > 1 && !agentId) {
    console.warn("Multiple matches — pass --agent-id or use --client-id:");
    for (const row of data) {
      console.warn(`  ${row.id}  ${row.first_name} ${row.last_name}  ${row.email}  agent=${row.agent_id}`);
    }
    throw new Error("Ambiguous name lookup.");
  }

  const match = data[0];
  console.log(`Resolved client: ${match.first_name} ${match.last_name} <${match.email}> (${match.id})`);
  return match.id;
}

async function verifyWithServiceRole(admin, clientId, agentId) {
  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("id, agent_id, first_name, last_name, email, phone, client_type, created_at")
    .eq("id", clientId)
    .maybeSingle();
  if (clientErr) throw clientErr;
  if (!client) {
    return { found: false, crm_client_id: clientId };
  }

  const scopedAgentId = agentId ?? client.agent_id;

  const [relationships, hotSheetMembershipsRaw, ownedHotSheets, shareTokensRaw] = await Promise.all([
    admin
      .from("client_agent_relationships")
      .select("id, agent_id, status, client_id, crm_client_id, ended_at, created_at")
      .eq("agent_id", scopedAgentId)
      .or(`crm_client_id.eq.${clientId},client_id.eq.${clientId}`)
      .order("created_at", { ascending: false }),
    admin
      .from("hot_sheet_clients")
      .select("hot_sheet_id, hot_sheets(id, title, user_id)")
      .eq("client_id", clientId),
    admin
      .from("hot_sheets")
      .select("id, title, created_at")
      .eq("user_id", scopedAgentId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    admin
      .from("share_tokens")
      .select("id, accepted_at, revoked_at, created_at, payload")
      .eq("agent_id", scopedAgentId)
      .filter("payload->>type", "eq", "client_hotsheet_invite"),
  ]);

  const normalizedEmail = String(client.email ?? "").trim().toLowerCase();
  const shareTokens = (shareTokensRaw.data ?? []).filter((t) => {
    const payload = t.payload ?? {};
    const payloadClientId = String(payload.client_id ?? "").trim();
    const payloadEmail = String(payload.client_email ?? "").trim().toLowerCase();
    return payloadClientId === clientId || (normalizedEmail && payloadEmail === normalizedEmail);
  });

  const hotSheetMemberships = (hotSheetMembershipsRaw.data ?? []).filter(
    (row) => row.hot_sheets?.user_id === scopedAgentId,
  );

  const relRows = relationships.data ?? [];
  const activeRelCount = relRows.filter(
    (r) => !r.ended_at && (r.status === "active" || r.status === "pending"),
  ).length;

  return {
    found: true,
    crm_client_id: clientId,
    agent_id: scopedAgentId,
    client,
    relationships: relRows,
    active_relationship_count: activeRelCount,
    hot_sheet_memberships: hotSheetMemberships.map((row) => ({
      hot_sheet_id: row.hot_sheet_id,
      hot_sheet_title: row.hot_sheets?.title ?? null,
    })),
    owned_hot_sheets: ownedHotSheets.data ?? [],
    share_tokens: shareTokens.map((t) => ({
      id: t.id,
      accepted_at: t.accepted_at,
      revoked_at: t.revoked_at,
      created_at: t.created_at,
    })),
  };
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl) throw new Error("SUPABASE_URL is required.");

  const clientId = await (async () => {
    if (!flags["client-id"] && (flags.name || flags["first-name"])) {
      if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY required for --name lookup.");
      const admin = createClient(supabaseUrl, serviceKey);
      return resolveClientId(admin, flags);
    }
    if (!flags["client-id"]) {
      throw new Error("Provide --client-id or --name.");
    }
    return String(flags["client-id"]).trim();
  })();

  let result;

  if (flags.agent) {
    if (!anonKey || !accessToken) {
      throw new Error("For --agent mode set SUPABASE_ANON_KEY and SUPABASE_ACCESS_TOKEN.");
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await userClient.rpc("verify_buyer_contact_row", {
      p_crm_client_id: clientId,
    });
    if (error) throw error;
    result = data;
  } else {
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
    const admin = createClient(supabaseUrl, serviceKey);
    result = await verifyWithServiceRole(
      admin,
      clientId,
      flags["agent-id"] ? String(flags["agent-id"]).trim() : undefined,
    );
  }

  console.log("\n=== verify_buyer_contact_row ===");
  console.log(JSON.stringify(result, null, 2));

  if (result?.found) {
    console.log("\n=== Summary ===");
    console.log(`contact: ${result.client?.first_name ?? ""} ${result.client?.last_name ?? ""}`);
    console.log(`email: ${result.client?.email ?? "—"}`);
    console.log(`client_type: ${result.client?.client_type ?? "—"}`);
    console.log(
      `active relationships: ${result.active_relationship_count ?? result.activeRelationshipCount ?? 0}`,
    );
    const memberships = result.hot_sheet_memberships ?? [];
    const owned = result.owned_hot_sheets ?? [];
    console.log(`hot sheet memberships: ${memberships.length}`);
    console.log(`owned hot sheets: ${owned.length}`);
    const tokens = result.share_tokens ?? [];
    const pendingTokens = tokens.filter((t) => !t.accepted_at && !t.revoked_at).length;
    console.log(`invite tokens (pending): ${pendingTokens}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
