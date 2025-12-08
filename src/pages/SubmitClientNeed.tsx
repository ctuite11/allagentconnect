import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";

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
    .transform(val => val.replace(/,/g, ''))
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), "Price must be a valid number")
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
  
  // Geographic selection state - EXACTLY like Hot Sheets
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [multiTownInput, setMultiTownInput] = useState("");
  const [showAreas, setShowAreas] = useState<boolean>(true);
  const [townsOpen, setTownsOpen] = useState(false);
  
  // Counties for selected state
  const [counties, setCounties] = useState<Array<{ id: string; name: string; state: string }>>([]);

  // Use the EXACT same hook pattern as Hot Sheets
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: state,
    county: selectedCountyId,
    showAreas: showAreas,
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

  // Toggle city - EXACTLY like Hot Sheets
  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  // Select all towns - EXACTLY like Hot Sheets
  const selectAllTowns = () => {
    const allSelections = [...townsList];
    
    // If showAreas is enabled, include all neighborhoods for each town
    if (showAreas) {
      const stateKey = state && state.length > 2 
        ? (US_STATES.find(s => s.name.toLowerCase() === state.toLowerCase())?.code ?? state)
        : state?.toUpperCase();

      townsList.forEach(town => {
        // Skip if this is already a neighborhood entry
        if (town.includes('-')) return;
        
        // Get neighborhoods from the data
        const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
        let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
        
        // Also check for hyphenated neighborhoods in the towns list
        if ((neighborhoods?.length ?? 0) === 0) {
          neighborhoods = Array.from(new Set(
            townsList
              .filter((t) => t.startsWith(`${town}-`))
              .map((t) => t.split('-').slice(1).join('-'))
          ));
        }
        
        if (neighborhoods && neighborhoods.length > 0) {
          neighborhoods.forEach((n: string) => {
            const fullEntry = `${town}-${n}`;
            if (!allSelections.includes(fullEntry)) {
              allSelections.push(fullEntry);
            }
          });
        }
      });
    }
    
    setSelectedCities(allSelections);
  };

  // Add multiple towns - EXACTLY like Hot Sheets
  const handleAddMultipleTowns = () => {
    if (!multiTownInput.trim()) return;
    
    const towns = multiTownInput.split(',').map(t => t.trim()).filter(Boolean);
    const newTowns = towns.filter(t => !selectedCities.includes(t));
    
    if (newTowns.length > 0) {
      setSelectedCities(prev => [...prev, ...newTowns]);
      toast.success(`Added ${newTowns.length} town(s)`);
    }
    
    setMultiTownInput("");
  };

  // Load counties for selected state
  useEffect(() => {
    const loadCounties = async () => {
      if (!state) {
        setCounties([]);
        return;
      }
      
      try {
        // First try COUNTIES_BY_STATE
        const stateCode = state.length > 2 
          ? US_STATES.find(s => s.name === state)?.code 
          : state;
        
        if (stateCode && COUNTIES_BY_STATE[stateCode]) {
          const stateCounties = COUNTIES_BY_STATE[stateCode].map(name => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            state: stateCode
          }));
          setCounties(stateCounties);
        } else {
          // Fallback to database
          const { data, error } = await supabase
            .from("counties")
            .select("*")
            .eq("state", stateCode || state)
            .order("name");
          
          if (!error && data) {
            setCounties(data);
          }
        }
      } catch (error) {
        console.error("Error loading counties:", error);
      }
    };
    
    loadCounties();
    // Reset county selection when state changes
    setSelectedCountyId("all");
    setSelectedCities([]);
  }, [state]);

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
        locations: selectedCities,
      };
      
      // Validate input
      const validatedData = clientNeedSchema.parse(dataToValidate);

      // Extract city/state from first selected location for database compatibility
      const firstLocation = selectedCities[0] || "";
      const city = firstLocation.includes("-") ? firstLocation.split("-")[0] : firstLocation;

      const { error: insertError } = await supabase.from("client_needs").insert({
        submitted_by: user?.id,
        property_type: validatedData.propertyTypes[0] as any,
        property_types: validatedData.propertyTypes as any,
        city: city,
        state: state,
        max_price: parseFloat(validatedData.maxPrice.replace(/,/g, '')),
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

              {/* Location Section - EXACTLY like Hot Sheets */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Location</Label>
                
                {/* State and County - Always visible, side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">State</Label>
                    <Select value={state} onValueChange={(val) => setState(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">County</Label>
                    <Select value={selectedCountyId} onValueChange={(val) => setSelectedCountyId(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Counties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Counties</SelectItem>
                        {counties.map((county) => (
                          <SelectItem key={county.id} value={county.name}>
                            {county.name} County
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Towns & Neighborhoods Section - Collapsible, EXACTLY like Hot Sheets */}
                <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-3 rounded-md border">
                      <Label className="text-sm font-semibold uppercase cursor-pointer">
                        Towns & Neighborhoods
                        {selectedCities.length > 0 && (
                          <span className="ml-2 text-xs font-normal text-green-600">
                            ({selectedCities.length} selected)
                          </span>
                        )}
                      </Label>
                      {townsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 pt-4">
                      {/* Show Areas Yes/No */}
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">Show Areas</Label>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="show-yes"
                              name="show-areas"
                              checked={showAreas === true}
                              onChange={() => setShowAreas(true)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="show-yes" className="text-sm">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="show-no"
                              name="show-areas"
                              checked={showAreas === false}
                              onChange={() => setShowAreas(false)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="show-no" className="text-sm">No</Label>
                          </div>
                        </div>
                      </div>

                      {/* Two-column: Towns picker + Selected towns */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Input
                            placeholder="Type Full or Partial Name"
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="text-sm"
                          />
                          <div className="border rounded-md bg-background max-h-60 overflow-y-auto p-2 relative z-10">
                            {selectedCountyId && townsList.length > 0 && (
                              <button
                                type="button"
                                onClick={selectAllTowns}
                                className="w-full text-left px-2 py-1.5 text-sm font-semibold hover:bg-muted rounded mb-1 border-b pb-2"
                              >
                                {selectedCountyId === "all" 
                                  ? `✓ Add All Towns from All Counties` 
                                  : `✓ Add All Towns in County (${townsList.length})`}
                              </button>
                            )}
                            <TownsPicker
                              towns={townsList}
                              selectedTowns={selectedCities}
                              onToggleTown={toggleCity}
                              expandedCities={expandedCities}
                              onToggleCityExpansion={toggleCityExpansion}
                              state={state}
                              searchQuery={citySearch}
                              variant="button"
                              showAreas={showAreas}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Selected Towns</Label>
                            {selectedCities.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCities([])}
                                className="h-7 px-2 text-xs"
                              >
                                Remove All
                              </Button>
                            )}
                          </div>
                          <div className="border rounded-md p-3 bg-background min-h-[200px] max-h-60 overflow-y-auto">
                            {selectedCities.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No towns selected</p>
                            ) : (
                              selectedCities.map((city) => (
                                <button
                                  key={city}
                                  type="button"
                                  onClick={() => toggleCity(city)}
                                  className="w-full text-left py-1 px-2 text-sm border-b last:border-b-0 hover:bg-muted rounded cursor-pointer"
                                >
                                  {city}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Multi-town input */}
                      <div className="space-y-2">
                        <Label className="text-sm">Type Multiple Towns/Areas</Label>
                        <p className="text-xs text-muted-foreground">Separate multiple towns with commas</p>
                        <div className="flex gap-2">
                          <Input
                            value={multiTownInput}
                            onChange={(e) => setMultiTownInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddMultipleTowns();
                              }
                            }}
                            placeholder="e.g. Northborough, Worcester, Boston"
                            className="text-sm flex-1"
                          />
                          <Button 
                            type="button" 
                            onClick={handleAddMultipleTowns}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 text-sm"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div>
                <Label htmlFor="maxPrice">Maximum Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="maxPrice"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formData.maxPrice}
                    onChange={(e) => {
                      // Remove non-numeric characters except commas
                      const sanitized = e.target.value.replace(/[^\d,]/g, '');
                      const numericValue = sanitized.replace(/,/g, '');
                      
                      // Format with commas
                      const num = parseFloat(numericValue);
                      if (!isNaN(num) && num > 999999999) return;
                      
                      const formatted = numericValue 
                        ? num.toLocaleString('en-US', { maximumFractionDigits: 0 }) 
                        : "";
                      setFormData({ ...formData, maxPrice: formatted });
                    }}
                    placeholder="5,000,000"
                    className="pl-7"
                  />
                </div>
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
