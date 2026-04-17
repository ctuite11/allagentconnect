import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { Flame, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const HOT_SHEET_HELP =
  "Your personalized live listing feed. Get alerted when matching homes hit the network.";

const DcmlsHotSheetNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
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
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/auth?redirect=/searches/new");
    })();
  }, [navigate]);

  const autoName = () => {
    const parts: string[] = [];
    if (criteria.towns?.length) parts.push(criteria.towns[0]);
    if (criteria.propertyTypes?.length) {
      parts.push(criteria.propertyTypes[0].replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
    if (criteria.maxPrice) parts.push(`under $${(parseFloat(criteria.maxPrice) / 1000).toFixed(0)}k`);
    return parts.join(" ") || "My Hot Sheet";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      navigate("/auth?redirect=/searches/new");
      return;
    }

    const finalName = name.trim() || autoName();
    const hsCriteria = {
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

    // Try agent-linked path first (for agent-invited buyers)
    const { error: rpcError } = await supabase.rpc("create_buyer_hot_sheet", {
      p_name: finalName,
      p_criteria: hsCriteria,
    });

    if (rpcError) {
      const msg = rpcError.message || "";
      const noAgent = msg.includes("No active agent relationship") || msg.includes("CRM client record");
      if (noAgent) {
        // Direct-buyer fallback: self-owned hot sheet
        const { error: insertError } = await supabase.from("hot_sheets").insert({
          user_id: user.id,
          name: finalName,
          criteria: hsCriteria as any,
          is_active: true,
          notify_client_email: true,
          notify_agent_email: false,
          notification_schedule: "immediately",
        });
        setLoading(false);
        if (insertError) {
          console.error(insertError);
          toast.error("Could not create your Hot Sheet");
          return;
        }
        toast.success("Hot Sheet created. We'll alert you when matches hit the network.");
        navigate("/searches");
        return;
      }
      setLoading(false);
      console.error(rpcError);
      toast.error("Could not create your Hot Sheet");
      return;
    }

    setLoading(false);
    toast.success("Hot Sheet created. We'll alert you when matches hit the network.");
    navigate("/searches");
  };

  return (
    <>
      <Seo
        title="New Hot Sheet — Direct Connect MLS"
        description="Create a personalized live listing feed and get alerted when matching homes hit the network."
        canonical="https://directconnectmls.com/searches/new"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 md:py-16">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-foreground/70" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                Hot Sheet
              </span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                Create a new Hot Sheet
              </h1>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="What is a Hot Sheet?" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{HOT_SHEET_HELP}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{HOT_SHEET_HELP}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="hs-name">Hot Sheet name (optional)</Label>
              <Input
                id="hs-name"
                placeholder="e.g., Back Bay condos under $2M"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank to auto-generate.</p>
            </div>

            <div className="border border-border/60 rounded-xl p-5 bg-card">
              <h2 className="text-sm font-semibold text-foreground mb-4">Criteria</h2>
              <UnifiedPropertySearch
                criteria={criteria}
                onCriteriaChange={setCriteria}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create Hot Sheet"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/searches")}>
                Cancel
              </Button>
            </div>
          </form>
        </main>
      </div>
    </>
  );
};

export default DcmlsHotSheetNew;
