import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { PageShell } from "@/components/layout/PageShell";
import { aacStyles } from "@/ui/aacStyles";

export default function ClientCreateHotsheetNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hasActiveAgent, setHasActiveAgent] = useState(false);
  const [hotsheetName, setHotsheetName] = useState("");
  const [criteria, setCriteria] = useState<SearchCriteria>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
    propertyTypes: [],
    statuses: ["new", "coming_soon", "active", "back_on_market"],
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/consumer/auth");
      return;
    }
    setHasActiveAgent(true);
  };

  const generateAutoName = () => {
    const parts = [];
    if (criteria.towns && criteria.towns.length > 0) {
      parts.push(criteria.towns[0]);
    }
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
      parts.push(
        criteria.propertyTypes[0].replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
      );
    }
    if (criteria.maxPrice) {
      const maxPrice = parseFloat(criteria.maxPrice);
      parts.push(`under $${(maxPrice / 1000).toFixed(0)}k`);
    }
    return parts.join(" ") || "My Saved Search";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasActiveAgent) {
      toast.error("No active agent found");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const hotsheetCriteria = {
      state: criteria.state,
      county: criteria.county,
      cities: criteria.towns,
      showAreas: criteria.showAreas,
      propertyTypes: criteria.propertyTypes,
      statuses: criteria.statuses,
      minPrice: criteria.minPrice ? parseFloat(criteria.minPrice) : null,
      maxPrice: criteria.maxPrice ? parseFloat(criteria.maxPrice) : null,
      bedrooms: criteria.bedrooms ? parseInt(criteria.bedrooms) : null,
      bathrooms: criteria.bathrooms ? parseFloat(criteria.bathrooms) : null,
    };

    const name = hotsheetName || generateAutoName();

    const { data, error } = await supabase.rpc("create_buyer_hot_sheet", {
      p_name: name,
      p_criteria: hotsheetCriteria,
    });

    setLoading(false);

    if (error) {
      console.error("create_buyer_hot_sheet error:", error);
      if (error.message?.includes("No active agent relationship")) {
        toast.error("No active agent relationship found");
      } else if (error.message?.includes("CRM client record")) {
        toast.error("Your agent hasn't added you as a client yet. Please ask them to add you first.");
      } else {
        toast.error("Failed to create saved search");
      }
      return;
    }

    toast.success("Saved search created!");
    navigate("/client/dashboard");
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto pb-12">
        <div className={aacStyles.card}>
          <h2 className={aacStyles.sectionH2}>Create New Saved Search</h2>
          <p className={`${aacStyles.cardDesc} mt-1 mb-6`}>
            Set up a saved search to receive notifications when matching properties
            become available
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Search Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Back Bay condos under $2M"
                value={hotsheetName}
                onChange={(e) => setHotsheetName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-generate a name
              </p>
            </div>

            <div className="border border-zinc-200 rounded-xl p-4">
              <h3 className={`${aacStyles.settingsItemTitle} mb-4`}>Search Criteria</h3>
              <UnifiedPropertySearch
                criteria={criteria}
                onCriteriaChange={setCriteria}
                showResultsCount={false}
                mode="consumer"
              />
            </div>

            <div className="flex gap-4">
              <button type="submit" disabled={loading || !hasActiveAgent} className={aacStyles.primaryButton}>
                {loading ? "Creating..." : "Create Saved Search"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/client/dashboard")}
                className={aacStyles.neutralButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </PageShell>
  );
}
