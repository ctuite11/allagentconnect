import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import { SUCCESS_HUB_LISTINGS_GRID } from "@/components/success-hub/successHubListingLayout";
import {
  mapAgentClientFavoriteRpcToListingCard,
  type AgentClientFavoriteRpcRow,
} from "@/components/success-hub/listingCardAdapter";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

export default function AgentClientFavorites() {
  const { buyerId, clientId } = useParams<{ buyerId?: string; clientId?: string }>();
  /** CRM `clients.id` — Success Hub uses `buyerId`; legacy route uses `clientId`. */
  const crmClientId = buyerId ?? clientId ?? "";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<AgentClientFavoriteRpcRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crmClientId) {
      setLoading(false);
      setError("Missing buyer");
      return;
    }
    loadClientInfo(crmClientId);
    loadFavorites(crmClientId);
  }, [crmClientId]);

  const loadClientInfo = async (id: string) => {
    const { data } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const fn = typeof data.first_name === "string" ? data.first_name.trim() : "";
      const ln = typeof data.last_name === "string" ? data.last_name.trim() : "";
      setClientName([fn, ln].filter(Boolean).join(" ").trim());
    }
  };

  const loadFavorites = async (id: string) => {
    try {
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

      setFavorites((data || []) as AgentClientFavoriteRpcRow[]);
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
    if (buyerId) {
      navigate(`/success-hub/buyers/${buyerId}`);
      return;
    }
    navigate("/my-clients");
  };

  return (
    <AgentAacPage className="pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 md:px-6">
        <div className="mb-6 flex flex-col gap-1 border-b border-zinc-100 pb-5">
          <button
            type="button"
            onClick={handleBack}
            className="mb-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {buyerId ? "← Back to Buyer" : "← Back to Clients"}
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            {clientName || "Favorites"}
          </h1>
          <p className="text-sm text-neutral-500">
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
                listing={mapAgentClientFavoriteRpcToListingCard(row)}
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
