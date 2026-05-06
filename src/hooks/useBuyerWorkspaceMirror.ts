/**
 * Loads the same dashboard datasets as `/client/dashboard` for a buyer (`clients.id`),
 * using the buyer's auth profile when resolvable — for the agent mirror view on BuyerAccount.
 */
import { useEffect, useState } from "react";
import { Heart, MessageSquare, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgentLastSeen } from "@/hooks/useAgentLastSeen";
import { loadHotSheetPhotosAndCounts } from "@/lib/hotSheetPreviewData";
import {
  fetchHotSheetFavoriteRowsForHotSheetIds,
  loadBuyerGenericFavorites,
  mergeHotSheetFavoriteRowsIntoBuyerFavorites,
} from "@/lib/loadBuyerFavorites";
import type { ClientDashboardFavoriteRow } from "@/components/buyer/ClientDashboardView";

interface AgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  headshot_url: string | null;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: Record<string, unknown> | null;
  created_at: string;
  last_sent_at?: string | null;
  is_active: boolean;
  user_id?: string | null;
}

interface ShareTokenRow {
  token: string;
  payload: unknown;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

interface MarketListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: unknown;
  created_at: string;
  agent_id?: string | null;
  agent_profile?: {
    company: string | null;
    office_name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

/**
 * Buyer auth UUID for `favorites.user_id` / RPC — same as `AgentClientFavorites`:
 * resolve from `profiles` using the CRM client's email.
 * Do not use `clients.agent_user_id` here: it is legacy/mis-set (e.g. agent id on insert) and is not authoritative.
 */
async function resolveBuyerAuthUserId(client: { email: string }): Promise<string | null> {
  const email = client.email?.trim();
  if (!email) return null;
  const { data: exact } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (exact?.id) return String(exact.id);
  const { data: loose } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.toLowerCase())
    .maybeSingle();
  return loose?.id ? String(loose.id) : null;
}

/** CRM row for dialogs and messaging — same fields as `useBuyerDashboard` client. */
export interface BuyerMirrorClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  client_type: string | null;
  agent_id: string;
  agent_user_id: string | null;
}

export function useBuyerWorkspaceMirror(buyerClientId: string | undefined, agentUserId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [relationshipHydrating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [client, setClient] = useState<BuyerMirrorClient | null>(null);
  const [unreadCount] = useState(0);
  const [resolvedBuyerUserId, setResolvedBuyerUserId] = useState<string | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [hotSheetPreviewPhotosById, setHotSheetPreviewPhotosById] = useState<Record<string, string[]>>({});
  const [hotSheetPreviewMatchCountsById, setHotSheetPreviewMatchCountsById] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<ClientDashboardFavoriteRow[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);

  const { isOnline: agentPresenceOnline } = useAgentLastSeen(agent?.id);
  const { isOnline: buyerPresenceOnline } = useAgentLastSeen(
    resolvedBuyerUserId ?? undefined,
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!buyerClientId || !agentUserId) {
      setClient(null);
      setBuyerDisplayName("");
      setResolvedBuyerUserId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: clientRow, error: clientErr } = await supabase
          .from("clients")
          .select(
            "id,first_name,last_name,email,phone,notes,client_type,agent_id,agent_user_id",
          )
          .eq("id", buyerClientId)
          .maybeSingle();

        if (cancelled || clientErr || !clientRow) {
          setClient(null);
          setBuyerDisplayName("");
          setResolvedBuyerUserId(null);
          setAgent(null);
          setHotSheets([]);
          setFavorites([]);
          setMarketListings([]);
          return;
        }

        if (String(clientRow.agent_id) !== agentUserId) {
          console.warn("[BuyerWorkspaceMirror] client.agent_id does not match current agent");
          setClient(null);
          setBuyerDisplayName("");
          setResolvedBuyerUserId(null);
          setAgent(null);
          setHotSheets([]);
          setFavorites([]);
          setMarketListings([]);
          return;
        }

        /** CRM `clients` row for this load — used in diagnostics (`client?.id` is CRM id, not auth uid). */
        const client = clientRow;

        setClient({
          id: client.id,
          first_name: typeof client.first_name === "string" ? client.first_name : "",
          last_name: typeof client.last_name === "string" ? client.last_name : "",
          email: typeof client.email === "string" ? client.email : "",
          phone: client.phone ?? null,
          notes: client.notes ?? null,
          client_type: client.client_type ?? null,
          agent_id: String(client.agent_id),
          agent_user_id: client.agent_user_id ?? null,
        });

        const fn = typeof client.first_name === "string" ? client.first_name.trim() : "";
        const ln = typeof client.last_name === "string" ? client.last_name.trim() : "";
        const displayLine = [fn, ln].filter(Boolean).join(" ").trim();
        setBuyerDisplayName(
          displayLine || (typeof client.email === "string" ? client.email : ""),
        );

        const agentProfileId = String(client.agent_id);
        const { data: agentProf } = await supabase
          .from("agent_profiles")
          .select("id,first_name,last_name,email,phone,company,headshot_url")
          .eq("id", agentProfileId)
          .maybeSingle();

        if (!cancelled && agentProf) {
          setAgent(agentProf as AgentInfo);
        } else if (!cancelled) {
          setAgent(null);
        }

        const buyerUserId = await resolveBuyerAuthUserId({
          email: client.email,
          agent_user_id: client.agent_user_id,
        });
        if (!cancelled) {
          setResolvedBuyerUserId(buyerUserId);
        }

        const buyerEmailNorm = (client.email || "").toLowerCase().trim();

        /** Same union as buyer `/client/dashboard`: hot_sheet_clients + accepted share_tokens. */
        async function collectMirrorHotSheetIds(
          userId: string | null,
          emailNorm: string,
        ): Promise<string[]> {
          const allHotSheetIds = new Set<string>();

          const { data: hscRows, error: hscErr } = await supabase
            .from("hot_sheet_clients")
            .select("hot_sheet_id")
            .eq("client_id", buyerClientId);

          if (hscErr) {
            console.warn("[BuyerWorkspaceMirror] hot_sheet_clients:", hscErr.message);
          }

          for (const row of hscRows || []) {
            const hid = (row as { hot_sheet_id?: string }).hot_sheet_id;
            if (hid) allHotSheetIds.add(hid);
          }

          if (userId) {
            const { data: acceptedTokenRows } = await supabase
              .from("share_tokens")
              .select("token, payload, accepted_at, accepted_by_user_id")
              .not("accepted_at", "is", null);

            for (const tokenRow of (acceptedTokenRows || []) as ShareTokenRow[]) {
              const payload =
                tokenRow.payload && typeof tokenRow.payload === "object"
                  ? (tokenRow.payload as Record<string, unknown>)
                  : {};
              if (payload.type !== "client_hotsheet_invite") continue;

              const hotSheetId = String(payload.hot_sheet_id || "");
              if (!hotSheetId) continue;

              const matchByUserId = tokenRow.accepted_by_user_id === userId;
              const tokenEmail = String(payload.client_email || "").toLowerCase().trim();
              const matchByEmail = Boolean(emailNorm && tokenEmail === emailNorm);

              if (matchByUserId || matchByEmail) {
                allHotSheetIds.add(hotSheetId);
              }
            }
          }

          return [...allHotSheetIds];
        }

        async function loadMirrorHotSheetsFromIds(hotSheetIds: string[]) {
          if (!hotSheetIds.length) {
            setHotSheets([]);
            setHotSheetPreviewPhotosById({});
            setHotSheetPreviewMatchCountsById({});
            return;
          }

          const { data: hotSheetRows, error: sheetErr } = await supabase
            .from("hot_sheets")
            .select("id, name, user_id, criteria, created_at, is_active, last_sent_at")
            .in("id", hotSheetIds)
            .order("created_at", { ascending: false });

          if (sheetErr || !hotSheetRows) {
            if (sheetErr) console.warn("[BuyerWorkspaceMirror] hot_sheets:", sheetErr.message);
            setHotSheets([]);
            setHotSheetPreviewPhotosById({});
            setHotSheetPreviewMatchCountsById({});
            return;
          }

          const loadedSheets = hotSheetRows as HotSheet[];
          setHotSheets(loadedSheets);
          const slice = loadedSheets.slice(0, 3);
          const { photosById, countsById } = await loadHotSheetPhotosAndCounts(
            supabase,
            slice.map((s) => ({ id: s.id, criteria: s.criteria })),
          );
          setHotSheetPreviewPhotosById(photosById);
          setHotSheetPreviewMatchCountsById(countsById);
        }

        /**
         * Shared loader: `@/lib/loadBuyerFavorites` (same `favorites.user_id` as /client/dashboard; agent path uses RPC).
         * `hot_sheet_favorites`: `hot_sheet_id` + `listing_id` (see ClientHotSheet).
         */
        async function loadMirrorFavoritesMerged(resolvedUserId: string | null, hotSheetIds: string[]) {
          const genericFavorites =
            resolvedUserId != null && resolvedUserId !== ""
              ? await loadBuyerGenericFavorites(supabase, resolvedUserId, "agent_mirror", {
                  limit: 40,
                  crmClientId: buyerClientId,
                })
              : [];

          const hotSheetFavorites = await fetchHotSheetFavoriteRowsForHotSheetIds(supabase, hotSheetIds);

          const mergedFull = await mergeHotSheetFavoriteRowsIntoBuyerFavorites(
            supabase,
            genericFavorites,
            hotSheetFavorites,
          );
          const mergedFavorites = mergedFull.slice(0, 80);
          const favoritesForUI = mergedFavorites;

          if (!cancelled) {
            setFavorites(favoritesForUI);
          }
        }

        async function loadMirrorMarket() {
          const { data, error } = await supabase
            .from("listings")
            .select(
              "id, address, city, state, price, bedrooms, bathrooms, square_feet, photos, created_at, agent_id",
            )
            .in("status", ["coming_soon", "active", "back_on_market"])
            .order("created_at", { ascending: false })
            .limit(6);

          if (error) {
            console.warn("[BuyerWorkspaceMirror] listings (market):", error.message);
            setMarketListings([]);
            return;
          }

          const rows = (data || []) as MarketListing[];
          const agentIds = Array.from(new Set(rows.map((r) => r.agent_id).filter((id): id is string => Boolean(id))));
          if (agentIds.length === 0) {
            setMarketListings(rows);
            return;
          }

          const { data: agents } = await supabase
            .from("agent_profiles")
            .select("id, first_name, last_name, company, office_name")
            .in("id", agentIds);

          if (!agents?.length) {
            setMarketListings(rows);
            return;
          }

          const byId = new Map(agents.map((a) => [a.id, a]));
          setMarketListings(
            rows.map((r) => {
              const aid = r.agent_id;
              if (typeof aid !== "string" || !byId.has(aid)) return r;
              const a = byId.get(aid)!;
              return {
                ...r,
                agent_profile: {
                  company: a.company,
                  office_name: a.office_name,
                  first_name: a.first_name,
                  last_name: a.last_name,
                },
              };
            }),
          );
        }

        const hotSheetIdList = await collectMirrorHotSheetIds(buyerUserId, buyerEmailNorm);

        await Promise.all([
          loadMirrorHotSheetsFromIds(hotSheetIdList),
          loadMirrorFavoritesMerged(buyerUserId, hotSheetIdList),
          loadMirrorMarket(),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [buyerClientId, agentUserId, refreshKey]);

  const latestListingsPreview = (marketListings || [])
    .filter((l): l is MarketListing => l != null && Boolean(l.id))
    .slice(0, 4);

  const stats: {
    label: string;
    value: string;
    icon: LucideIcon;
    subtle: string | null;
  }[] = [
    {
      label: "Hot Sheets",
      value: String(hotSheets.length),
      icon: Search,
      subtle:
        hotSheets.length > 0
          ? `${hotSheets.length} saved search${hotSheets.length === 1 ? "" : "es"}`
          : "No hot sheets yet",
    },
    {
      label: "New Matches",
      value: marketListings.length > 0 ? String(Math.min(marketListings.length, 6)) : "--",
      icon: Sparkles,
      subtle: marketListings.length > 0 ? "On the market" : "Awaiting activity",
    },
    {
      label: "Favorites",
      value: String(favorites.length),
      icon: Heart,
      subtle: null,
    },
    {
      label: "Unread Messages",
      value: String(unreadCount),
      icon: MessageSquare,
      subtle: unreadCount > 0 ? "Needs review" : "No new messages from your agent.",
    },
  ];

  return {
    loading,
    relationshipHydrating,
    buyerDisplayName,
    agent,
    agentPresenceOnline,
    buyerPresenceOnline,
    unreadCount,
    hotSheets,
    hotSheetPreviewPhotosById,
    hotSheetPreviewMatchCountsById,
    favorites,
    /** Buyer auth UUID (`favorites.user_id`); CRM id is passed separately to the favorites RPC. */
    resolvedBuyerUserId,
    marketListings,
    latestListingsPreview,
    stats,
    client,
    refresh,
  };
}
