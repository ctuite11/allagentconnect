import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import { SUCCESS_HUB_LISTINGS_GRID } from "@/components/success-hub/successHubListingLayout";
import {
  mapAgentClientFavoriteRpcToListingCard,
  type AgentClientFavoriteRpcRow,
  type ListingCardModel,
} from "@/components/success-hub/listingCardAdapter";
import type { ListedByAgentProfile } from "@/lib/listingListedBy";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crmClientId) {
      setLoading(false);
      setError("Missing buyer");
      return;
    }
    loadClientInfo(crmClientId);
    void loadFavorites(crmClientId);
  }, [crmClientId]);

  const loadClientInfo = async (id: string) => {
    const { data } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const fn = typeof data.first_name === "string" ? data.first_name : "";
      const ln = typeof data.last_name === "string" ? data.last_name : "";
      setClientName(formatFavoritesClientDisplayName(fn, ln));
    }
  };

  const loadFavorites = async (id: string) => {
    try {
      setListingEnrich({});
      const { data: client } = await supabase.from("clients").select("email").eq("id", id).maybeSingle();

      if (!client?.email) {
        setError("Client not found");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", client.email)
        .maybeSingle();

      if (!profile?.id) {
        setError("This client hasn't created an account yet");
        setLoading(false);
        return;
      }

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

      const ids = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))];
      const enrich = await fetchListingEnrichmentForFavorites(ids);
      setListingEnrich(enrich);
    } catch (err) {
      console.error(err);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const count = favorites.length;
  const countLabel = `${count} favorite${count === 1 ? "" : "s"}`;

  const handleBack = () => {
    if (crmClientId) {
      navigate(`/agent/buyers/${crmClientId}`);
      return;
    }
    navigate("/my-clients");
  };

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
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            {clientName || "Favorites"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {error ? <span className="text-red-600">{error}</span> : loading ? "Loading…" : countLabel}
          </p>
        </div>

        {loading ? (
          <AacMonogramLoader variant="section" message="Loading…" className="min-h-[28vh]" />
        ) : error ? null : count > 0 ? (
          <div className={SUCCESS_HUB_LISTINGS_GRID}>
            {favorites.map((row) => (
              <SuccessHubListingCard
                key={row.listing_id}
                compactAgentOwned
                listing={{
                  ...mapAgentClientFavoriteRpcToListingCard(row),
                  ...(listingEnrich[row.listing_id] ?? {}),
                }}
              />
            ))}
          </div>
        ) : (
          <p className="py-14 text-center text-sm text-neutral-500">No favorites yet.</p>
        )}
      </div>
    </AgentAacPage>
  );
}
