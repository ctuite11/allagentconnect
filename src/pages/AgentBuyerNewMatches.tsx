import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AgentSplitResultsSurface } from "@/components/listing-search/AgentSplitResultsSurface";
import { fetchBuyerNewHotSheetMatches } from "@/lib/fetchBuyerNewHotSheetMatches";
import type { AgentSplitListing } from "@/lib/agentSplitResults";

/**
 * Agent view: new listings matching a buyer's hot sheet criteria (not yet sent on any linked sheet).
 */
export default function AgentBuyerNewMatches() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const backTo = buyerId ? `/agent/buyers/${buyerId}` : "/agent/buyers";
  const resultsFromPath = buyerId ? `/agent/buyers/${buyerId}/new-matches` : "/agent/buyers";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [hotSheetCount, setHotSheetCount] = useState(0);
  const [listings, setListings] = useState<AgentSplitListing[]>([]);

  const loadMatches = useCallback(async () => {
    if (!buyerId) {
      setLoadError("Buyer not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadError("Please sign in to view new matches.");
        setListings([]);
        return;
      }

      const result = await fetchBuyerNewHotSheetMatches(supabase, buyerId, user.id);
      setBuyerDisplayName(result.buyerDisplayName);
      setHotSheetCount(result.hotSheetCount);
      setListings(result.listings as AgentSplitListing[]);
    } catch (e) {
      console.error("[AgentBuyerNewMatches]", e);
      setLoadError("Could not load new matches.");
      toast.error("Could not load new matches.");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const subtitle =
    hotSheetCount > 0
      ? `New listings matching this buyer's hot sheet criteria (${hotSheetCount} hot sheet${hotSheetCount === 1 ? "" : "s"}).`
      : "Link a hot sheet to this buyer to track new matches.";

  const emptyMessage =
    hotSheetCount === 0
      ? "No hot sheets linked to this buyer yet."
      : "No new matches right now — listings already sent on hot sheets are hidden.";

  return (
    <AgentSplitResultsSurface
      listings={listings}
      loading={loading}
      loadError={loadError}
      emptyMessage={emptyMessage}
      title={buyerDisplayName ? `New matches — ${buyerDisplayName}` : "New matches"}
      subtitle={subtitle}
      onBack={() => navigate(backTo)}
      resultsFromPath={resultsFromPath}
      showSaveToHotSheet={false}
      loadingMessage="Loading new matches…"
      toolbarAriaLabel="Buyer new matches toolbar"
      seo={{
        title: "Buyer new matches | All Agent Connect",
        description: "New listings matching buyer hot sheet criteria.",
      }}
    />
  );
}
