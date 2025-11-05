import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronDown, ChevronUp, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";
import { CT_COUNTY_TOWNS } from "@/data/ctCountyTowns";
import { RI_COUNTY_TOWNS } from "@/data/riCountyTowns";
import { NH_COUNTY_TOWNS } from "@/data/nhCountyTowns";
import { VT_COUNTY_TOWNS } from "@/data/vtCountyTowns";
import { ME_COUNTY_TOWNS } from "@/data/meCountyTowns";

const BrowseProperties = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Address filters
  const [addressType, setAddressType] = useState("street");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [radius, setRadius] = useState("");
  
  // Town filters
  const [state, setState] = useState("MA");
  const [county, setCounty] = useState("all");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState("yes");
  const [townSearch, setTownSearch] = useState("");
  const [manualTowns, setManualTowns] = useState("");
  
  // Listing events
  const [openHouses, setOpenHouses] = useState(false);
  const [brokerTours, setBrokerTours] = useState(false);
  const [eventTimeframe, setEventTimeframe] = useState("next_3_days");
  const [listingNumber, setListingNumber] = useState("");
  
  // Property Type filters
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  
  // Status filters
  const [statuses, setStatuses] = useState<string[]>(["active"]);
  
  // Price filters
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // Standard criteria
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rooms, setRooms] = useState("");
  const [acres, setAcres] = useState("");
  const [livingArea, setLivingArea] = useState("");
  const [pricePerSqFt, setPricePerSqFt] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [totalParkingSpaces, setTotalParkingSpaces] = useState("");
  const [garageSpaces, setGarageSpaces] = useState("");
  const [nonGarageSpaces, setNonGarageSpaces] = useState("");
  
  // Keywords
  const [keywords, setKeywords] = useState("");
  const [keywordMatch, setKeywordMatch] = useState("any");
  const [keywordType, setKeywordType] = useState("include");
  
  // Collapsible sections
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isListingEventsOpen, setIsListingEventsOpen] = useState(true);
  const [isTownsOpen, setIsTownsOpen] = useState(true);
  const [isPropertyTypeOpen, setIsPropertyTypeOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(true);
  const [isKeywordsOpen, setIsKeywordsOpen] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [statuses, propertyTypes, minPrice, maxPrice, bedrooms, bathrooms, county, selectedTowns, zipCode, listingNumber]);

  // Reset selected towns when county changes
  useEffect(() => {
    setSelectedTowns([]);
  }, [county]);

  // Reset county and towns when state changes
  useEffect(() => {
    setCounty("all");
    setSelectedTowns([]);
    setTownSearch("");
  }, [state]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply status filter
      if (statuses.length > 0) {
        query = query.in("status", statuses);
      }

      // Apply property type filter
      if (propertyTypes.length > 0) {
        query = query.in("property_type", propertyTypes);
      }

      // Apply price filters
      if (minPrice) {
        query = query.gte("price", parseFloat(minPrice));
      }
      if (maxPrice) {
        query = query.lte("price", parseFloat(maxPrice));
      }

      // Apply bedrooms filter
      if (bedrooms) {
        query = query.gte("bedrooms", parseInt(bedrooms));
      }

      // Apply bathrooms filter
      if (bathrooms) {
        query = query.gte("bathrooms", parseFloat(bathrooms));
      }

      // Apply zip code filter
      if (zipCode) {
        query = query.ilike("zip_code", `%${zipCode}%`);
      }

      // Apply listing number filter
      if (listingNumber) {
        query = query.ilike("listing_number", `%${listingNumber}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setListings(data || []);
    } catch (error: any) {
      toast.error("Failed to load properties");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statuses.length) params.set("status", statuses.join(","));
    if (propertyTypes.length) params.set("type", propertyTypes.join(","));
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (bathrooms) params.set("bathrooms", bathrooms);
    if (rooms) params.set("rooms", rooms);
    if (acres) params.set("acres", acres);
    if (livingArea) params.set("livingArea", livingArea);
    if (pricePerSqFt) params.set("pricePerSqFt", pricePerSqFt);
    if (yearBuilt) params.set("yearBuilt", yearBuilt);
    if (zipCode) params.set("zip", zipCode);
    if (streetName) params.set("streetName", streetName);
    if (streetNumber) params.set("streetNumber", streetNumber);
    if (radius) params.set("radius", radius);
    if (state) params.set("state", state);
    if (county) params.set("county", county);
    if (selectedTowns.length) params.set("towns", selectedTowns.join("|"));
    if (showAreas) params.set("showAreas", showAreas);
    if (listingNumber) params.set("listingNumber", listingNumber);
    if (openHouses) params.set("openHouses", String(openHouses));
    if (brokerTours) params.set("brokerTours", String(brokerTours));
    if (eventTimeframe) params.set("eventTimeframe", eventTimeframe);
    if (keywords) params.set("keywords", keywords);
    if (keywordMatch) params.set("keywordMatch", keywordMatch);
    if (keywordType) params.set("keywordType", keywordType);
    return params;
  };

  const handleViewResults = () => {
    const params = buildQueryParams();
    navigate(`/search-results?${params.toString()}`);
  };

  const handleClearAll = () => {
    setAddressType("street");
    setStreetNumber("");
    setStreetName("");
    setZipCode("");
    setRadius("");
    setState("MA");
    setCounty("all");
    setSelectedTowns([]);
    setShowAreas("yes");
    setTownSearch("");
    setManualTowns("");
    setOpenHouses(false);
    setBrokerTours(false);
    setEventTimeframe("next_3_days");
    setListingNumber("");
    setPropertyTypes([]);
    setStatuses(["active"]);
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setBathrooms("");
    setRooms("");
    setAcres("");
    setLivingArea("");
    setPricePerSqFt("");
    setYearBuilt("");
    setTotalParkingSpaces("");
    setGarageSpaces("");
    setNonGarageSpaces("");
    setKeywords("");
    setKeywordMatch("any");
    setKeywordType("include");
    toast.success("All filters cleared");
  };

  const handlePropertyTypeToggle = (type: string) => {
    setPropertyTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleStatusToggle = (status: string) => {
    setStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const currentStateCounties = getCountiesForState(state);
  const currentStateCities = usCitiesByState[state] || [];
  // New England states have county-to-towns mapping
  const hasCountyData = ["MA", "CT", "RI", "NH", "VT", "ME"].includes(state);
  
  // Generate town list with neighborhoods
  const getTownsList = () => {
    // Build a base list of cities depending on county selection
    let baseCities: string[] = [];
    if (county === "all") {
      baseCities = currentStateCities;
    } else {
      // Get county-specific towns based on state
      const countyMap = {
        MA: MA_COUNTY_TOWNS,
        CT: CT_COUNTY_TOWNS,
        RI: RI_COUNTY_TOWNS,
        NH: NH_COUNTY_TOWNS,
        VT: VT_COUNTY_TOWNS,
        ME: ME_COUNTY_TOWNS
      }[state];
      
      baseCities = countyMap?.[county] || currentStateCities;
    }

    const towns: string[] = [];
    baseCities.forEach((city) => {
      towns.push(`${city}, ${state}`);
      if (showAreas === "yes") {
        const neighborhoods = getAreasForCity(city, state);
        neighborhoods.forEach((neighborhood) => {
          towns.push(`${city}, ${state}-${neighborhood}`);
        });
      }
    });

    return towns;
  };
  
  const filteredTowns = getTownsList().filter(town => 
    town.toLowerCase().includes(townSearch.toLowerCase())
  );
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const addManualTowns = () => {
    if (manualTowns.trim()) {
      const newTowns = manualTowns.split(',').map(t => t.trim()).filter(t => t);
      setSelectedTowns([...selectedTowns, ...newTowns]);
      setManualTowns("");
      toast.success("Towns added to selection");
    }
  };
  
  const removeAllTowns = () => {
    setSelectedTowns([]);
    toast.success("All towns removed");
  };
  
  const addAllTowns = () => {
    setSelectedTowns(getTownsList());
    toast.success("All towns added");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30 pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">Property Search</h1>
            <p className="text-muted-foreground">
              Advanced search with comprehensive filters
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button onClick={handleViewResults}>View Results</Button>
            <Button variant="outline">Save</Button>
            <Button variant="outline">Load</Button>
            <Button variant="outline">Attach</Button>
            <Button variant="outline">Download</Button>
            <Button variant="outline">Stats</Button>
            <Button variant="outline" onClick={handleClearAll}>Clear</Button>
            <Button variant="outline">Map</Button>
            <Button variant="outline">Recent</Button>
            <div className="ml-auto text-sm text-muted-foreground">Count: {loading ? "…" : `${listings.length} Results`}</div>
          </div>

          {/* LIST NUMBER(S) Full Width */}
          <div className="mb-6">
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center justify-between w-full p-4">
                <h3 className="font-semibold text-sm text-primary">LIST NUMBER(S)</h3>
              </div>
              <div className="p-4 pt-0">
                <Input
                  value={listingNumber}
                  onChange={(e) => setListingNumber(e.target.value)}
                  placeholder=""
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {/* PROPERTY TYPE Section */}
            <Collapsible open={isPropertyTypeOpen} onOpenChange={setIsPropertyTypeOpen} className="lg:col-span-1">
              <div className="bg-card rounded-lg shadow-sm border">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">PROPERTY TYPE</h3>
                    <span className="text-yellow-600">⭐</span>
                  </div>
                  {isPropertyTypeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 pt-0 space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="type-select-all"
                        checked={propertyTypes.length === 8}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPropertyTypes(["Single Family", "Condominium", "Multi Family", "Land", "Commercial", "Business Opp.", "Residential Rental", "Mobile Home"]);
                          } else {
                            setPropertyTypes([]);
                          }
                        }}
                      />
                      <label htmlFor="type-select-all" className="text-xs cursor-pointer">Select All</label>
                    </div>
                    {[
                      { value: "Single Family", label: "Single Family" },
                      { value: "Condominium", label: "Condominium" },
                      { value: "Multi Family", label: "Multi Family" },
                      { value: "Land", label: "Land" },
                      { value: "Commercial", label: "Commercial" },
                      { value: "Business Opp.", label: "Business Opportunity" },
                      { value: "Residential Rental", label: "Residential Rental" },
                      { value: "Mobile Home", label: "Mobile Home" }
                    ].map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={propertyTypes.includes(type.value)}
                          onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                        />
                        <label htmlFor={`type-${type.value}`} className="text-xs cursor-pointer">{type.label}</label>
                      </div>
                    ))}
                    <div className="pt-2 border-t mt-2">
                      <div className="flex items-center gap-2 mt-2">
                        <Label className="text-xs block font-semibold">TOWNS</Label>
                        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-lime-500 text-white text-[8px] font-bold">?</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* STATUS Section - now spans 1 column */}
            <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen} className="lg:col-span-1">
              <div className="bg-card rounded-lg shadow-sm border">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">STATUS</h3>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                  </div>
                  {isStatusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 pt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left column: Select All + statuses */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            id="status-select-all"
                            checked={statuses.length >= 5}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setStatuses(["active", "coming_soon", "off_market", "pending", "sold"]);
                              } else {
                                setStatuses([]);
                              }
                            }}
                          />
                          <label htmlFor="status-select-all" className="text-xs cursor-pointer">Select All</label>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {[
                            { value: "active", label: "New" },
                            { value: "active", label: "Active" },
                            { value: "coming_soon", label: "Price Changed" },
                            { value: "off_market", label: "Back on Market" },
                            { value: "pending", label: "Extended" },
                            { value: "sold", label: "Reactivated" },
                            { value: "sold", label: "Contingent" },
                            { value: "pending", label: "Under Agreement" },
                            { value: "sold", label: "Sold" },
                            { value: "off_market", label: "Rented" },
                            { value: "off_market", label: "Temporarily Withdrawn" },
                            { value: "off_market", label: "Expired" },
                            { value: "off_market", label: "Canceled" },
                            { value: "coming_soon", label: "Coming Soon" },
                          ].map((status, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <Checkbox
                                id={`status-${idx}`}
                                checked={statuses.includes(status.value)}
                                onCheckedChange={() => handleStatusToggle(status.value)}
                              />
                              <label htmlFor={`status-${idx}`} className="text-xs cursor-pointer">{status.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right column: Off-Market Timeframe and List Date */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Label className="text-xs font-semibold">Off-Market Timeframe</Label>
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-lime-500 text-white text-[8px] font-bold">?</span>
                          </div>
                          <Select defaultValue="today-6months">
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-50 bg-popover">
                              <SelectItem value="today-6months">TODAY - 6 MONTHS</SelectItem>
                              <SelectItem value="today-3months">TODAY - 3 MONTHS</SelectItem>
                              <SelectItem value="today-1month">TODAY - 1 MONTH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Label className="text-xs font-semibold">List Date</Label>
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-lime-500 text-white text-[8px] font-bold">?</span>
                          </div>
                          <Select defaultValue="any">
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-50 bg-popover">
                              <SelectItem value="any">Any Time</SelectItem>
                              <SelectItem value="24h">Last 24 Hours</SelectItem>
                              <SelectItem value="7d">Last 7 Days</SelectItem>
                              <SelectItem value="30d">Last 30 Days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* STANDARD SEARCH CRITERIA Section */}
            <Collapsible open={isCriteriaOpen} onOpenChange={setIsCriteriaOpen}>
              <div className="bg-card rounded-lg shadow-sm border">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">STANDARD SEARCH CRITERIA</h3>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                  </div>
                  {isCriteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Bedrooms</Label>
                        <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Total Bathrooms</Label>
                        <Input type="number" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="h-8" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Rooms</Label>
                        <Input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Acres</Label>
                        <Input type="number" step="0.1" value={acres} onChange={(e) => setAcres(e.target.value)} className="h-8" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Living Area Total (SqFt)</Label>
                        <Input type="number" value={livingArea} onChange={(e) => setLivingArea(e.target.value)} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Price per SqFt</Label>
                        <Input type="number" value={pricePerSqFt} onChange={(e) => setPricePerSqFt(e.target.value)} className="h-8" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Year Built</Label>
                        <Input type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Price</Label>
                        <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="h-8" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Total Parking Spaces</Label>
                        <Input 
                          type="number" 
                          value={totalParkingSpaces} 
                          readOnly 
                          className="h-8 bg-muted" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Garage Spaces</Label>
                        <Input 
                          type="number" 
                          value={garageSpaces} 
                          onChange={(e) => {
                            setGarageSpaces(e.target.value);
                            const garage = parseInt(e.target.value) || 0;
                            const nonGarage = parseInt(nonGarageSpaces) || 0;
                            setTotalParkingSpaces((garage + nonGarage).toString());
                          }} 
                          className="h-8" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Parking Spaces (Non-Garage)</Label>
                        <Input 
                          type="number" 
                          value={nonGarageSpaces} 
                          onChange={(e) => {
                            setNonGarageSpaces(e.target.value);
                            const garage = parseInt(garageSpaces) || 0;
                            const nonGarage = parseInt(e.target.value) || 0;
                            setTotalParkingSpaces((garage + nonGarage).toString());
                          }} 
                          className="h-8" 
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs block font-semibold">ADDITIONAL CRITERIA</Label>
                        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-lime-500 text-white text-[8px] font-bold">?</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Second Row: PRICE below STATUS + MAP */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center justify-between w-full p-4">
                <h3 className="font-semibold text-sm text-primary">LISTING EVENTS</h3>
              </div>
              <div className="p-4 pt-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="open-houses" checked={openHouses} onCheckedChange={(v) => setOpenHouses(Boolean(v))} />
                    <Label htmlFor="open-houses">Open Houses</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="broker-tours" checked={brokerTours} onCheckedChange={(v) => setBrokerTours(Boolean(v))} />
                    <Label htmlFor="broker-tours">Broker Tours</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">For:</Label>
                  <Select value={eventTimeframe} onValueChange={setEventTimeframe}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="next_3_days">Next 3 Days</SelectItem>
                      <SelectItem value="next_7_days">Next 7 Days</SelectItem>
                      <SelectItem value="next_14_days">Next 14 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* PRICE Section - under STATUS */}
            <Collapsible open={isPriceOpen} onOpenChange={setIsPriceOpen}>
              <div className="bg-card rounded-lg shadow-sm border">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">PRICE</h3>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                  </div>
                  {isPriceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 pt-0 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Low</Label>
                      <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">High</Label>
                      <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-8" />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* MAP Section */}
            <div className="bg-card rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-primary">MAP</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
            </div>
          </div>

          {/* Extended Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ADDRESS - full width */}
            <div className="lg:col-span-3">
              <div className="bg-card rounded-lg shadow-sm border">
                <div className="flex items-center justify-between w-full p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">ADDRESS</h3>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                  </div>
                </div>
                <div className="p-4 pt-0 space-y-4">
                  <RadioGroup value={addressType} onValueChange={setAddressType}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="street" id="street" />
                        <Label htmlFor="street">Street Address</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="location" id="location" />
                        <Label htmlFor="location">My Location</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Street #</Label>
                      <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Street Name</Label>
                      <Input value={streetName} onChange={(e) => setStreetName(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Zip Code</Label>
                      <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Radius (Miles)</Label>
                      <Input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TOWNS - spans two columns */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg shadow-sm border">
                <div className="flex items-center justify-between w-full p-4">
                  <h3 className="font-semibold text-sm text-primary">TOWNS</h3>
                  <Button 
                    variant="link"
                    className="text-xs gap-1 h-auto p-0"
                    onClick={scrollToTop}
                  >
                    BACK TO TOP <ArrowUp className="h-3 w-3" />
                  </Button>
                </div>
                <div className="p-4 pt-0 space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label className="text-xs">State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 max-h-[300px]">
                          {US_STATES.map((s) => (
                            <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Coverage Areas</Label>
                      <Select value={county} onValueChange={setCounty} disabled={!hasCountyData}>
                        <SelectTrigger className={!hasCountyData ? "opacity-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 max-h-[300px]">
                          <SelectItem value="all">All Counties/Areas</SelectItem>
                          {hasCountyData && currentStateCounties.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Show Areas</Label>
                      <RadioGroup value={showAreas} onValueChange={setShowAreas} className="flex gap-3">
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="yes" id="show-yes" />
                          <Label htmlFor="show-yes" className="text-sm cursor-pointer">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="no" id="show-no" />
                          <Label htmlFor="show-no" className="text-sm cursor-pointer">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="relative">
                    <Input value={townSearch} onChange={(e) => setTownSearch(e.target.value)} placeholder="Type Full or Partial Name" className="pr-8" />
                    {townSearch && (
                      <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setTownSearch("")}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="max-h-60 overflow-y-auto border rounded bg-background">
                        <div className="p-2 hover:bg-muted cursor-pointer border-b font-semibold text-sm" onClick={addAllTowns}>
                          - Add All Towns -
                        </div>
                        <div className="p-2 space-y-1">
                          {filteredTowns.map((town) => (
                            <div key={town} className="flex items-center space-x-2 py-0.5">
                              <Checkbox
                                id={`town-${town}`}
                                checked={selectedTowns.includes(town)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedTowns([...selectedTowns, town]);
                                  else setSelectedTowns(selectedTowns.filter(t => t !== town));
                                }}
                              />
                              <label htmlFor={`town-${town}`} className="text-sm cursor-pointer flex-1">{town}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <Label className="text-xs mb-1 block">Type Multiple Towns/Areas</Label>
                        <div className="flex gap-2">
                          <Textarea value={manualTowns} onChange={(e) => setManualTowns(e.target.value)} rows={2} className="flex-1" />
                          <Button onClick={addManualTowns} size="sm">Add</Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold">Selected Towns</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={removeAllTowns}>Remove All</Button>
                      </div>
                      <div className="max-h-60 overflow-y-auto border rounded bg-background p-2">
                        {selectedTowns.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No towns selected</p>
                        ) : (
                          <div className="space-y-1">
                            {selectedTowns.map((town) => (
                              <div key={town} className="text-xs p-1 bg-muted rounded flex items-center justify-between">
                                <span className="flex-1 truncate">{town}</span>
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setSelectedTowns(selectedTowns.filter(t => t !== town))}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column Stack */}
            <div className="space-y-6">

              {/* KEYWORDS */}
              <div className="bg-card rounded-lg shadow-sm border">
                <div className="flex items-center justify-between w-full p-4">
                  <h3 className="font-semibold text-sm text-primary">KEYWORDS (Public Remarks only)</h3>
                </div>
                <div className="p-4 pt-0 space-y-3">
                  <div className="flex gap-4">
                    <RadioGroup value={keywordMatch} onValueChange={setKeywordMatch} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="any" id="any2" />
                        <Label htmlFor="any2" className="text-sm">Any</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="all2" />
                        <Label htmlFor="all2" className="text-sm">All</Label>
                      </div>
                    </RadioGroup>
                    <RadioGroup value={keywordType} onValueChange={setKeywordType} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="include" id="include2" />
                        <Label htmlFor="include2" className="text-sm">Include</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="exclude" id="exclude2" />
                        <Label htmlFor="exclude2" className="text-sm">Exclude</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={4} />
                </div>
              </div>
            </div>

            {/* ADDITIONAL CRITERIA - full width */}
            <div className="lg:col-span-3">
              <div className="bg-card rounded-lg shadow-sm border p-4 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-primary">ADDITIONAL CRITERIA</h3>
                <div className="flex items-center gap-2">
                  <Button variant="default" onClick={() => toast.message("Open additional criteria modal (coming soon)")}>Select</Button>
                  <Button variant="outline" onClick={handleClearAll}>Remove All</Button>
                </div>
              </div>
              <div className="px-1 py-3 text-sm font-medium"><button onClick={scrollToTop} className="underline">Back to Top</button></div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BrowseProperties;
