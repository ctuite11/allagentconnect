import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import {
  HotSheetCriteriaBuilder,
  type HotSheetCriteriaFormValue,
} from "@/components/communication-center/HotSheetCriteriaBuilder";
import { PageShell } from "@/components/layout/PageShell";
import { DEFAULT_HOT_SHEET_CRITERIA, toCriteriaPayload } from "@/lib/hotSheetCriteriaCore";
import { aacStyles } from "@/ui/aacStyles";

const defaultCriteria: HotSheetCriteriaFormValue = { ...DEFAULT_HOT_SHEET_CRITERIA };

export default function ClientCreateHotsheetNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hasActiveAgent, setHasActiveAgent] = useState(false);
  const [hotsheetName, setHotsheetName] = useState("");
  const [criteria, setCriteria] = useState<HotSheetCriteriaFormValue>(defaultCriteria);

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
    if (criteria.cities && criteria.cities.length > 0) {
      parts.push(criteria.cities[0]);
    }
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
      parts.push(
        criteria.propertyTypes[0].replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
      );
    }
    if (criteria.maxPrice && !criteria.hasNoMax) {
      const maxPrice = parseFloat(criteria.maxPrice);
      parts.push(`under $${(maxPrice / 1000).toFixed(0)}k`);
    }
    return parts.join(" ") || "My Hot Sheet";
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

    const hotsheetCriteria = toCriteriaPayload(criteria);

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
        toast.error("Your agent has not set up your account yet. Please ask them to finish setup first.");
      } else {
        toast.error("Failed to create hot sheet");
      }
      return;
    }

    toast.success("Hot Sheet created!");
    navigate("/hot-sheets");
  };

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto pb-20">
        <button
          type="button"
          onClick={() => navigate("/hot-sheets")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Hot Sheets
        </button>

        <div className={`${aacStyles.card} shadow-[0_10px_28px_rgba(15,23,42,0.07)]`}>
          <h2 className={aacStyles.sectionH2}>Create New Hot Sheet</h2>
          <p className={`${aacStyles.cardDesc} mt-1 mb-6`}>
            Set up alerts when matching homes become available.
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="name">Hot Sheet Name</Label>
              <Input
                id="name"
                placeholder="e.g., Back Bay condos under $2M"
                value={hotsheetName}
                onChange={(e) => setHotsheetName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional — we can name it for you based on criteria.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
              <h3 className={`${aacStyles.settingsItemTitle} mb-1 text-base font-semibold tracking-tight`}>Search Criteria</h3>
              <HotSheetCriteriaBuilder value={criteria} onChange={setCriteria} />
            </div>

            <div className="sticky bottom-0 -mx-2 bg-white/92 px-2 py-3 pb-6 backdrop-blur supports-[backdrop-filter]:bg-white/82">
              <div className="flex gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <button
                  type="button"
                  onClick={() => navigate("/hot-sheets")}
                  className={`${aacStyles.neutralButton} flex-1`}
                >
                  Cancel
                </button>
                <Button type="submit" className="flex-1" disabled={loading || !hasActiveAgent}>
                  {loading ? "Saving..." : "Save Hot Sheet"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
