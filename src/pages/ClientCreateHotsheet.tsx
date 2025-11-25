import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { TownsPicker } from "@/components/TownsPicker";
import { useTownsPicker } from "@/hooks/useTownsPicker";

const propertyTypes = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
];

export default function ClientCreateHotsheet() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    propertyTypes: [] as string[],
    state: "MA",
  });
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);

  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: formData.state,
    showAreas: "no",
  });

  const toggleTown = (town: string) => {
    setSelectedTowns((prev) =>
      prev.includes(town) ? prev.filter((t) => t !== town) : [...prev, town]
    );
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) {
      toast.error("No active agent found");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const criteria = {
      state: formData.state,
      cities: selectedTowns,
      minPrice: formData.minPrice ? parseFloat(formData.minPrice) : undefined,
      maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
      bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
      propertyTypes: formData.propertyTypes.length > 0 ? formData.propertyTypes : undefined,
    };

    // Generate a name if not provided
    const name = formData.name || generateAutoName(criteria);

    const { data, error } = await supabase
      .from("hot_sheets")
      .insert({
        user_id: agentId,
        client_id: user.id,
        name,
        criteria,
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

  const generateAutoName = (criteria: any) => {
    const parts = [];
    if (criteria.cities && criteria.cities.length > 0) {
      parts.push(criteria.cities[0]);
    }
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
      parts.push(
        criteria.propertyTypes[0].replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
      );
    }
    if (criteria.maxPrice) {
      parts.push(`under $${(criteria.maxPrice / 1000).toFixed(0)}k`);
    }
    return parts.join(" ") || "My Saved Search";
  };

  const handlePropertyTypeToggle = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(value)
        ? prev.propertyTypes.filter((t) => t !== value)
        : [...prev.propertyTypes, value],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
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
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-generate a name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Property Types</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {propertyTypes.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={type.value}
                          checked={formData.propertyTypes.includes(type.value)}
                          onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                        />
                        <Label htmlFor={type.value} className="cursor-pointer">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Location (Select Cities/Towns)</Label>
                  <div className="border rounded-md p-2 max-h-64 overflow-y-auto">
                    <TownsPicker
                      towns={townsList}
                      selectedTowns={selectedTowns}
                      onToggleTown={toggleTown}
                      expandedCities={expandedCities}
                      onToggleCityExpansion={toggleCityExpansion}
                      state={formData.state}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Min Price</Label>
                    <Input
                      id="minPrice"
                      type="number"
                      placeholder="e.g., 500000"
                      value={formData.minPrice}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, minPrice: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Max Price</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      placeholder="e.g., 1000000"
                      value={formData.maxPrice}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, maxPrice: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Min Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      placeholder="e.g., 2"
                      value={formData.bedrooms}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, bedrooms: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Min Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      step="0.5"
                      placeholder="e.g., 1.5"
                      value={formData.bathrooms}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, bathrooms: e.target.value }))
                      }
                    />
                  </div>
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
