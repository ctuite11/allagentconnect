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
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity } from "@/data/usNeighborhoodsData";

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
  
  // Status filters - default to only showing active and coming_soon listings
  const [statuses, setStatuses] = useState<string[]>(["active", "coming_soon"]);
  
  // Price filters
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [noMinPrice, setNoMinPrice] = useState(false);
  const [noMaxPrice, setNoMaxPrice] = useState(false);
  
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
  const [isMapOpen, setIsMapOpen] = useState(true);

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
    navigate(`/search?${params.toString()}`);
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
    setStatuses(["active", "coming_soon"]);
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
  
  // Use the shared towns picker hook
  const { townsList, expandedCities, toggleCityExpansion, hasCountyData } = useTownsPicker({
    state,
    county,
    showAreas
  });
  
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
    const allTownsWithNeighborhoods: string[] = [];
    
    // If showAreas is enabled, include all neighborhoods for each city
    if (showAreas === "yes") {
      townsList.forEach(town => {
        allTownsWithNeighborhoods.push(town);
        const neighborhoods = getAreasForCity(town, state);
        if (neighborhoods && neighborhoods.length > 0) {
          neighborhoods.forEach(neighborhood => {
            allTownsWithNeighborhoods.push(`${town}-${neighborhood}`);
          });
        }
      });
      setSelectedTowns(allTownsWithNeighborhoods);
    } else {
      setSelectedTowns(townsList);
    }
    
    toast.success("All towns added");
  };

  const toggleTown = (town: string) => {
    setSelectedTowns(prev =>
      prev.includes(town) ? prev.filter(t => t !== town) : [...prev, town]
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">Property Search</h1>
            <p className="text-muted-foreground">
              Advanced search with comprehensive filters
            </p>
          </div>

          {/* Toolbar */}
          <div className="sticky top-20 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm flex flex-wrap items-center gap-2 mb-4 p-3 -mx-4 px-4">
            <Button onClick={handleViewResults}>
              View Results {!loading && `(${listings.length})`}
            </Button>
          </div>

          {/* LIST NUMBER(S) Full Width */}
          <div className="mb-3">
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center justify-between w-full p-2.5">
                <h3 className="font-semibold text-sm text-primary">LIST NUMBER(S)</h3>
              </div>
              <div className="px-2.5 pb-2.5">
                <Input
                  value={listingNumber}
                  onChange={(e) => setListingNumber(e.target.value)}
                  placeholder=""
                  className="w-full h-8"
                />
              </div>
            </div>
          </div>

          {/* Row 1: Property Type, Status, Standard Criteria */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
            {/* PROPERTY TYPE */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">PROPERTY TYPE</h3>
                <span className="text-yellow-600">⭐</span>
              </div>
              <div className="p-3 space-y-1.5">
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
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
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
                </div>
              </div>
            </div>

            {/* STATUS */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">STATUS</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_12rem] gap-3 items-start">
                    <div className="space-y-1.5 pr-2">
                    <div className="flex items-center space-x-2 mb-1">
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
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pr-2">
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
                          <label htmlFor={`status-${idx}`} className="text-xs cursor-pointer leading-tight whitespace-normal break-words">{status.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:min-w-[12rem]">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
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
                      <div className="flex items-center gap-2 mb-1">
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
            </div>

            {/* STANDARD SEARCH CRITERIA */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">STANDARD SEARCH CRITERIA</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3 space-y-2">
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
              </div>
            </div>
          </div>

          {/* Row 2: Listing Events, Price, Map, Additional Criteria, Towns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
            {/* LISTING EVENTS */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">LISTING EVENTS</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="open-houses" checked={openHouses} onCheckedChange={(v) => setOpenHouses(Boolean(v))} />
                    <Label htmlFor="open-houses" className="text-xs cursor-pointer">Open Houses</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="broker-tours" checked={brokerTours} onCheckedChange={(v) => setBrokerTours(Boolean(v))} />
                    <Label htmlFor="broker-tours" className="text-xs cursor-pointer">Broker Tours</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">For:</Label>
                  <Select value={eventTimeframe} onValueChange={setEventTimeframe}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="next_3_days">Next 3 Days</SelectItem>
                      <SelectItem value="next_7_days">Next 7 Days</SelectItem>
                      <SelectItem value="next_14_days">Next 14 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* PRICE */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">PRICE</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Low</Label>
                    <Input 
                      type="number" 
                      value={minPrice} 
                      onChange={(e) => setMinPrice(e.target.value)} 
                      className="h-8" 
                      disabled={noMinPrice}
                    />
                    <div className="flex items-center space-x-1.5">
                      <Checkbox
                        id="browse-no-min"
                        checked={noMinPrice}
                        onCheckedChange={(checked) => {
                          setNoMinPrice(!!checked);
                          if (checked) setMinPrice("");
                        }}
                      />
                      <label htmlFor="browse-no-min" className="text-[10px] cursor-pointer">No Min</label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">High</Label>
                    <Input 
                      type="number" 
                      value={maxPrice} 
                      onChange={(e) => setMaxPrice(e.target.value)} 
                      className="h-8"
                      disabled={noMaxPrice}
                    />
                    <div className="flex items-center space-x-1.5">
                      <Checkbox
                        id="browse-no-max"
                        checked={noMaxPrice}
                        onCheckedChange={(checked) => {
                          setNoMaxPrice(!!checked);
                          if (checked) setMaxPrice("");
                        }}
                      />
                      <label htmlFor="browse-no-max" className="text-[10px] cursor-pointer">No Max</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MAP */}
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">MAP</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3">
                <p className="text-xs text-muted-foreground">Map view coming soon</p>
              </div>
            </div>
          </div>

          {/* Row 3: Additional Criteria full width */}
          <div className="mb-2">
            <div className="bg-card rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 p-2 border-b">
                <h3 className="font-semibold text-sm text-primary">ADDITIONAL CRITERIA</h3>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
              </div>
              <div className="p-3">
                <p className="text-xs text-muted-foreground">Additional search criteria options</p>
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
                      <div className="max-h-60 overflow-y-auto border rounded bg-background z-10 relative">
                        <div className="p-2 hover:bg-muted cursor-pointer border-b font-semibold text-sm bg-background" onClick={addAllTowns}>
                          - Add All Towns -
                        </div>
                        <div className="p-2">
                          <TownsPicker
                            towns={townsList}
                            selectedTowns={selectedTowns}
                            onToggleTown={toggleTown}
                            expandedCities={expandedCities}
                            onToggleCityExpansion={toggleCityExpansion}
                            state={state}
                            searchQuery={townSearch}
                            variant="checkbox"
                            showAreas={showAreas === "yes"}
                          />
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
