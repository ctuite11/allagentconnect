import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Search, Save, Download, BarChart3, MapPin, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

const AgentSearch = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Search criteria state
  const [listNumber, setListNumber] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Collapsible sections
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to access agent search");
        navigate("/auth");
        return;
      }
      setUser(user);
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const propertyTypeOptions = [
    { value: "single_family", label: "Single Family (SF)" },
    { value: "condo", label: "Condominium (CC)" },
    { value: "multi_family", label: "Multi Family (MF)" },
    { value: "land", label: "Land (LD)" },
    { value: "commercial", label: "Commercial (CI)" },
    { value: "business", label: "Business Opp. (BU)" },
    { value: "townhouse", label: "Townhouse (TH)" },
  ];

  const statusOptions = [
    { value: "active", label: "Active (ACT)" },
    { value: "pending", label: "Under Agreement (UAG)" },
    { value: "sold", label: "Sold (SLD)" },
    { value: "rented", label: "Rented (RNT)" },
    { value: "withdrawn", label: "Temporarily Withdrawn (WDN)" },
    { value: "expired", label: "Expired (EXP)" },
    { value: "canceled", label: "Canceled (CAN)" },
  ];

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  const toggleStatus = (value: string) => {
    setStatuses(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const handleViewResults = async () => {
    try {
      let query = supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters
      if (propertyTypes.length > 0) {
        query = query.in("property_type", propertyTypes);
      }

      if (statuses.length > 0) {
        query = query.in("status", statuses);
      }

      if (minPrice) {
        query = query.gte("price", parseFloat(minPrice));
      }

      if (maxPrice) {
        query = query.lte("price", parseFloat(maxPrice));
      }

      if (bedrooms) {
        query = query.gte("bedrooms", parseInt(bedrooms));
      }

      if (bathrooms) {
        query = query.gte("bathrooms", parseFloat(bathrooms));
      }

      if (minSqft) {
        query = query.gte("square_feet", parseInt(minSqft));
      }

      if (maxSqft) {
        query = query.lte("square_feet", parseInt(maxSqft));
      }

      if (city) {
        query = query.ilike("city", `%${city}%`);
      }

      if (zipCode) {
        query = query.eq("zip_code", zipCode);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      toast.success(`Found ${data?.length || 0} properties`);
      // Navigate to browse with search results
      navigate("/browse", { state: { searchResults: data } });
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Failed to perform search");
    }
  };

  const handleClear = () => {
    setListNumber("");
    setPropertyTypes([]);
    setStatuses([]);
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setBathrooms("");
    setMinSqft("");
    setMaxSqft("");
    setYearBuilt("");
    setCity("");
    setZipCode("");
    toast.success("Search criteria cleared");
  };

  const handleSaveSearch = async () => {
    try {
      const searchName = prompt("Enter a name for this search:");
      if (!searchName) return;

      const criteria = {
        propertyTypes,
        statuses,
        minPrice,
        maxPrice,
        bedrooms,
        bathrooms,
        minSqft,
        maxSqft,
        yearBuilt,
        city,
        zipCode,
      };

      const { error } = await supabase
        .from("hot_sheets")
        .insert({
          user_id: user.id,
          name: searchName,
          criteria,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Search saved successfully");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Failed to save search");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30 pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Agent Search</h1>
            <p className="text-muted-foreground">
              Advanced property search with comprehensive filtering options
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button onClick={handleViewResults} className="gap-2">
              <Search className="h-4 w-4" />
              View Results
            </Button>
            <Button variant="outline" onClick={handleSaveSearch} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Stats
            </Button>
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button variant="outline" className="gap-2">
              <MapPin className="h-4 w-4" />
              Map
            </Button>
          </div>

          {/* List Number */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">LIST NUMBER(S)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Enter listing number(s)"
                value={listNumber}
                onChange={(e) => setListNumber(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            {/* Property Type */}
            <Collapsible open={propertyTypeOpen} onOpenChange={setPropertyTypeOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">PROPERTY TYPE</CardTitle>
                    {propertyTypeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-types"
                        checked={propertyTypes.length === propertyTypeOptions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPropertyTypes(propertyTypeOptions.map(opt => opt.value));
                          } else {
                            setPropertyTypes([]);
                          }
                        }}
                      />
                      <Label htmlFor="select-all-types" className="font-semibold cursor-pointer">
                        Select All
                      </Label>
                    </div>
                    {propertyTypeOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={option.value}
                          checked={propertyTypes.includes(option.value)}
                          onCheckedChange={() => togglePropertyType(option.value)}
                        />
                        <Label htmlFor={option.value} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Status */}
            <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">STATUS</CardTitle>
                    {statusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-status"
                        checked={statuses.length === statusOptions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setStatuses(statusOptions.map(opt => opt.value));
                          } else {
                            setStatuses([]);
                          }
                        }}
                      />
                      <Label htmlFor="select-all-status" className="font-semibold cursor-pointer">
                        Select All
                      </Label>
                    </div>
                    {statusOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${option.value}`}
                          checked={statuses.includes(option.value)}
                          onCheckedChange={() => toggleStatus(option.value)}
                        />
                        <Label htmlFor={`status-${option.value}`} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Standard Search Criteria */}
            <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">STANDARD SEARCH CRITERIA</CardTitle>
                    {criteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="bedrooms">Bedrooms</Label>
                        <Input
                          id="bedrooms"
                          type="number"
                          min="0"
                          value={bedrooms}
                          onChange={(e) => setBedrooms(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bathrooms">Total Bathrooms</Label>
                        <Input
                          id="bathrooms"
                          type="number"
                          min="0"
                          step="0.5"
                          value={bathrooms}
                          onChange={(e) => setBathrooms(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="min-sqft">Min SqFt</Label>
                        <Input
                          id="min-sqft"
                          type="number"
                          min="0"
                          value={minSqft}
                          onChange={(e) => setMinSqft(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-sqft">Max SqFt</Label>
                        <Input
                          id="max-sqft"
                          type="number"
                          min="0"
                          value={maxSqft}
                          onChange={(e) => setMaxSqft(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="year-built">Year Built</Label>
                        <Input
                          id="year-built"
                          type="number"
                          min="1800"
                          max={new Date().getFullYear()}
                          value={yearBuilt}
                          onChange={(e) => setYearBuilt(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Price */}
          <Collapsible open={priceOpen} onOpenChange={setPriceOpen} className="mb-4">
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">PRICE</CardTitle>
                  {priceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min-price">Low</Label>
                      <Input
                        id="min-price"
                        type="number"
                        min="0"
                        placeholder="Minimum Price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-price">High</Label>
                      <Input
                        id="max-price"
                        type="number"
                        min="0"
                        placeholder="Maximum Price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Address */}
          <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">ADDRESS</CardTitle>
                  {addressOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="Enter city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zip-code">Zip Code</Label>
                      <Input
                        id="zip-code"
                        placeholder="Enter zip code"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AgentSearch;
