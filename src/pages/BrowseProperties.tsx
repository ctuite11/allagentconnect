import { useState, useEffect } from "react";
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
import { Search, ChevronDown, ChevronUp, ArrowUp, X, Home, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getAreasForCity, usNeighborhoodsByCityState } from "@/data/usNeighborhoodsData";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";
import { CT_COUNTY_TOWNS } from "@/data/ctCountyTowns";
import { RI_COUNTY_TOWNS } from "@/data/riCountyTowns";
import { NH_COUNTY_TOWNS } from "@/data/nhCountyTowns";
import { VT_COUNTY_TOWNS } from "@/data/vtCountyTowns";
import { ME_COUNTY_TOWNS } from "@/data/meCountyTowns";

const BrowseProperties = () => {
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

  const handleSearch = () => {
    fetchListings();
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
      
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">Property Search</h1>
            <p className="text-muted-foreground">
              Advanced search with comprehensive filters
            </p>
          </div>

          <div className="grid lg:grid-cols-[400px_1fr] gap-6">
            {/* Left Sidebar - Search Filters */}
            <div className="space-y-4">
              {/* LIST NUMBER(S) Section */}
              <Collapsible open={isListingEventsOpen} onOpenChange={setIsListingEventsOpen}>
                <div className="bg-card rounded-lg shadow-sm border">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                    <h3 className="font-semibold text-sm text-primary">LIST NUMBER(S)</h3>
                    {isListingEventsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      <Input
                        value={listingNumber}
                        onChange={(e) => setListingNumber(e.target.value)}
                        placeholder=""
                        className="w-full"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Three Column Layout: Property Type, Status, Standard Criteria */}
              <div className="grid grid-cols-3 gap-3">
                {/* PROPERTY TYPE Section */}
                <Collapsible open={isPropertyTypeOpen} onOpenChange={setIsPropertyTypeOpen}>
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
                          { value: "Business Opp.", label: "Business Opp." },
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
                        <div className="pt-2">
                          <Label className="text-xs block mb-1">TOWNS 🟢</Label>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* STATUS Section */}
                <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                  <div className="bg-card rounded-lg shadow-sm border">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-primary">STATUS</h3>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                      </div>
                      {isStatusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 pt-0 space-y-1">
                        <div className="flex items-center space-x-2">
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
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>

              {/* PRICE Section */}
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
                        <Label className="text-xs">High</Label>
                        <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="" className="h-8" />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* MAP Section - Placeholder */}
              <div className="bg-card rounded-lg shadow-sm border">
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-primary">MAP</h3>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                  </div>
                </div>
              </div>

              {/* ADDRESS Section */}
              <Collapsible open={isAddressOpen} onOpenChange={setIsAddressOpen}>
                <div className="bg-card rounded-lg shadow-sm border">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-primary">ADDRESS</h3>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold">?</span>
                    </div>
                    {isAddressOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                          <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} placeholder="123" />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Street Name</Label>
                          <Input value={streetName} onChange={(e) => setStreetName(e.target.value)} placeholder="Main St" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Zip Code</Label>
                          <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="02129" />
                        </div>
                        <div>
                          <Label className="text-xs">Radius (Miles)</Label>
                          <Input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="5" type="number" />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* TOWNS Section */}
              <Collapsible open={isTownsOpen} onOpenChange={setIsTownsOpen}>
                <div className="bg-card rounded-lg shadow-sm border">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between w-full">
                      <h3 className="font-semibold text-lg">TOWNS</h3>
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="link" 
                          className="text-xs gap-1 h-auto p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToTop();
                          }}
                        >
                          BACK TO TOP <ArrowUp className="h-3 w-3" />
                        </Button>
                        {isTownsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-3">
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <Label className="text-xs">State</Label>
                          <Select value={state} onValueChange={setState}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
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
                            <SelectContent className="max-h-[300px]">
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
                        <Input 
                          value={townSearch} 
                          onChange={(e) => setTownSearch(e.target.value)}
                          placeholder="Type Full or Partial Name"
                          className="pr-8"
                        />
                        {townSearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setTownSearch("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="max-h-60 overflow-y-auto border rounded bg-background">
                            <div 
                              className="p-2 hover:bg-muted cursor-pointer border-b font-semibold text-sm"
                              onClick={addAllTowns}
                            >
                              - Add All Towns -
                            </div>
                            <div className="p-2 space-y-1">
                              {filteredTowns.map((town) => (
                                <div key={town} className="flex items-center space-x-2 py-0.5">
                                  <Checkbox
                                    id={`town-${town}`}
                                    checked={selectedTowns.includes(town)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedTowns([...selectedTowns, town]);
                                      } else {
                                        setSelectedTowns(selectedTowns.filter(t => t !== town));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`town-${town}`} className="text-sm cursor-pointer flex-1">
                                    {town}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <Label className="text-xs mb-1 block">Type Multiple Towns/Areas</Label>
                            <div className="flex gap-2">
                              <Textarea 
                                value={manualTowns}
                                onChange={(e) => setManualTowns(e.target.value)}
                                placeholder="Type Towns/Areas"
                                rows={2}
                                className="flex-1"
                              />
                              <Button onClick={addManualTowns} size="sm">Add</Button>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold">Selected Towns</Label>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={removeAllTowns}
                            >
                              Remove All
                            </Button>
                          </div>
                          <div className="max-h-60 overflow-y-auto border rounded bg-background p-2">
                            {selectedTowns.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">No towns selected</p>
                            ) : (
                              <div className="space-y-1">
                                {selectedTowns.map((town) => (
                                  <div key={town} className="text-xs p-1 bg-muted rounded flex items-center justify-between">
                                    <span className="flex-1 truncate">{town}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={() => setSelectedTowns(selectedTowns.filter(t => t !== town))}
                                    >
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
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* KEYWORDS Section */}
              <Collapsible open={isKeywordsOpen} onOpenChange={setIsKeywordsOpen}>
                <div className="bg-card rounded-lg shadow-sm border">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                    <h3 className="font-semibold text-lg">KEYWORDS (Public Remarks only)</h3>
                    {isKeywordsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-3">
                      <div className="flex gap-4">
                        <RadioGroup value={keywordMatch} onValueChange={setKeywordMatch} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="any" id="any" />
                            <Label htmlFor="any" className="text-sm">Any</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="text-sm">All</Label>
                          </div>
                        </RadioGroup>
                        <RadioGroup value={keywordType} onValueChange={setKeywordType} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="include" id="include" />
                            <Label htmlFor="include" className="text-sm">Include</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="exclude" id="exclude" />
                            <Label htmlFor="exclude" className="text-sm">Exclude</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <Textarea
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="Enter keywords..."
                        rows={4}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Search Button */}
              <Button onClick={handleSearch} className="w-full" size="lg">
                <Search className="mr-2 h-5 w-5" />
                Search Properties
              </Button>
            </div>

            {/* Right Side - Results */}
            <div>
              <div className="bg-card rounded-lg shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    Search Results
                  </h2>
                  <div className="text-lg font-semibold text-primary">
                    {loading ? "Loading..." : `${listings.length} Properties Found`}
                  </div>
                </div>
              </div>

              {/* Results */}
              {loading ? (
                <div className="text-center py-12 bg-card rounded-lg border">
                  <p className="text-muted-foreground">Loading properties...</p>
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border">
                  <p className="text-muted-foreground mb-4">No properties found matching your criteria</p>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {listings.map((listing) => (
                    <PropertyCard key={listing.id} {...listing} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BrowseProperties;
