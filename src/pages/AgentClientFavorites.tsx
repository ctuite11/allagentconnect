import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";
import { BuyerRowStatusPill, type BuyerRowStatusInput } from "@/components/agent/BuyerRowStatusPill";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import { SUCCESS_HUB_LISTINGS_GRID } from "@/components/success-hub/successHubListingLayout";
import {
  mapAgentClientFavoriteRpcToListingCard,
  type AgentClientFavoriteRpcRow,
  type ListingCardModel,
} from "@/components/success-hub/listingCardAdapter";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import ListingChatDrawer, { type ChatMessage } from "@/components/ListingChatDrawer";
import { cn } from "@/lib/utils";

function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function formatFavoritesClientDisplayName(first: string, last: string): string {
  const fnParts = first.trim().split(/\s+/).filter(Boolean).map(titleCaseToken);
  const lnParts = last.trim().split(/\s+/).filter(Boolean).map(titleCaseToken);
  return [...fnParts, ...lnParts].filter(Boolean).join(" ").trim();
}

async function fetchListingEnrichmentForFavorites(
  listingIds: string[],
): Promise<Record<string, Partial<ListingCardModel>>> {
  if (listingIds.length === 0) return {};
  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, listing_number, zip_code, square_feet, property_type, created_at, status, agent_id")
    .in("id", listingIds);
  if (error || !rows?.length) return {};

  const agentIds = [...new Set(rows.map((r) => String((r as { agent_id?: string }).agent_id ?? "")).filter(Boolean))];
  let agents: {
    id: string;
    first_name: string;
    last_name: string;
    company: string | null;
    office_name: string | null;
  }[] = [];
  if (agentIds.length > 0) {
    const { data: ap } = await supabase
      .from("agent_profiles")
      .select("id, first_name, last_name, company, office_name")
      .in("id", agentIds);
    agents = (ap ?? []) as typeof agents;
  }
  const byAgent = new Map(agents.map((a) => [a.id, a]));
  const out: Record<string, Partial<ListingCardModel>> = {};
  for (const row of rows as {
    id: string;
    listing_number?: string | null;
    zip_code?: string | null;
    square_feet?: number | null;
    property_type?: string | null;
    created_at?: string;
    status?: string;
    agent_id?: string;
  }[]) {
    const ap = row.agent_id ? byAgent.get(row.agent_id) : undefined;
    const agent_profile: ListedByAgentProfile | undefined = ap
      ? {
          company: ap.company,
          office_name: ap.office_name,
          first_name: ap.first_name,
          last_name: ap.last_name,
        }
      : undefined;
    out[row.id] = {
      listing_number: row.listing_number != null ? String(row.listing_number) : undefined,
      zip_code: row.zip_code ?? "",
      square_feet: row.square_feet ?? null,
      property_type: row.property_type ?? null,
      created_at: row.created_at,
      status: typeof row.status === "string" ? row.status : undefined,
      agent_id: row.agent_id ?? "",
      agent_profile,
    };
  }
  return out;
}

export default function AgentClientFavorites() {
  const { buyerId, clientId } = useParams<{ buyerId?: string; clientId?: string }>();
  /** CRM `clients.id` — Success Hub uses `buyerId`; legacy route uses `clientId`. */
  const crmClientId = buyerId ?? clientId ?? "";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<AgentClientFavoriteRpcRow[]>([]);
  const [listingEnrich, setListingEnrich] = useState<Record<string, Partial<ListingCardModel>>>({});
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [buyerPill, setBuyerPill] = useState<BuyerRowStatusInput>({
    status: "active",
    buyerWorkspaceLinked: false,
  });
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const [hotSheetIdsForComments, setHotSheetIdsForComments] = useState<string[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatListingId, setChatListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessagesMap((prev) => {
      const lid = msg.listing_id;
      const cur = prev[lid] ?? [];
      if (cur.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...cur, msg] };
    });
  }, []);

  useEffect(() => {
    if (!crmClientId) {
      setLoading(false);
      setError("Missing buyer");
      return;
    }
    void loadPage(crmClientId);
  }, [crmClientId]);

  const primaryHotSheetForComments = hotSheetIdsForComments[0] ?? null;

  useEffect(() => {
    if (!primaryHotSheetForComments) return;
    const channel = supabase
      .channel(`agent-client-favorites-chat-${primaryHotSheetForComments}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hot_sheet_comments",
          filter: `hot_sheet_id=eq.${primaryHotSheetForComments}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessagesMap((prev) => {
            const lid = newMsg.listing_id;
            const existing = prev[lid] || [];
            if (existing.some((m) => m.id === newMsg.id)) return prev;
            return { ...prev, [lid]: [...existing, newMsg] };
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [primaryHotSheetForComments]);

  const loadPage = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setListingEnrich({});
      setMessagesMap({});
      setHotSheetIdsForComments([]);
      setBuyerUserId(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        setLoading(false);
        return;
      }

      const { data: clientRow } = await supabase
        .from("clients")
        .select("first_name, last_name, email, phone")
        .eq("id", id)
        .maybeSingle();

      if (!clientRow?.email) {
        setError("Client not found");
        setLoading(false);
        return;
      }

      const fn = typeof clientRow.first_name === "string" ? clientRow.first_name : "";
      const ln = typeof clientRow.last_name === "string" ? clientRow.last_name : "";
      setClientName(formatFavoritesClientDisplayName(fn, ln));
      setClientEmail(String(clientRow.email ?? ""));
      setClientPhone(typeof clientRow.phone === "string" ? clientRow.phone : null);

      const { data: relRows } = await supabase
        .from("client_agent_relationships")
        .select("client_id, crm_client_id, status")
        .eq("agent_id", user.id);

      const rel = (relRows ?? []).find(
        (r: { client_id?: string | null; crm_client_id?: string | null }) =>
          String(r.crm_client_id ?? "") === id || String(r.client_id ?? "") === id,
      ) as { client_id?: string | null; crm_client_id?: string | null; status?: string } | undefined;

      if (rel) {
        const buyerWorkspaceLinked =
          String(rel.status) === "active" && rel.client_id != null && String(rel.client_id).trim() !== "";
        setBuyerPill({
          status: String(rel.status ?? "active"),
          buyerWorkspaceLinked,
        });
      } else {
        setBuyerPill({ status: "active", buyerWorkspaceLinked: false });
      }

      const { data: profile } = await supabase.from("profiles").select("id").eq("email", clientRow.email).maybeSingle();

      if (!profile?.id) {
        setError("This client hasn't created an account yet");
        setLoading(false);
        return;
      }

      setBuyerUserId(String(profile.id));

      const { data, error: rpcError } = await supabase.rpc("get_client_favorites_for_agent", {
        p_buyer_user_id: profile.id,
        p_crm_client_id: id,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setError(
          rpcError.message.includes("No active relationship")
            ? "You don't have an active relationship with this client"
            : "Failed to load favorites",
        );
        setLoading(false);
        return;
      }

      const rows = (data || []) as AgentClientFavoriteRpcRow[];
      setFavorites(rows);

      const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))];
      const enrich = await fetchListingEnrichmentForFavorites(listingIds);
      setListingEnrich(enrich);

      const { data: hscRows } = await supabase.from("hot_sheet_clients").select("hot_sheet_id").eq("client_id", id);
      const candidateIds = [...new Set((hscRows ?? []).map((r: { hot_sheet_id: string }) => r.hot_sheet_id))];
      let orderedSheetIds: string[] = [];
      if (candidateIds.length > 0) {
        const { data: ownedSheets } = await supabase
          .from("hot_sheets")
          .select("id, created_at")
          .eq("agent_id", user.id)
          .in("id", candidateIds)
          .order("created_at", { ascending: false });
        orderedSheetIds = (ownedSheets ?? []).map((s: { id: string }) => s.id);
      }
      setHotSheetIdsForComments(orderedSheetIds);

      if (orderedSheetIds.length > 0 && listingIds.length > 0) {
        const { data: commentRows, error: cErr } = await supabase
          .from("hot_sheet_comments")
          .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
          .in("hot_sheet_id", orderedSheetIds)
          .in("listing_id", listingIds)
          .order("created_at", { ascending: true });
        if (!cErr && commentRows) {
          const map: Record<string, ChatMessage[]> = {};
          for (const row of commentRows) {
            const lid = row.listing_id;
            if (!lid) continue;
            if (!map[lid]) map[lid] = [];
            map[lid].push(row as ChatMessage);
          }
          setMessagesMap(map);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const count = favorites.length;
  const listingsLabel = `${count} listing${count === 1 ? "" : "s"}`;

  const handleBack = () => {
    if (crmClientId) {
      navigate(`/agent/buyers/${crmClientId}`);
      return;
    }
    navigate("/my-clients");
  };

  const favoritesDrawerHotSheetId = useMemo(() => {
    if (!chatListingId) return null;
    const msgs = messagesMap[chatListingId];
    if (msgs?.length) return msgs[msgs.length - 1].hot_sheet_id;
    return primaryHotSheetForComments;
  }, [chatListingId, messagesMap, primaryHotSheetForComments]);

  const chatAddress = useMemo(() => {
    if (!chatListingId) return "";
    const row = favorites.find((r) => r.listing_id === chatListingId);
    if (!row) return "";
    const mapped = mapAgentClientFavoriteRpcToListingCard(row);
    const merged = { ...mapped, ...(listingEnrich[chatListingId] ?? {}) };
    return `${merged.address}, ${merged.city}`;
  }, [chatListingId, favorites, listingEnrich]);

  return (
    <AgentAacPage className="bg-white pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 md:px-6">
        <div className="mb-6 border-b border-neutral-200 pb-5">
          <button
            type="button"
            onClick={handleBack}
            className="mb-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            {crmClientId ? "← Back to Buyer" : "← Back to Clients"}
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">Favorites</h1>
          {error ? (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {!loading && !error ? (
          <div
            className={cn(
              "mb-6 rounded-xl border border-neutral-200 bg-white p-4 pl-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5",
            )}
          >
            <AgentBuyerActivityHeaderCard
              displayName={clientName || "Buyer"}
              email={clientEmail}
              phone={clientPhone}
              crmClientId={crmClientId}
              metricsToolbarTintIcons
              hotSheetMetricUseFlame
              hideMetricsToolbarTopRule={true}
              metricsToolbarNewMatchesSparklePlus={true}
              avatarClassName="bg-neutral-200 text-neutral-800"
              className="rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
              trailing={<BuyerRowStatusPill buyer={buyerPill} />}
            />
          </div>
        ) : null}

        {loading ? (
          <AacMonogramLoader variant="section" message="Loading…" className="min-h-[28vh]" />
        ) : error ? null : count > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4">
              <h2 className="text-sm font-semibold text-neutral-950">Favorites</h2>
              <span className="text-sm text-neutral-500">{listingsLabel}</span>
            </div>
            <div className={SUCCESS_HUB_LISTINGS_GRID}>
              {favorites.map((row) => (
                <SuccessHubListingCard
                  key={row.listing_id}
                  compactSavedHeartOverlay
                  showCompactComments
                  hotSheetId={primaryHotSheetForComments ?? undefined}
                  chatMessages={messagesMap[row.listing_id] || []}
                  onNewMessage={handleNewMessage}
                  onOpenChat={() => {
                    if (primaryHotSheetForComments) {
                      setChatListingId(row.listing_id);
                      setChatDrawerOpen(true);
                    } else {
                      toast.info("Add this buyer to a hot sheet to leave listing notes here.");
                    }
                  }}
                  hideCompactFavorite
                  listing={{
                    ...mapAgentClientFavoriteRpcToListingCard(row),
                    ...(listingEnrich[row.listing_id] ?? {}),
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="py-14 text-center text-sm text-neutral-500">No favorites yet.</p>
        )}
      </div>

      {chatListingId && favoritesDrawerHotSheetId ? (
        <ListingChatDrawer
          open={chatDrawerOpen}
          onOpenChange={setChatDrawerOpen}
          hotSheetId={favoritesDrawerHotSheetId}
          listingId={chatListingId}
          listingAddress={chatAddress}
          messages={messagesMap[chatListingId] || []}
          onNewMessage={handleNewMessage}
          viewerPerspective="agent"
          conversationRecipientUserId={buyerUserId}
        />
      ) : null}
    </AgentAacPage>
  );
}
