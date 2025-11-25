import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";

export default function ClientCreateHotsheetNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
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

    // Get client's primary agent from active relationship
    const { data: relationship } = await supabase
      .from("client_agent_relationships")
      .select("agent_id")
      .eq("client_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (relationship) {
      setAgentId(relationship.agent_id);
    } else {
      toast.error("You need an active agent relationship to create saved searches");
      navigate("/client/dashboard");
    }
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
    if (!agentId) {
      toast.error("No active agent found");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Convert criteria to hotsheet format
    const hotsheetCriteria = {
      state: criteria.state,
      county: criteria.county,
      cities: criteria.towns,
      showAreas: criteria.showAreas,
      propertyTypes: criteria.propertyTypes,
      statuses: criteria.statuses,
      minPrice: criteria.minPrice ? parseFloat(criteria.minPrice) : undefined,
      maxPrice: criteria.maxPrice ? parseFloat(criteria.maxPrice) : undefined,
      bedrooms: criteria.bedrooms ? parseInt(criteria.bedrooms) : undefined,
      bathrooms: criteria.bathrooms ? parseFloat(criteria.bathrooms) : undefined,
      zipCode: criteria.zipCode || undefined,
      minSqft: criteria.minLivingArea ? parseFloat(criteria.minLivingArea) : undefined,
      maxSqft: criteria.maxLivingArea ? parseFloat(criteria.maxLivingArea) : undefined,
    };

    const name = hotsheetName || generateAutoName();

    const { data, error } = await supabase
      .from("hot_sheets")
      .insert({
        user_id: agentId,
        client_id: user.id,
        name,
        criteria: hotsheetCriteria,
        is_active: true,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast.error("Failed to create saved search");
      console.error(error);
      return;
    }

    toast.success("Saved search created!");
    navigate("/client/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Create New Saved Search</CardTitle>
              <CardDescription>
                Set up a saved search to receive notifications when matching properties
                become available
              </CardDescription>
            </CardHeader>
            <CardContent>
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

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Search Criteria</h3>
                  <UnifiedPropertySearch
                    criteria={criteria}
                    onCriteriaChange={setCriteria}
                    showResultsCount={false}
                    mode="consumer"
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading || !agentId}>
                    {loading ? "Creating..." : "Create Saved Search"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/client/dashboard")}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
