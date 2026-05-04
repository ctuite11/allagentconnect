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

interface Favorite {
  id: string;
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    photos: unknown;
  };
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

async function resolveBuyerAuthUserId(client: {
  email: string;
  agent_user_id: string | null;
}): Promise<string | null> {
  if (client.agent_user_id) return client.agent_user_id;
  const email = client.email?.trim();
  if (!email) return null;
  const { data } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  return data?.id ? String(data.id) : null;
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
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [hotSheetPreviewPhotosById, setHotSheetPreviewPhotosById] = useState<Record<string, string[]>>({});
  const [hotSheetPreviewMatchCountsById, setHotSheetPreviewMatchCountsById] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);

  const { isOnline: agentPresenceOnline } = useAgentLastSeen(agent?.id);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!buyerClientId || !agentUserId) {
      setClient(null);
      setBuyerDisplayName("");
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
          setAgent(null);
          setHotSheets([]);
          setFavorites([]);
          setMarketListings([]);
          return;
        }

        setClient({
          id: clientRow.id,
          first_name: typeof clientRow.first_name === "string" ? clientRow.first_name : "",
          last_name: typeof clientRow.last_name === "string" ? clientRow.last_name : "",
          email: typeof clientRow.email === "string" ? clientRow.email : "",
          phone: clientRow.phone ?? null,
          notes: clientRow.notes ?? null,
          client_type: clientRow.client_type ?? null,
          agent_id: String(clientRow.agent_id),
          agent_user_id: clientRow.agent_user_id ?? null,
        });

        const fn = typeof clientRow.first_name === "string" ? clientRow.first_name.trim() : "";
        setBuyerFirstName(fn || null);

        const { data: agentProf } = await supabase
          .from("agent_profiles")
          .select("id,first_name,last_name,email,phone,company,headshot_url")
          .eq("id", agentUserId)
          .maybeSingle();

        if (!cancelled && agentProf) {
          setAgent(agentProf as AgentInfo);
        }

        const buyerUserId = await resolveBuyerAuthUserId({
          email: clientRow.email,
          agent_user_id: clientRow.agent_user_id,
        });

        const buyerEmailNorm = (clientRow.email || "").toLowerCase().trim();

        async function loadMirrorHotSheets(userId: string | null, emailNorm: string) {
          const allHotSheetIds = new Set<string>();

          const { data: hscRows } = await supabase.from("hot_sheet_clients").select("hot_sheet_id").eq("client_id", buyerClientId);

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

          if (!allHotSheetIds.size) {
            setHotSheets([]);
            setHotSheetPreviewPhotosById({});
            setHotSheetPreviewMatchCountsById({});
            return;
          }

          const { data: hotSheetRows, error: sheetErr } = await supabase
            .from("hot_sheets")
            .select("id, name, user_id, criteria, created_at, is_active, last_sent_at")
            .in("id", [...allHotSheetIds])
            .order("created_at", { ascending: false });

          if (sheetErr || !hotSheetRows) {
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

        async function loadMirrorFavorites(userId: string) {
          const { data } = await supabase
            .from("favorites")
            .select(
              `
              id,
              listing:listings (
                id, address, city, state, price, bedrooms, bathrooms, photos
              )
            `,
            )
            .eq("user_id", userId)
            .limit(6);

          if (!data) {
            setFavorites([]);
            return;
          }

          type Row = (typeof data)[number] & { listing?: Favorite["listing"] | Favorite["listing"][] | null };
          const normalized = (data as Row[])
            .map((row) => {
              const raw = row.listing;
              const single = Array.isArray(raw) ? raw[0] : raw;
              if (single == null) return null;
              return { ...row, listing: single } as Favorite;
            })
            .filter((r): r is Favorite => r != null);

          setFavorites(normalized);
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

        await Promise.all([
          loadMirrorHotSheets(buyerUserId, buyerEmailNorm),
          buyerUserId ? loadMirrorFavorites(buyerUserId) : Promise.resolve().then(() => setFavorites([])),
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
  }, [buyerClientId, agentUserId]);

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
      label: "Favorites",
      value: String(favorites.length),
      icon: Heart,
      subtle: null,
    },
    {
      label: "New Matches",
      value: marketListings.length > 0 ? String(Math.min(marketListings.length, 6)) : "--",
      icon: Sparkles,
      subtle: marketListings.length > 0 ? "On the market" : "Awaiting activity",
    },
    {
      label: "Unread Messages",
      value: String(unreadCount),
      icon: MessageSquare,
      subtle: unreadCount > 0 ? "Needs review" : "No new messages from your agent.",
    },
    {
      label: "Hot Sheets",
      value: String(hotSheets.length),
      icon: Search,
      subtle:
        hotSheets.length > 0
          ? `${hotSheets.length} saved search${hotSheets.length === 1 ? "" : "es"}`
          : "No hot sheets yet",
    },
  ];

  return {
    loading,
    relationshipHydrating,
    buyerDisplayName,
    agent,
    agentPresenceOnline,
    unreadCount,
    hotSheets,
    hotSheetPreviewPhotosById,
    hotSheetPreviewMatchCountsById,
    favorites,
    marketListings,
    latestListingsPreview,
    stats,
    client,
    refresh,
  };
}
