import { useCallback, useEffect, useRef, useState } from "react";
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
    status: string;
    photos: string[] | null;
    price: number | null;
    view_count: number;
    showing_request_count: number;
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
    status: "active" | "pending";
    hotSheetCount: number;
    lastActivity: string | null;
    hasUnread: boolean;
  }>;

  conversations: Array<{
    conversation_id: string;
    last_message_preview: string | null;
    last_message_at: string;
    is_unread: boolean;
    other_user_id: string | null;
    other_name: string | null;
  }>;

  activity: Array<{
    id: string;
    description: string;
    timestamp: string;
    icon: "invite" | "match" | "message" | "listing";
  }>;
}

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSuccessHubData(): {
  summary: SuccessHubSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
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
        relationshipsRes,
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
          .select("id,address,city,state,status,photos,price,updated_at,listing_stats(view_count,showing_request_count)")
          .eq("agent_id", agentId)
          .in("status", ["active", "pending", "coming_soon", "off_market"])
          .order("updated_at", { ascending: false })
          .limit(6),

        // Active buyer relationships — count + preview rows
        supabase
          .from("client_agent_relationships")
          .select("id,client_id,agent_id,status,updated_at,created_at", { count: "exact" })
          .eq("agent_id", agentId)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(8),

        // Conversation inbox preview (view is already user-scoped by RLS)
        supabase
          .from("conversation_inbox")
          .select("conversation_id,last_message_preview,last_message_at,is_unread,other_user_id")
          .order("last_message_at", { ascending: false })
          .limit(3),

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
      logQueryError("agent_profiles", profileRes.error);
      logQueryError("share_tokens(unaccepted)", unacceptedTokensRes.error);
      logQueryError("hot_sheets(preview)", hotSheetsPreviewRes.error);
      logQueryError("hot_sheets(count)", hotSheetsCountRes.error);
      logQueryError("listings(preview)", listingsPreviewRes.error);
      logQueryError("client_agent_relationships", relationshipsRes.error);
      logQueryError("conversation_inbox(preview)", inboxPreviewRes.error);
      logQueryError("conversation_inbox(unread count)", inboxUnreadCountRes.error);
      logQueryError("share_tokens(accepted 30d)", acceptedTokens30dRes.error);
      logQueryError("clients(30d)", clients30dRes.error);
      logQueryError("conversation_messages(30d)", messages30dRes.error);

      // ── Derive Wave 1 values ─────────────────────────────────────────────────

      const profile = profileRes.data
        ? {
            first_name: (profileRes.data as any).first_name ?? "",
            last_name: (profileRes.data as any).last_name ?? "",
            headshot_url: (profileRes.data as any).headshot_url ?? null,
            company: (profileRes.data as any).company ?? null,
            title: (profileRes.data as any).title ?? null,
          }
        : null;

      // Pending invite tokens: filter by payload.type in JS (no top-level type column)
      const unacceptedTokens = (unacceptedTokensRes.data ?? []) as any[];
      unacceptedTokens.forEach((t) => validateTokenPayload(t, "unaccepted tokens"));

      const pendingInviteTokens = unacceptedTokens.filter((t) => {
        const p = t?.payload ?? {};
        return p?.type === "client_hotsheet_invite" && !t?.accepted_at;
      });
      const pendingInviteCount = pendingInviteTokens.length;

      const activeHotSheetCount =
        (hotSheetsCountRes.count as number | null) ??
        ((hotSheetsPreviewRes.data ?? []) as any[]).length;

      const activeBuyerCount =
        (relationshipsRes.count as number | null) ??
        ((relationshipsRes.data ?? []) as any[]).length;

      const unreadMessageCount = (inboxUnreadCountRes.count as number | null) ?? 0;

      // Listings preview: listing_stats may be array or object depending on join type
      const listingsBase = ((listingsPreviewRes.data ?? []) as any[]).map((l) => {
        const stats = Array.isArray(l.listing_stats)
          ? l.listing_stats[0]
          : l.listing_stats;
        return {
          id: String(l.id),
          address: l.address ?? "",
          city: l.city ?? "",
          state: l.state ?? "",
          status: l.status ?? "",
          photos: (l.photos as string[] | null) ?? null,
          price: typeof l.price === "number" ? l.price : null,
          view_count: typeof stats?.view_count === "number" ? stats.view_count : 0,
          showing_request_count:
            typeof stats?.showing_request_count === "number"
              ? stats.showing_request_count
              : 0,
        };
      });

      // Hot sheets base
      const hotSheetsBase = ((hotSheetsPreviewRes.data ?? []) as any[]).map((hs) => ({
        id: String(hs.id),
        name: hs.name ?? "Hot Sheet",
        buyerCount: 0,
        pendingInviteCount: 0,
        lastUpdated: hs.updated_at ?? new Date().toISOString(),
      }));

      // Buyers base (enrich in Wave 2)
      const activeRelationships = (relationshipsRes.data ?? []) as any[];
      const buyerClientIds = activeRelationships
        .map((r) => r.client_id)
        .filter(Boolean)
        .map(String);

      const buyersBase: SuccessHubSummary["buyers"] = buyerClientIds.map((id) => ({
        id,
        first_name: null,
        last_name: null,
        email: "",
        status: "active",
        hotSheetCount: 0,
        lastActivity: null,
        hasUnread: false,
      }));

      // Conversations base (enrich names in Wave 2)
      const conversationsBase = ((inboxPreviewRes.data ?? []) as any[]).map((c) => ({
        conversation_id: String(c.conversation_id),
        last_message_preview: c.last_message_preview ?? null,
        last_message_at: c.last_message_at ?? new Date().toISOString(),
        is_unread: Boolean(c.is_unread),
        other_user_id: c.other_user_id ? String(c.other_user_id) : null,
        other_name: null as string | null,
      }));

      // Activity feed — belt+suspenders: safe field access, no nonexistent payload fields
      const acceptedTokens30d = (acceptedTokens30dRes.data ?? []) as any[];
      const clients30d = (clients30dRes.data ?? []) as any[];
      const messages30d = (messages30dRes.data ?? []) as any[];

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
        attentionItems.push({
          id: "pending-invites",
          type: "invite",
          label: `You have ${pendingInviteCount} pending invite${pendingInviteCount > 1 ? "s" : ""}`,
          sub: `${pendingInviteCount} buyer${pendingInviteCount > 1 ? "s" : ""} haven't accepted yet`,
          path: "/hot-sheets",
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
              .select("id,first_name,last_name")
              .in("id", otherUserIds)
          : (Promise.resolve({ data: [], error: null }) as any),

        // Buyer client records (from clients table, owned by agent)
        buyerClientIds.length
          ? supabase
              .from("clients")
              .select("id,first_name,last_name,email,updated_at,created_at")
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

      logQueryError("agent_profiles(other users)", otherAgentsRes.error);
      logQueryError("clients(buyers)", buyersClientsRes.error);
      logQueryError("hot_sheet_clients(rows)", hotSheetClientsRowsRes.error);
      logQueryError("hot_sheet_clients(buyer counts)", buyerHscRes.error);

      // Conversation names
      const otherNameById = new Map<string, string>();
      for (const ap of (otherAgentsRes.data ?? []) as any[]) {
        const name = [ap.first_name, ap.last_name].filter(Boolean).join(" ").trim();
        otherNameById.set(String(ap.id), name || "Agent");
      }

      const conversationsFinal: SuccessHubSummary["conversations"] = conversationsBase.map((c) => ({
        ...c,
        other_name: c.other_user_id
          ? (otherNameById.get(c.other_user_id) ?? "Agent")
          : "Agent",
      }));

      // Buyer details
      const clientById = new Map<string, any>();
      for (const c of (buyersClientsRes.data ?? []) as any[]) {
        clientById.set(String(c.id), c);
      }

      // hot_sheet count per buyer
      const hsByClient = new Map<string, number>();
      for (const row of (buyerHscRes.data ?? []) as any[]) {
        const cid = String(row.client_id);
        hsByClient.set(cid, (hsByClient.get(cid) ?? 0) + 1);
      }

      const buyersFinal: SuccessHubSummary["buyers"] = buyersBase.map((b) => {
        const c = clientById.get(b.id);
        return {
          ...b,
          first_name: c?.first_name ?? null,
          last_name: c?.last_name ?? null,
          email: c?.email ?? "",
          status: "active" as const,
          hotSheetCount: hsByClient.get(b.id) ?? 0,
          lastActivity: c?.updated_at ?? c?.created_at ?? null,
          hasUnread: false,
        };
      });

      // Hot sheet buyer counts + pending invites per hot sheet
      const hscRows = (hotSheetClientsRowsRes.data ?? []) as any[];
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

  return { summary, loading, error, refetch };
}
