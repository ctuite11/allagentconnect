import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Search, Save, Download, BarChart3, MapPin, ChevronDown, ChevronUp, Trash2, Upload, Paperclip, Clock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const [rooms, setRooms] = useState("");
  const [acres, setAcres] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [pricePerSqft, setPricePerSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [totalParkingSpaces, setTotalParkingSpaces] = useState("");
  const [garageSpaces, setGarageSpaces] = useState("");
  const [nonGarageParkingSpaces, setNonGarageParkingSpaces] = useState("");
  const [listDate, setListDate] = useState("");
  const [offMarketTimeframe, setOffMarketTimeframe] = useState("TODAY - 6 MONTHS");
  const [addressType, setAddressType] = useState("street");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [radius, setRadius] = useState("");
  const [selectedState, setSelectedState] = useState("MA");
  const [selectedCounty, setSelectedCounty] = useState("Suffolk County");
  const [townSearch, setTownSearch] = useState("");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showTownAreas, setShowTownAreas] = useState("yes");
  const [openHouses, setOpenHouses] = useState(false);
  const [brokerTours, setBrokerTours] = useState(false);
  const [eventTimeframe, setEventTimeframe] = useState("Next 3 Days");
  const [keywordMatch, setKeywordMatch] = useState("any");
  const [keywordType, setKeywordType] = useState("include");
  const [keywords, setKeywords] = useState("");
  
  // Collapsible sections
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [additionalCriteriaOpen, setAdditionalCriteriaOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [townsOpen, setTownsOpen] = useState(false);
  const [listingEventsOpen, setListingEventsOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);

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
    { value: "new", label: "New (NEW)", primary: true },
    { value: "active", label: "Active (ACT)", primary: true },
    { value: "price_changed", label: "Price Changed (PCG)", primary: true },
    { value: "back_on_market", label: "Back on Market (BOM)", primary: true },
    { value: "extended", label: "Extended (EXT)", primary: true },
    { value: "reactivated", label: "Reactivated (RAC)", primary: true },
    { value: "contingent", label: "Contingent (CTG)", primary: false },
    { value: "pending", label: "Under Agreement (UAG)", primary: false },
    { value: "sold", label: "Sold (SLD)", primary: false },
    { value: "rented", label: "Rented (RNT)", primary: false },
    { value: "withdrawn", label: "Temporarily Withdrawn (WDN)", primary: false },
    { value: "expired", label: "Expired (EXP)", primary: false },
    { value: "canceled", label: "Canceled (CAN)", primary: false },
    { value: "coming_soon", label: "Coming Soon (CSO)", primary: false },
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
    setRooms("");
    setAcres("");
    setMinSqft("");
    setMaxSqft("");
    setPricePerSqft("");
    setYearBuilt("");
    setTotalParkingSpaces("");
    setGarageSpaces("");
    setNonGarageParkingSpaces("");
    setListDate("");
    setOffMarketTimeframe("TODAY - 6 MONTHS");
    setAddressType("street");
    setStreetNumber("");
    setStreetName("");
    setZipCode("");
    setRadius("");
    setSelectedState("MA");
    setSelectedCounty("Suffolk County");
    setTownSearch("");
    setSelectedTowns([]);
    setShowTownAreas("yes");
    setOpenHouses(false);
    setBrokerTours(false);
    setEventTimeframe("Next 3 Days");
    setKeywordMatch("any");
    setKeywordType("include");
    setKeywords("");
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
        zipCode,
        streetNumber,
        streetName,
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
          <div className="flex flex-wrap gap-2 mb-6 items-center">
            <Button onClick={handleViewResults} className="gap-2">
              <Search className="h-4 w-4" />
              View Results
            </Button>
            <Button variant="outline" onClick={handleSaveSearch} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Load
            </Button>
            <Button variant="outline" className="gap-2">
              <Paperclip className="h-4 w-4" />
              Attach
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
            <Button variant="outline" className="gap-2">
              <Clock className="h-4 w-4" />
              Recent
              <ChevronDown className="h-4 w-4" />
            </Button>
            <div className="ml-auto bg-warning text-warning-foreground px-3 py-1.5 rounded-md font-semibold">
              6,797 Results
            </div>
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
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
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
                        {statusOptions.filter(opt => opt.primary).map((option) => (
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
                      </div>
                      <div className="space-y-3">
                        {statusOptions.filter(opt => !opt.primary).map((option) => (
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
                        <div className="pt-2 space-y-2">
                          <div>
                            <Label htmlFor="list-date" className="text-sm">List Date</Label>
                            <Input
                              id="list-date"
                              type="date"
                              value={listDate}
                              onChange={(e) => setListDate(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="off-market-timeframe" className="text-sm">Off-Market Timeframe</Label>
                            <Select value={offMarketTimeframe} onValueChange={setOffMarketTimeframe}>
                              <SelectTrigger id="off-market-timeframe" className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TODAY - 6 MONTHS">TODAY - 6 MONTHS</SelectItem>
                                <SelectItem value="TODAY - 3 MONTHS">TODAY - 3 MONTHS</SelectItem>
                                <SelectItem value="TODAY - 1 MONTH">TODAY - 1 MONTH</SelectItem>
                                <SelectItem value="TODAY - 1 YEAR">TODAY - 1 YEAR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
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
                        <Label htmlFor="rooms">Rooms</Label>
                        <Input
                          id="rooms"
                          type="number"
                          min="0"
                          value={rooms}
                          onChange={(e) => setRooms(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="acres">Acres</Label>
                        <Input
                          id="acres"
                          type="number"
                          min="0"
                          step="0.01"
                          value={acres}
                          onChange={(e) => setAcres(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="min-sqft">Living Area Total (SqFt)</Label>
                        <Input
                          id="min-sqft"
                          type="number"
                          min="0"
                          placeholder="Min"
                          value={minSqft}
                          onChange={(e) => setMinSqft(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="price-per-sqft">Price per SqFt</Label>
                        <Input
                          id="price-per-sqft"
                          type="number"
                          min="0"
                          value={pricePerSqft}
                          onChange={(e) => setPricePerSqft(e.target.value)}
                        />
                      </div>
                      <div>
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
                      <div>
                        <Label htmlFor="total-parking">Total Parking Spaces</Label>
                        <Input
                          id="total-parking"
                          type="number"
                          min="0"
                          value={totalParkingSpaces}
                          onChange={(e) => setTotalParkingSpaces(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="garage-spaces">Garage Spaces</Label>
                        <Input
                          id="garage-spaces"
                          type="number"
                          min="0"
                          value={garageSpaces}
                          onChange={(e) => setGarageSpaces(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="non-garage-parking">Parking Spaces (Non-Garage)</Label>
                        <Input
                          id="non-garage-parking"
                          type="number"
                          min="0"
                          value={nonGarageParkingSpaces}
                          onChange={(e) => setNonGarageParkingSpaces(e.target.value)}
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
                  <RadioGroup value={addressType} onValueChange={setAddressType}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="street" id="street-address" />
                        <Label htmlFor="street-address" className="cursor-pointer">Street Address</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="location" id="my-location" />
                        <Label htmlFor="my-location" className="cursor-pointer">My Location</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="street-number">Street #</Label>
                      <Input
                        id="street-number"
                        placeholder="Number"
                        value={streetNumber}
                        onChange={(e) => setStreetNumber(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="street-name">Street Name</Label>
                      <Input
                        id="street-name"
                        placeholder="Street name"
                        value={streetName}
                        onChange={(e) => setStreetName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zip">Zip Code</Label>
                      <Input
                        id="zip"
                        placeholder="Zip"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="w-32">
                    <Label htmlFor="radius">Radius</Label>
                    <Select value={radius} onValueChange={setRadius}>
                      <SelectTrigger id="radius">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.25">0.25 mi</SelectItem>
                        <SelectItem value="0.5">0.5 mi</SelectItem>
                        <SelectItem value="1">1 mi</SelectItem>
                        <SelectItem value="2">2 mi</SelectItem>
                        <SelectItem value="5">5 mi</SelectItem>
                        <SelectItem value="10">10 mi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Towns */}
          <Collapsible open={townsOpen} onOpenChange={setTownsOpen} className="mb-4">
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">TOWNS</CardTitle>
                  {townsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="link" className="text-primary gap-1 p-0 h-auto">
                      BACK TO TOP
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Select value={selectedState} onValueChange={setSelectedState}>
                            <SelectTrigger id="state">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MA">MA</SelectItem>
                              <SelectItem value="NH">NH</SelectItem>
                              <SelectItem value="RI">RI</SelectItem>
                              <SelectItem value="CT">CT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="county">Coverage Areas</Label>
                          <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                            <SelectTrigger id="county">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Suffolk County">Suffolk County</SelectItem>
                              <SelectItem value="Middlesex County">Middlesex County</SelectItem>
                              <SelectItem value="Norfolk County">Norfolk County</SelectItem>
                              <SelectItem value="Essex County">Essex County</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Show Areas</Label>
                          <RadioGroup value={showTownAreas} onValueChange={setShowTownAreas} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="show-yes" />
                              <Label htmlFor="show-yes" className="cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="show-no" />
                              <Label htmlFor="show-no" className="cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="relative">
                          <Input
                            placeholder="Type Full or Partial Name"
                            value={townSearch}
                            onChange={(e) => setTownSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="border rounded-md p-3 max-h-64 overflow-y-auto">
                        <p className="font-semibold mb-2">- Add All Towns -</p>
                        <div className="space-y-1 text-sm">
                          <p className="cursor-pointer hover:bg-muted p-1 rounded" onClick={() => !selectedTowns.includes("Boston, MA") && setSelectedTowns([...selectedTowns, "Boston, MA"])}>Boston, MA</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Aberdeen") && setSelectedTowns([...selectedTowns, "Boston, MA-Aberdeen"])}>Boston, MA-Aberdeen</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Allston") && setSelectedTowns([...selectedTowns, "Boston, MA-Allston"])}>Boston, MA-Allston</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Back Bay") && setSelectedTowns([...selectedTowns, "Boston, MA-Back Bay"])}>Boston, MA-Back Bay</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Bay Village") && setSelectedTowns([...selectedTowns, "Boston, MA-Bay Village"])}>Boston, MA-Bay Village</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Beacon Hill") && setSelectedTowns([...selectedTowns, "Boston, MA-Beacon Hill"])}>Boston, MA-Beacon Hill</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Brighton") && setSelectedTowns([...selectedTowns, "Boston, MA-Brighton"])}>Boston, MA-Brighton</p>
                          <p className="cursor-pointer hover:bg-muted p-1 rounded pl-4" onClick={() => !selectedTowns.includes("Boston, MA-Brighton's Chestnut Hill") && setSelectedTowns([...selectedTowns, "Boston, MA-Brighton's Chestnut Hill"])}>Boston, MA-Brighton's Chestnut Hill</p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="multiple-towns">Type Multiple Towns/Areas</Label>
                        <Textarea
                          id="multiple-towns"
                          placeholder="Type Towns/Areas"
                          className="mt-1 min-h-20"
                        />
                        <Button variant="default" size="sm" className="mt-2">Add</Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Selected Towns</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedTowns([])}
                        >
                          Remove All
                        </Button>
                      </div>
                      <div className="border rounded-md p-3 min-h-64 max-h-64 overflow-y-auto">
                        {selectedTowns.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No towns selected</p>
                        ) : (
                          <div className="space-y-1">
                            {selectedTowns.map((town, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span>{town}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => setSelectedTowns(selectedTowns.filter((_, i) => i !== index))}
                                >
                                  ✕
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Listing Events */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Collapsible open={listingEventsOpen} onOpenChange={setListingEventsOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">LISTING EVENTS</CardTitle>
                    {listingEventsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="open-houses"
                          checked={openHouses}
                          onCheckedChange={(checked) => setOpenHouses(checked as boolean)}
                        />
                        <Label htmlFor="open-houses" className="cursor-pointer flex items-center gap-1">
                          🏠 Open Houses
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="broker-tours"
                          checked={brokerTours}
                          onCheckedChange={(checked) => setBrokerTours(checked as boolean)}
                        />
                        <Label htmlFor="broker-tours" className="cursor-pointer flex items-center gap-1">
                          🚐 Broker Tours
                        </Label>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="event-timeframe">For:</Label>
                      <Select value={eventTimeframe} onValueChange={setEventTimeframe}>
                        <SelectTrigger id="event-timeframe" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Today">Today</SelectItem>
                          <SelectItem value="Tomorrow">Tomorrow</SelectItem>
                          <SelectItem value="Next 3 Days">Next 3 Days</SelectItem>
                          <SelectItem value="Next 7 Days">Next 7 Days</SelectItem>
                          <SelectItem value="Next 30 Days">Next 30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Keywords */}
            <Collapsible open={keywordsOpen} onOpenChange={setKeywordsOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">KEYWORDS (Public Remarks only)</CardTitle>
                    {keywordsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <RadioGroup value={keywordMatch} onValueChange={setKeywordMatch} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="any" id="keyword-any" />
                          <Label htmlFor="keyword-any" className="cursor-pointer">Any</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="keyword-all" />
                          <Label htmlFor="keyword-all" className="cursor-pointer">All</Label>
                        </div>
                      </RadioGroup>

                      <RadioGroup value={keywordType} onValueChange={setKeywordType} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="include" id="keyword-include" />
                          <Label htmlFor="keyword-include" className="cursor-pointer">Include</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="exclude" id="keyword-exclude" />
                          <Label htmlFor="keyword-exclude" className="cursor-pointer">Exclude</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <Textarea
                      placeholder="Enter keywords to search in public remarks..."
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      className="min-h-32"
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AgentSearch;
