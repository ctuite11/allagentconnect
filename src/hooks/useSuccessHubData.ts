import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface SuccessHubSummary {
  agentId: string;

  profile: {
    first_name: string;
    last_name: string;
    headshot_url: string | null;
    company: string | null;
    title: string | null;
  } | null;

  metrics: {
    pendingInviteCount: number;
    activeHotSheetCount: number;
    activeBuyerCount: number;
    unreadMessageCount: number;
  };

  attentionItems: Array<{
    id: string;
    type: "invite" | "message" | "hotsheet" | "listing";
    label: string;
    sub: string;
    path: string;
    count: number;
  }>;

  listings: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    status: string;
    photos: (string | { url: string })[] | null;
    price: number | null;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    view_count: number;
    showing_request_count: number;
    neighborhood?: string | null;
  }>;

  hotSheets: Array<{
    id: string;
    name: string;
    buyerCount: number;
    pendingInviteCount: number;
    lastUpdated: string;
  }>;

  buyers: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    status: "active" | "pending";
    hotSheetCount: number;
    favoriteCount: number;
    lastActivity: string | null;
    hasUnread: boolean;
    attentionNote: string | null;
  }>;

  conversations: Array<{
    conversation_id: string;
    last_message_preview: string | null;
    last_message_at: string;
    is_unread: boolean;
    other_user_id: string | null;
    other_name: string | null;
    other_headshot_url: string | null;
  }>;

  activity: Array<{
    id: string;
    description: string;
    timestamp: string;
    icon: "invite" | "match" | "message" | "listing";
  }>;
}

/** Safe shell when load fails or before first paint — never omit fields consumers read. */
export const EMPTY_SUCCESS_HUB_SUMMARY: SuccessHubSummary = {
  agentId: "",
  profile: null,
  metrics: {
    pendingInviteCount: 0,
    activeHotSheetCount: 0,
    activeBuyerCount: 0,
    unreadMessageCount: 0,
  },
  attentionItems: [],
  listings: [],
  hotSheets: [],
  buyers: [],
  conversations: [],
  activity: [],
};

export type UseSuccessHubDataResult = {
  loading: boolean;
  error: string | null;
  /** Always a full object — use when you need `summary.metrics` etc. without optional chaining. */
  summary: SuccessHubSummary;
  buyers: SuccessHubSummary["buyers"];
  listings: SuccessHubSummary["listings"];
  conversations: SuccessHubSummary["conversations"];
  communications: SuccessHubSummary["conversations"];
  /** Reserved; market cards load inside `MarketActivityRow`. Always []. */
  marketActivity: [];
  refetch: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function safeLowerEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.toLowerCase() : null;
}

/** `client_agent_relationships` may use `client_id` and/or `crm_client_id` for the same `clients` row. */
function resolveRelationshipClientId(row: {
  client_id?: string | null;
  crm_client_id?: string | null;
}): string | null {
  const raw = row?.client_id ?? row?.crm_client_id;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

/** Belt+suspenders: log warn for malformed tokens but don't crash */
function validateTokenPayload(t: any, context: string): void {
  const p = t?.payload ?? {};
  if (!p.type) {
    console.warn(`[SuccessHubData] ${context}: token ${t?.id} is missing payload.type`, t?.payload);
  }
  if (p.type === "client_hotsheet_invite" && !p.hot_sheet_id) {
    console.warn(
      `[SuccessHubData] ${context}: hotsheet invite token ${t?.id} is missing payload.hot_sheet_id`,
      t?.payload
    );
  }
}

function logQueryError(label: string, error: any): void {
  if (!error) return;
  console.warn(`[SuccessHubData] Query error — ${label}:`, error.message ?? error);
}

/** Supabase helpers sometimes return undefined; never read `.error` without a guard. */
function supabaseResult<T>(result: { data?: T; error?: unknown; count?: unknown } | null | undefined) {
  const { data = undefined, error = null, count = null } = result ?? {};
  return { data: data as T, error, count };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSuccessHubData(): UseSuccessHubDataResult {
  const [summary, setSummary] = useState<SuccessHubSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadIdRef = useRef(0);

  const loadAll = useCallback(async () => {
    const myLoadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);

    try {
      // ── Auth ────────────────────────────────────────────────────────────────
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error(userErr?.message ?? "Not authenticated");
      const agentId = user.id;

      const since30d = daysAgoISO(30);

      // ── Wave 1 (parallel) ────────────────────────────────────────────────────
      const [
        profileRes,
        unacceptedTokensRes,
        hotSheetsPreviewRes,
        hotSheetsCountRes,
        listingsPreviewRes,
        relationshipsBuyersPreviewRes,
        allAgentHotSheetsRes,
        relationshipsActiveCountRes,
        inboxPreviewRes,
        inboxUnreadCountRes,
        acceptedTokens30dRes,
        clients30dRes,
        messages30dRes,
      ] = await Promise.all([
        // Agent profile
        supabase
          .from("agent_profiles")
          .select("first_name,last_name,headshot_url,company,title")
          .eq("id", agentId)
          .maybeSingle(),

        // Unaccepted tokens — NO top-level type/client_id/client_email columns on share_tokens
        // Those fields only exist inside payload JSONB. Filter type in JS.
        supabase
          .from("share_tokens")
          .select("id,agent_id,accepted_at,payload,created_at")
          .eq("agent_id", agentId)
          .is("accepted_at", null),

        // Hot sheets preview (for display)
        supabase
          .from("hot_sheets")
          .select("id,name,updated_at,is_active,user_id")
          .eq("user_id", agentId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(5),

        // Hot sheets count metric (prefer count query over relying on preview length)
        supabase
          .from("hot_sheets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", agentId)
          .eq("is_active", true),

        // Listings preview — listings table uses agent_id (NOT user_id)
        supabase
          .from("listings")
          .select(
            "id,address,city,state,zip_code,neighborhood,status,photos,price,updated_at,property_type,bedrooms,bathrooms,square_feet,listing_stats(view_count,showing_request_count)",
          )
          .eq("agent_id", agentId)
          .in("status", ["active", "pending", "coming_soon", "off_market"])
          .order("updated_at", { ascending: false })
          .limit(12),

        // Buyer relationships (active + pending)
        supabase
          .from("client_agent_relationships")
          .select("id,client_id,crm_client_id,agent_id,status,created_at")
          .eq("agent_id", agentId)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false })
          .limit(100),

        // All agent hot sheet IDs — merge buyers linked via hot_sheet_clients (even if CRM row used only crm_client_id)
        supabase.from("hot_sheets").select("id").eq("user_id", agentId),

        supabase
          .from("client_agent_relationships")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .eq("status", "active"),

        // Conversation inbox preview (view is already user-scoped by RLS)
        supabase
          .from("conversation_inbox")
          .select("conversation_id,last_message_preview,last_message_at,is_unread,other_user_id")
          .order("last_message_at", { ascending: false })
          .limit(12),

        // Unread message count (view is already user-scoped)
        supabase
          .from("conversation_inbox")
          .select("conversation_id", { count: "exact", head: true })
          .eq("is_unread", true),

        // Accepted invites (last 30d) — for activity feed
        supabase
          .from("share_tokens")
          .select("id,accepted_at,payload,created_at")
          .eq("agent_id", agentId)
          .not("accepted_at", "is", null)
          .gte("accepted_at", since30d)
          .order("accepted_at", { ascending: false })
          .limit(25),

        // Recent clients added — for activity feed
        supabase
          .from("clients")
          .select("id,email,first_name,last_name,created_at")
          .eq("agent_id", agentId)
          .gte("created_at", since30d)
          .order("created_at", { ascending: false })
          .limit(25),

        // Recent messages received — conversation_messages uses recipient_agent_id (NOT to_user_id)
        supabase
          .from("conversation_messages")
          .select("id,created_at,sender_agent_id,recipient_agent_id,body")
          .eq("recipient_agent_id", agentId)
          .gte("created_at", since30d)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      if (!mountedRef.current || loadIdRef.current !== myLoadId) return;

      // Log non-fatal query errors; do not throw
      logQueryError("agent_profiles", profileRes?.error ?? null);
      logQueryError("share_tokens(unaccepted)", unacceptedTokensRes?.error ?? null);
      logQueryError("hot_sheets(preview)", hotSheetsPreviewRes?.error ?? null);
      logQueryError("hot_sheets(count)", hotSheetsCountRes?.error ?? null);
      logQueryError("listings(preview)", listingsPreviewRes?.error ?? null);
      logQueryError("client_agent_relationships(preview)", relationshipsBuyersPreviewRes?.error ?? null);
      logQueryError("hot_sheets(all ids agent)", allAgentHotSheetsRes?.error ?? null);
      logQueryError("client_agent_relationships(active count)", relationshipsActiveCountRes?.error ?? null);
      logQueryError("conversation_inbox(preview)", inboxPreviewRes?.error ?? null);
      logQueryError("conversation_inbox(unread count)", inboxUnreadCountRes?.error ?? null);
      logQueryError("share_tokens(accepted 30d)", acceptedTokens30dRes?.error ?? null);
      logQueryError("clients(30d)", clients30dRes?.error ?? null);
      logQueryError("conversation_messages(30d)", messages30dRes?.error ?? null);

      // ── Derive Wave 1 values ─────────────────────────────────────────────────

      const profileData = profileRes?.data;
      const profile = profileData
        ? {
            first_name: (profileData as any).first_name ?? "",
            last_name: (profileData as any).last_name ?? "",
            headshot_url: (profileData as any).headshot_url ?? null,
            company: (profileData as any).company ?? null,
            title: (profileData as any).title ?? null,
          }
        : null;

      // Pending invite tokens: filter by payload.type in JS (no top-level type column)
      const unacceptedTokens = (unacceptedTokensRes?.data ?? []) as any[];
      unacceptedTokens.forEach((t) => validateTokenPayload(t, "unaccepted tokens"));

      const pendingInviteTokens = unacceptedTokens.filter((t) => {
        const p = t?.payload ?? {};
        return p?.type === "client_hotsheet_invite" && !t?.accepted_at;
      });
      const pendingInviteCount = pendingInviteTokens.length;

      const pendingInviteEmails = new Set<string>();
      for (const t of pendingInviteTokens) {
        const em = safeLowerEmail((t as any)?.payload?.client_email);
        if (em) pendingInviteEmails.add(em);
      }

      const hotSheetExactCount = hotSheetsCountRes?.count;
      const activeHotSheetCount =
        (typeof hotSheetExactCount === "number" ? hotSheetExactCount : null) ??
        ((hotSheetsPreviewRes?.data ?? []) as any[]).length;

      const { count: activeRelCount } = supabaseResult(relationshipsActiveCountRes as any);
      const activeBuyerCount = typeof activeRelCount === "number" ? activeRelCount : 0;

      const { count: unreadInboxCount } = supabaseResult(inboxUnreadCountRes as any);
      const unreadMessageCount = typeof unreadInboxCount === "number" ? unreadInboxCount : 0;

      // Listings preview: listing_stats may be array or object depending on join type
      const listingsBase = ((listingsPreviewRes?.data ?? []) as any[]).map((l) => {
        const stats = Array.isArray(l.listing_stats)
          ? l.listing_stats[0]
          : l.listing_stats;
        return {
          id: String(l.id),
          address: l.address ?? "",
          city: l.city ?? "",
          state: l.state ?? "",
          zip_code: typeof l.zip_code === "string" ? l.zip_code : "",
          status: l.status ?? "",
          photos: (l.photos as string[] | null) ?? null,
          price: typeof l.price === "number" ? l.price : null,
          property_type: typeof l.property_type === "string" ? l.property_type : null,
          bedrooms: typeof l.bedrooms === "number" ? l.bedrooms : null,
          bathrooms: typeof l.bathrooms === "number" ? l.bathrooms : null,
          square_feet: typeof l.square_feet === "number" ? l.square_feet : null,
          neighborhood: typeof l.neighborhood === "string" ? l.neighborhood : null,
          view_count: typeof stats?.view_count === "number" ? stats.view_count : 0,
          showing_request_count:
            typeof stats?.showing_request_count === "number"
              ? stats.showing_request_count
              : 0,
        };
      });

      // Hot sheets base
      const hotSheetsBase = ((hotSheetsPreviewRes?.data ?? []) as any[]).map((hs) => ({
        id: String(hs.id),
        name: hs.name ?? "Hot Sheet",
        buyerCount: 0,
        pendingInviteCount: 0,
        lastUpdated: hs.updated_at ?? new Date().toISOString(),
      }));

      // Buyers: relationships (`client_id` or `crm_client_id`) + anyone on agent hot sheets via hot_sheet_clients
      const buyerRelationshipRows = (relationshipsBuyersPreviewRes?.data ?? []) as any[];
      const buyersById = new Map<string, SuccessHubSummary["buyers"][0]>();

      for (const r of buyerRelationshipRows) {
        const cid = resolveRelationshipClientId(r);
        if (!cid || buyersById.has(cid)) continue;
        const status = r?.status === "pending" ? "pending" : "active";
        buyersById.set(cid, {
          id: cid,
          first_name: null,
          last_name: null,
          email: "",
          phone: null as string | null,
          status,
          hotSheetCount: 0,
          favoriteCount: 0,
          lastActivity: null,
          hasUnread: false,
          attentionNote: null as string | null,
        });
      }

      const allHotSheetIds = ((allAgentHotSheetsRes?.data ?? []) as any[]).map((row) => String(row.id));
      if (allHotSheetIds.length > 0) {
        const hscAgentSheetsRes = await supabase
          .from("hot_sheet_clients")
          .select("client_id")
          .in("hot_sheet_id", allHotSheetIds);
        if (!mountedRef.current || loadIdRef.current !== myLoadId) return;
        logQueryError("hot_sheet_clients(agent hot sheets)", hscAgentSheetsRes?.error ?? null);
        const hscRows = (hscAgentSheetsRes?.data ?? []) as any[];
        const seen = new Set<string>();
        for (const row of hscRows) {
          const cid = row?.client_id != null ? String(row.client_id).trim() : "";
          if (!cid || seen.has(cid)) continue;
          seen.add(cid);
          if (buyersById.has(cid)) continue;
          buyersById.set(cid, {
            id: cid,
            first_name: null,
            last_name: null,
            email: "",
            phone: null as string | null,
            status: "active",
            hotSheetCount: 0,
            favoriteCount: 0,
            lastActivity: null,
            hasUnread: false,
            attentionNote: null as string | null,
          });
        }
      }

      const buyersBase: SuccessHubSummary["buyers"] = Array.from(buyersById.values());
      const buyerClientIds = buyersBase.map((b) => b.id);

      // Conversations base (enrich names in Wave 2)
      const conversationsBase = ((inboxPreviewRes?.data ?? []) as any[]).map((c) => ({
        conversation_id: String(c.conversation_id),
        last_message_preview: c.last_message_preview ?? null,
        last_message_at: c.last_message_at ?? new Date().toISOString(),
        is_unread: Boolean(c.is_unread),
        other_user_id: c.other_user_id ? String(c.other_user_id) : null,
        other_name: null as string | null,
      }));

      // Activity feed — belt+suspenders: safe field access, no nonexistent payload fields
      const acceptedTokens30d = (acceptedTokens30dRes?.data ?? []) as any[];
      const clients30d = (clients30dRes?.data ?? []) as any[];
      const messages30d = (messages30dRes?.data ?? []) as any[];

      const activityRaw: SuccessHubSummary["activity"] = [];

      for (const t of acceptedTokens30d) {
        validateTokenPayload(t, "accepted tokens 30d");
        const p = t?.payload ?? {};
        if (p?.type === "client_hotsheet_invite") {
          // Use payload.client_email for identification; hotsheet_name is NOT in payload
          const who = p.client_email ? String(p.client_email) : "A buyer";
          activityRaw.push({
            id: `invite-accepted-${t.id}`,
            description: `${who} accepted a Hot Sheet invite`,
            timestamp: t.accepted_at ?? t.created_at ?? new Date().toISOString(),
            icon: "invite",
          });
        }
      }

      for (const c of clients30d) {
        const name =
          c.first_name || c.last_name
            ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
            : (c.email ?? "A buyer");
        activityRaw.push({
          id: `client-added-${c.id}`,
          description: `${name} added as a contact`,
          timestamp: c.created_at ?? new Date().toISOString(),
          icon: "invite",
        });
      }

      for (const m of messages30d) {
        activityRaw.push({
          id: `msg-${m.id}`,
          description: "New message received",
          timestamp: m.created_at ?? new Date().toISOString(),
          icon: "message",
        });
      }

      activityRaw.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      const activityCapped = activityRaw.slice(0, 8);

      // Needs Attention (deterministic, derived from metrics)
      const attentionItems: SuccessHubSummary["attentionItems"] = [];

      if (pendingInviteCount > 0) {
        const plural = pendingInviteCount > 1 ? "s" : "";
        attentionItems.push({
          id: "pending-invites",
          type: "invite",
          label: `You have ${pendingInviteCount} pending invite${plural}`,
          sub: `${pendingInviteCount} invite${plural} awaiting acceptance`,
          path: "/success-hub/buyers",
          count: pendingInviteCount,
        });
      }

      if (unreadMessageCount > 0) {
        attentionItems.push({
          id: "unread-messages",
          type: "message",
          label: `You have ${unreadMessageCount} unread message${unreadMessageCount > 1 ? "s" : ""}`,
          sub: `${unreadMessageCount} conversation${unreadMessageCount > 1 ? "s" : ""} waiting`,
          path: "/communications",
          count: unreadMessageCount,
        });
      }

      // ── Wave 2 (dependent on Wave 1) ─────────────────────────────────────────
      const hotSheetIds = hotSheetsBase.map((h) => h.id);
      const otherUserIds = [
        ...new Set(
          conversationsBase.map((c) => c.other_user_id).filter(Boolean) as string[]
        ),
      ];

      const [
        otherAgentsRes,
        buyersClientsRes,
        hotSheetClientsRowsRes,
        buyerHscRes,
      ] = await Promise.all([
        // Other agent names for conversation preview
        otherUserIds.length
          ? supabase
              .from("agent_profiles")
              .select("id,first_name,last_name,headshot_url")
              .in("id", otherUserIds)
          : (Promise.resolve({ data: [], error: null }) as any),

        // Buyer client records (from clients table, owned by agent)
        buyerClientIds.length
          ? supabase
              .from("clients")
              .select("id,first_name,last_name,email,phone,updated_at,created_at")
              .eq("agent_id", agentId)
              .in("id", buyerClientIds)
          : (Promise.resolve({ data: [], error: null }) as any),

        // hot_sheet_clients rows for hot sheet buyer counts + pending invite mapping
        hotSheetIds.length
          ? supabase
              .from("hot_sheet_clients")
              .select("hot_sheet_id,client_id,clients(email)")
              .in("hot_sheet_id", hotSheetIds)
          : (Promise.resolve({ data: [], error: null }) as any),

        // hot_sheet_clients rows for buyer hot-sheet count
        buyerClientIds.length
          ? supabase
              .from("hot_sheet_clients")
              .select("client_id,hot_sheet_id")
              .in("client_id", buyerClientIds)
          : (Promise.resolve({ data: [], error: null }) as any),
      ]);

      if (!mountedRef.current || loadIdRef.current !== myLoadId) return;

      logQueryError("agent_profiles(other users)", otherAgentsRes?.error ?? null);
      logQueryError("clients(buyers)", buyersClientsRes?.error ?? null);
      logQueryError("hot_sheet_clients(rows)", hotSheetClientsRowsRes?.error ?? null);
      logQueryError("hot_sheet_clients(buyer counts)", buyerHscRes?.error ?? null);

      // Conversation names
      const otherInfoById = new Map<string, { name: string; headshot: string | null }>();
      for (const ap of (otherAgentsRes?.data ?? []) as any[]) {
        const name = [ap.first_name, ap.last_name].filter(Boolean).join(" ").trim();
        otherInfoById.set(String(ap.id), { name: name || "Agent", headshot: ap.headshot_url ?? null });
      }

      const conversationsFinal: SuccessHubSummary["conversations"] = conversationsBase.map((c) => {
        const info = c.other_user_id ? otherInfoById.get(c.other_user_id) : null;
        return {
          ...c,
          other_name: info?.name ?? "Agent",
          other_headshot_url: info?.headshot ?? null,
        };
      });

      // Buyer details
      const clientById = new Map<string, any>();
      for (const c of (buyersClientsRes.data ?? []) as any[]) {
        clientById.set(String(c.id), c);
      }

      // hot_sheet count per buyer
      const hsByClient = new Map<string, number>();
      for (const row of (buyerHscRes?.data ?? []) as any[]) {
        const cid = String(row.client_id);
        hsByClient.set(cid, (hsByClient.get(cid) ?? 0) + 1);
      }

      const emailsForProfiles = [
        ...new Set(
          buyerClientIds
            .map((cid) => {
              const row = clientById.get(cid);
              const e = typeof row?.email === "string" ? row.email.trim() : "";
              return e || "";
            })
            .filter(Boolean),
        ),
      ];

      const emailLowerToAuthUserId = new Map<string, string>();
      const favoritesCountByAuthUserId = new Map<string, number>();

      if (emailsForProfiles.length > 0) {
        try {
          const profRes = await supabase.from("profiles").select("id,email").in("email", emailsForProfiles);
          const { data: profRows, error: profErr } = profRes ?? {};
          logQueryError("profiles(buyer emails)", profErr ?? null);

          const authIds: string[] = [];
          for (const p of (profRows ?? []) as any[]) {
            const el = safeLowerEmail(p.email);
            if (el && p.id) {
              emailLowerToAuthUserId.set(el, String(p.id));
              authIds.push(String(p.id));
            }
          }

          const uniqueAuthIds = [...new Set(authIds)];
          if (uniqueAuthIds.length > 0) {
            const favRes = await supabase.from("favorites").select("user_id").in("user_id", uniqueAuthIds);
            const { data: favData, error: favErr } = favRes ?? {};
            logQueryError("favorites(buyer counts)", favErr ?? null);
            for (const row of (favData ?? []) as any[]) {
              const uid = String(row.user_id);
              favoritesCountByAuthUserId.set(uid, (favoritesCountByAuthUserId.get(uid) ?? 0) + 1);
            }
          }
        } catch (buyerFavErr) {
          console.warn("[SuccessHubData] Optional buyer favorites load failed (non-fatal):", buyerFavErr);
        }
      }

      const buyersFinal: SuccessHubSummary["buyers"] = buyersBase.map((b) => {
        const c = clientById.get(b.id);
        const emailLower = safeLowerEmail(c?.email ?? "");
        const authId = emailLower ? emailLowerToAuthUserId.get(emailLower) : undefined;
        const favoriteCount = authId ? (favoritesCountByAuthUserId.get(authId) ?? 0) : 0;

        let attentionNote: string | null = null;
        if (b.status === "pending") {
          attentionNote = "Needs invite acceptance";
        } else if (emailLower && pendingInviteEmails.has(emailLower)) {
          attentionNote = "Hot sheet invite pending";
        }

        const fn = typeof c?.first_name === "string" ? c.first_name.trim() : "";
        const ln = typeof c?.last_name === "string" ? c.last_name.trim() : "";
        const em = typeof c?.email === "string" ? c.email.trim() : "";

        return {
          ...b,
          first_name: fn || null,
          last_name: ln || null,
          email: em,
          phone: typeof c?.phone === "string" && c.phone.trim() ? c.phone.trim() : null,
          hotSheetCount: hsByClient.get(b.id) ?? 0,
          favoriteCount,
          lastActivity: c?.updated_at ?? c?.created_at ?? null,
          hasUnread: false,
          attentionNote,
        };
      });

      // Hot sheet buyer counts + pending invites per hot sheet
      const hscRows = (hotSheetClientsRowsRes?.data ?? []) as any[];
      const buyerCountByHotSheet = new Map<string, number>();

      for (const row of hscRows) {
        const hsId = String(row.hot_sheet_id);
        buyerCountByHotSheet.set(hsId, (buyerCountByHotSheet.get(hsId) ?? 0) + 1);
      }

      // Pending invites per hot sheet — read from payload.hot_sheet_id + payload.type
      const pendingCountByHotSheet = new Map<string, number>();
      for (const t of pendingInviteTokens) {
        const p = t?.payload ?? {};
        // Already validated as client_hotsheet_invite; double-check hot_sheet_id
        const hsId = p.hot_sheet_id ? String(p.hot_sheet_id) : null;
        if (!hsId) {
          console.warn(
            `[SuccessHubData] pendingInviteTokens: token ${t?.id} missing payload.hot_sheet_id — skipping hot-sheet attribution`,
            p
          );
          continue;
        }
        pendingCountByHotSheet.set(hsId, (pendingCountByHotSheet.get(hsId) ?? 0) + 1);
      }

      const hotSheetsFinal: SuccessHubSummary["hotSheets"] = hotSheetsBase.map((hs) => ({
        ...hs,
        buyerCount: buyerCountByHotSheet.get(hs.id) ?? 0,
        pendingInviteCount: pendingCountByHotSheet.get(hs.id) ?? 0,
      }));

      // ── Assemble final summary ───────────────────────────────────────────────
      const nextSummary: SuccessHubSummary = {
        agentId,
        profile,
        metrics: {
          pendingInviteCount,
          activeHotSheetCount: activeHotSheetCount ?? 0,
          activeBuyerCount: activeBuyerCount ?? 0,
          unreadMessageCount: unreadMessageCount ?? 0,
        },
        attentionItems,
        listings: listingsBase,
        hotSheets: hotSheetsFinal,
        buyers: buyersFinal,
        conversations: conversationsFinal,
        activity: activityCapped,
      };

      if (mountedRef.current && loadIdRef.current === myLoadId) {
        setSummary(nextSummary);
      }
    } catch (e: any) {
      if (!mountedRef.current || loadIdRef.current !== myLoadId) return;
      console.error("[SuccessHubData] Fatal load error:", e);
      setError(e?.message ?? "Failed to load Success Hub data");
      setSummary(null);
    } finally {
      if (mountedRef.current && loadIdRef.current === myLoadId) {
        setLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => void loadAll(), [loadAll]);

  useEffect(() => {
    mountedRef.current = true;
    void loadAll();
    return () => {
      mountedRef.current = false;
    };
  }, [loadAll]);

  const merged = summary ?? EMPTY_SUCCESS_HUB_SUMMARY;

  return useMemo(
    (): UseSuccessHubDataResult => ({
      loading,
      error,
      summary: merged,
      buyers: merged.buyers ?? [],
      listings: merged.listings ?? [],
      conversations: merged.conversations ?? [],
      communications: merged.conversations ?? [],
      marketActivity: [],
      refetch,
    }),
    [loading, error, merged, refetch],
  );
}
