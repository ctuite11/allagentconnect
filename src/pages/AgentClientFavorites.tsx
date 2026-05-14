import { useCallback, useEffect, useState } from "react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { findOrCreateConversation } from "@/lib/startConversation";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/hooks/useAuthRole";

/**
 * Compact card preview shape expected by `ListingCard` — sourced here from `conversation_messages` only
 * (not `hot_sheet_comments`). `hot_sheet_id` is an unused legacy field on the card type.
 */
type ListingCardThreadPreview = {
  id: string;
  hot_sheet_id: string;
  listing_id: string;
  comment: string;
  sender_role: string;
  sender_id: string | null;
  created_at: string;
};

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

function conversationRowToCardPreview(
  row: {
    id: string;
    listing_id: string;
    sender_agent_id: string;
    body: string;
    created_at: string;
  },
  agentUserId: string,
): ListingCardThreadPreview {
  return {
    id: row.id,
    hot_sheet_id: "",
    listing_id: row.listing_id,
    comment: row.body,
    sender_role: row.sender_agent_id === agentUserId ? "agent" : "client",
    sender_id: row.sender_agent_id,
    created_at: row.created_at,
  };
}

/** Latest `conversation_messages` row per listing for compact card previews (same thread as inbox / property). */
async function fetchListingConversationPreviewMap(
  listingIds: string[],
  agentUserId: string,
  buyerUserId: string,
): Promise<Record<string, ListingCardThreadPreview[]>> {
  if (listingIds.length === 0) return {};
  const { data: convoRows, error: cErr } = await supabase
    .from("conversations")
    .select("id, listing_id, agent_a_id, agent_b_id")
    .in("listing_id", listingIds);
  if (cErr || !convoRows?.length) return {};

  const convos = (convoRows as { id: string; listing_id: string; agent_a_id: string; agent_b_id: string }[]).filter(
    (c) =>
      (c.agent_a_id === agentUserId && c.agent_b_id === buyerUserId) ||
      (c.agent_a_id === buyerUserId && c.agent_b_id === agentUserId),
  );
  if (convos.length === 0) return {};

  const convoIds = convos.map((c) => c.id);
  const convoIdToListingId = new Map(convos.map((c) => [c.id, c.listing_id]));

  const { data: msgRows, error: mErr } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, sender_agent_id, body, created_at")
    .in("conversation_id", convoIds)
    .order("created_at", { ascending: false });
  if (mErr || !msgRows?.length) return {};

  const latestByConvo = new Map<string, (typeof msgRows)[0]>();
  for (const m of msgRows) {
    const cid = m.conversation_id as string;
    if (!latestByConvo.has(cid)) latestByConvo.set(cid, m);
  }

  const out: Record<string, ListingCardThreadPreview[]> = {};
  for (const [convoId, msg] of latestByConvo) {
    const lid = convoIdToListingId.get(convoId);
    if (!lid || out[lid]) continue;
    out[lid] = [conversationRowToCardPreview(msg as never, agentUserId)];
  }
  return out;
}

async function fetchLatestPreviewForListing(
  listingId: string,
  agentUserId: string,
  buyerUserId: string,
): Promise<ListingCardThreadPreview | null> {
  const map = await fetchListingConversationPreviewMap([listingId], agentUserId, buyerUserId);
  const arr = map[listingId];
  return arr?.[0] ?? null;
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
  const { user: authUser } = useAuthRole();
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
  const [messagesMap, setMessagesMap] = useState<Record<string, ListingCardThreadPreview[]>>({});
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionResolving, setDiscussionResolving] = useState(false);
  const [discussionConvoId, setDiscussionConvoId] = useState<string | null>(null);
  const [discussionListingId, setDiscussionListingId] = useState<string | null>(null);
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crmClientId) {
      setLoading(false);
      setError("Missing buyer");
      return;
    }
    void loadPage(crmClientId);
  }, [crmClientId]);

  const loadPage = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      setListingEnrich({});
      setMessagesMap({});
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

      const buyerAuthId = String(profile.id);
      setBuyerUserId(buyerAuthId);

      const { data, error: rpcError } = await supabase.rpc("get_client_favorites_for_agent", {
        p_buyer_user_id: buyerAuthId,
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

      const previewMap = await fetchListingConversationPreviewMap(listingIds, user.id, buyerAuthId);
      setMessagesMap(previewMap);
    } catch (err) {
      console.error(err);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const refreshDiscussionPreview = useCallback(async () => {
    if (!discussionListingId || !buyerUserId) return;
    const agentId = authUser?.id;
    if (!agentId) return;
    const latest = await fetchLatestPreviewForListing(discussionListingId, agentId, buyerUserId);
    setMessagesMap((prev) => ({
      ...prev,
      [discussionListingId]: latest ? [latest] : [],
    }));
  }, [discussionListingId, buyerUserId, authUser?.id]);

  const openListingDiscussion = useCallback(
    async (listingId: string) => {
      const agentId = authUser?.id;
      console.log("[AgentClientFavorites] openListingDiscussion:start", {
        listingId,
        agentId,
        buyerUserId,
        crmClientId,
      });
      if (!agentId || !buyerUserId) {
        console.warn("[AgentClientFavorites] openListingDiscussion:missing agent or buyer id");
        toast.error("Unable to open discussion.");
        return;
      }

      const row = favorites.find((r) => r.listing_id === listingId);
      const mapped = row ? mapAgentClientFavoriteRpcToListingCard(row) : null;
      const merged = mapped ? { ...mapped, ...(listingEnrich[listingId] ?? {}) } : null;
      const title =
        merged && (merged.address || merged.city)
          ? [merged.address, merged.city].filter(Boolean).join(", ").trim()
          : "Listing discussion";

      setDiscussionListingId(listingId);
      setDiscussionTitle(title);
      setDiscussionConvoId(null);
      setDiscussionResolving(true);
      setDiscussionOpen(true);
      console.log("[AgentClientFavorites] openListingDiscussion:sheet opened (resolving thread)");

      try {
        console.log("[AgentClientFavorites] findOrCreateConversation:before", {
          agentId,
          buyerUserId,
          listingId,
        });
        const convId = await findOrCreateConversation(agentId, buyerUserId, { listingId });
        console.log("[AgentClientFavorites] findOrCreateConversation:after", { convId });
        if (!convId) {
          console.warn("[AgentClientFavorites] findOrCreateConversation returned null (see startConversation logs)");
          toast.error("Could not open listing discussion.");
          setDiscussionOpen(false);
          setDiscussionListingId(null);
          setDiscussionTitle("");
          return;
        }
        setDiscussionConvoId(convId);
        console.log("[AgentClientFavorites] openListingDiscussion:ConversationPanel bound", { convId });
      } catch (e) {
        console.error("[AgentClientFavorites] openListingDiscussion:unexpected error", e);
        toast.error("Could not open listing discussion.");
        setDiscussionOpen(false);
        setDiscussionListingId(null);
        setDiscussionTitle("");
      } finally {
        setDiscussionResolving(false);
      }
    },
    [authUser?.id, buyerUserId, favorites, listingEnrich, crmClientId],
  );

  const count = favorites.length;
  const listingsLabel = `${count} listing${count === 1 ? "" : "s"}`;

  const handleBack = () => {
    if (crmClientId) {
      navigate(`/agent/buyers/${crmClientId}`);
      return;
    }
    navigate("/my-clients");
  };

  return (
    <AgentAacPage
      className="bg-white pb-12"
      data-build-marker="agent-client-favorites-comments-v2"
    >
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
                  compactListedByMessageSeparator
                  showCompactComments
                  chatMessages={messagesMap[row.listing_id] || []}
                  onOpenChat={() => {
                    console.log("[AgentClientFavorites] ListingCard onOpenChat invoked", {
                      listingId: row.listing_id,
                    });
                    void openListingDiscussion(row.listing_id);
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

      <Sheet
        open={discussionOpen}
        onOpenChange={(open) => {
          setDiscussionOpen(open);
          if (!open) {
            setDiscussionResolving(false);
            setDiscussionConvoId(null);
            setDiscussionListingId(null);
            setDiscussionTitle("");
            console.log("[AgentClientFavorites] discussion sheet closed");
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full max-h-[100dvh] flex-col gap-0 border-l border-neutral-200 p-0 sm:max-w-lg"
        >
          {discussionOpen ? (
            discussionResolving || !discussionConvoId ? (
              <div className="flex min-h-0 flex-1 flex-col bg-white">
                <AacMonogramLoader variant="section" message="Opening discussion…" className="min-h-[40vh] flex-1" />
              </div>
            ) : (
              <ConversationPanel
                conversationId={discussionConvoId}
                threadTitle={discussionTitle}
                onCloseRequest={() => setDiscussionOpen(false)}
                onInboxInvalidate={() => {
                  void refreshDiscussionPreview();
                }}
              />
            )
          ) : null}
        </SheetContent>
      </Sheet>
    </AgentAacPage>
  );
}
