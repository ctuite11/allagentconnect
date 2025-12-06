import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

const PROPERTY_TYPES = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "commercial",
  "residential_rental",
  "commercial_rental",
] as const;

const PROPERTY_TYPE_LABELS: Record<typeof PROPERTY_TYPES[number], string> = {
  single_family: "Single Family",
  condo: "Condominium",
  townhouse: "Townhouse",
  multi_family: "Multi-Family",
  land: "Land",
  commercial: "Commercial",
  residential_rental: "Residential Rental",
  commercial_rental: "Commercial Rental",
};

const clientNeedSchema = z.object({
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).min(1, "Select at least one property type"),
  locations: z.array(z.string()).min(1, "Select at least one location"),
  maxPrice: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid number")
    .refine((val) => parseFloat(val) > 0 && parseFloat(val) < 100000000, {
      message: "Price must be between $1 and $100,000,000",
    }),
  bedrooms: z.string()
    .regex(/^\d*$/, "Bedrooms must be a whole number")
    .optional()
    .or(z.literal("")),
  bathrooms: z.string()
    .regex(/^\d*(\.\d{1})?$/, "Bathrooms must be a number (e.g., 2.5)")
    .optional()
    .or(z.literal("")),
  description: z.string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
});

const SubmitClientNeed = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyTypes: [] as string[],
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    description: "",
  });
  
  // Geographic selection state
  const [geoSelection, setGeoSelection] = useState<GeographicSelection>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
  });

  // Property type helpers
  const toggleType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(type)
        ? prev.propertyTypes.filter((t: string) => t !== type)
        : [...prev.propertyTypes, type],
    }));
  };
  const allSelected = formData.propertyTypes.length === PROPERTY_TYPES.length;
  const toggleSelectAll = () => {
    setFormData((prev) => ({
      ...prev,
      propertyTypes: allSelected ? [] : [...PROPERTY_TYPES],
    }));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build validation data with locations
      const dataToValidate = {
        ...formData,
        locations: geoSelection.towns,
      };
      
      // Validate input
      const validatedData = clientNeedSchema.parse(dataToValidate);

      // Extract city/state from first selected location for database compatibility
      const firstLocation = geoSelection.towns[0] || "";
      const city = firstLocation.includes("-") ? firstLocation.split("-")[0] : firstLocation;

      const { error: insertError } = await supabase.from("client_needs").insert({
        submitted_by: user?.id,
        property_type: validatedData.propertyTypes[0] as any,
        property_types: validatedData.propertyTypes as any,
        city: city,
        state: geoSelection.state,
        max_price: parseFloat(validatedData.maxPrice),
        bedrooms: validatedData.bedrooms ? parseInt(validatedData.bedrooms) : null,
        bathrooms: validatedData.bathrooms ? parseFloat(validatedData.bathrooms) : null,
        description: validatedData.description || null,
      } as any);

      if (insertError) throw insertError;

      toast.success("Client need submitted successfully!");

      navigate("/agent-dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error submitting client need: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Submit Client Need</CardTitle>
            <CardDescription>
              Fill out the details for your client's real estate needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="propertyTypes">Property Type</Label>
                <div className="space-y-3">
                  <Button
                    type="button"
                    onClick={toggleSelectAll}
                    variant={allSelected ? "outline" : "default"}
                    className="h-9"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 max-h-64 overflow-y-auto bg-background">
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type}`}
                          checked={formData.propertyTypes.includes(type)}
                          onCheckedChange={() => toggleType(type)}
                        />
                        <Label htmlFor={`type-${type}`} className="cursor-pointer">
                          {PROPERTY_TYPE_LABELS[type]}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{formData.propertyTypes.length} selected</p>
                </div>
              </div>

              <div>
                <Label>Location</Label>
                <GeographicSelector
                  value={geoSelection}
                  onChange={setGeoSelection}
                  defaultCollapsed={false}
                />
              </div>

              <div>
                <Label htmlFor="maxPrice">Maximum Price ($)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  required
                  value={formData.maxPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPrice: e.target.value })
                  }
                  placeholder="5000000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, bedrooms: e.target.value })
                    }
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    step="0.5"
                    value={formData.bathrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, bathrooms: e.target.value })
                    }
                    placeholder="2.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Additional details about the client's needs..."
                  rows={4}
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Client Need"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/agent-dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmitClientNeed;
