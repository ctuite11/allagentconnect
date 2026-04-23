import { useState, useEffect, useMemo } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { ActiveAgentBanner } from "@/components/ActiveAgentBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Search, Grid3x3, List, Map as MapIcon, ChevronDown, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { useUserRole } from "@/hooks/useUserRole";
import { isDcmlsHost } from "@/lib/host";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import PropertyMap from "@/components/PropertyMap";

const BED_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
  { label: "5+", value: "5" },
];

const BATH_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
  { label: "5+", value: "5" },
];

const INLINE_PROPERTY_TYPES: Array<{ label: string; value: string }> = [
  { label: "Single family", value: "single_family" },
  { label: "Condo", value: "condo" },
  { label: "Multi family", value: "multi_family" },
  { label: "Townhouse", value: "townhouse" },
  { label: "Land", value: "land" },
  { label: "Other", value: "other" },
];

interface BrowsePropertiesNewProps {
  forceBuyer?: boolean;
}

const BrowsePropertiesNew = ({ forceBuyer = false }: BrowsePropertiesNewProps = {}) => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [user, setUser] = useState<any>(null);
  const [viewType, setViewType] = useState<"grid" | "list" | "map">("grid");

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { role } = useUserRole(user);
  const searchMode = role === "agent" ? "agent" : "consumer";

  const [criteria, setCriteria] = useState<SearchCriteria>({
    listingType: "for_sale",
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
    propertyTypes: [],
    statuses: ["coming_soon", "active", "off_market", "back_on_market"],
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
  });
  const [locationInput, setLocationInput] = useState("");
  const [priceOpen, setPriceOpen] = useState(false);
  const [bedsBathsOpen, setBedsBathsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [bedsBathsDraft, setBedsBathsDraft] = useState({ bedrooms: "", bathrooms: "" });
  const [propertyTypesDraft, setPropertyTypesDraft] = useState<string[]>([]);

  useEffect(() => {
    if (criteria.zipCode) {
      setLocationInput(criteria.zipCode);
      return;
    }
    if (criteria.towns && criteria.towns.length > 0) {
      setLocationInput(criteria.towns.join(", "));
      return;
    }
    setLocationInput("");
  }, [criteria.zipCode, criteria.towns]);

  // Initialize filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCriteria: Partial<SearchCriteria> = {};

    if (params.has("lt")) urlCriteria.listingType = params.get("lt") as "for_sale" | "for_rent";
    if (params.has("status")) urlCriteria.statuses = params.get("status")!.split(",");
    if (params.has("type")) urlCriteria.propertyTypes = params.get("type")!.split(",");
    if (params.has("minPrice")) urlCriteria.minPrice = params.get("minPrice")!;
    if (params.has("maxPrice")) urlCriteria.maxPrice = params.get("maxPrice")!;
    if (params.has("bedrooms")) urlCriteria.bedrooms = params.get("bedrooms")!;
    if (params.has("bathrooms")) urlCriteria.bathrooms = params.get("bathrooms")!;
    if (params.has("zip")) urlCriteria.zipCode = params.get("zip")!;
    if (params.has("state")) urlCriteria.state = params.get("state")!;
    if (params.has("county")) urlCriteria.county = params.get("county")!;
    if (params.has("towns")) urlCriteria.towns = params.get("towns")!.split("|");
    if (params.has("neighborhoods")) urlCriteria.neighborhoods = params.get("neighborhoods")!.split("|");
    if (params.has("showAreas")) urlCriteria.showAreas = params.get("showAreas") === "yes";

    if (Object.keys(urlCriteria).length > 0) {
      setCriteria({ ...criteria, ...urlCriteria });
    }
  }, []);

  // Persist buyer search URL for back navigation from listing detail
  useEffect(() => {
    const params = buildQueryParams();
    const searchUrl = `/browse?${params.toString()}`;
    sessionStorage.setItem("buyer_last_search_url", searchUrl);
  }, [criteria]);

  // Fetch listings when criteria changes
  useEffect(() => {
    fetchListings();
  }, [criteria]);

  const fetchListings = async () => {
    try {
      setLoading(true);

      // Convert SearchCriteria to buildListingsQuery format with proper types
      const queryParams: any = {
        listingType: criteria.listingType || "for_sale",
        statuses: criteria.statuses,
        propertyTypes: criteria.propertyTypes,
        zipCode: criteria.zipCode,
        state: criteria.state,
        cities: criteria.towns,
        neighborhoods: criteria.neighborhoods,
      };

      // Convert string prices to numbers
      if (criteria.minPrice) queryParams.minPrice = parseFloat(criteria.minPrice);
      if (criteria.maxPrice) queryParams.maxPrice = parseFloat(criteria.maxPrice);
      if (criteria.bedrooms) queryParams.bedrooms = parseInt(criteria.bedrooms);
      if (criteria.bathrooms) queryParams.bathrooms = parseFloat(criteria.bathrooms);
      if (criteria.minLivingArea) queryParams.minSqft = parseFloat(criteria.minLivingArea);
      if (criteria.maxLivingArea) queryParams.maxSqft = parseFloat(criteria.maxLivingArea);

      // Force DCMLS-only filter on directconnectmls.com (skipped in buyer mode)
      if (!forceBuyer && isDcmlsHost()) queryParams.dcmlsOnly = true;

      const query = buildListingsQuery(supabase, queryParams).limit(200);
      const { data, error } = await query;

      if (error) throw error;

      // Fetch agent profiles in batch
      const agentIds = Array.from(new Set(data?.map((listing: any) => listing.agent_id) || []));
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company")
        .in("id", agentIds);

      const agentMapping: Record<string, { fullName: string; company?: string | null }> = {};
      agents?.forEach((agent) => {
        agentMapping[agent.id] = {
          fullName: `${agent.first_name} ${agent.last_name}`,
          company: agent.company,
        };
      });
      setAgentMap(agentMapping);

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
    if (criteria.listingType) params.set("lt", criteria.listingType);
    if (criteria.statuses?.length) params.set("status", criteria.statuses.join(","));
    if (criteria.propertyTypes?.length) params.set("type", criteria.propertyTypes.join(","));
    if (criteria.minPrice) params.set("minPrice", criteria.minPrice);
    if (criteria.maxPrice) params.set("maxPrice", criteria.maxPrice);
    if (criteria.bedrooms) params.set("bedrooms", criteria.bedrooms);
    if (criteria.bathrooms) params.set("bathrooms", criteria.bathrooms);
    if (criteria.zipCode) params.set("zip", criteria.zipCode);
    if (criteria.state) params.set("state", criteria.state);
    if (criteria.county) params.set("county", criteria.county);
    if (criteria.towns?.length) params.set("towns", criteria.towns.join("|"));
    if (criteria.neighborhoods?.length) params.set("neighborhoods", criteria.neighborhoods.join("|"));
    if (criteria.showAreas) params.set("showAreas", criteria.showAreas ? "yes" : "no");
    return params;
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (criteria.zipCode || (criteria.towns && criteria.towns.length > 0)) count += 1;
    if (criteria.minPrice || criteria.maxPrice) count += 1;
    if (criteria.bedrooms || criteria.bathrooms) count += 1;
    if (criteria.propertyTypes && criteria.propertyTypes.length > 0) count += 1;
    if (criteria.statuses && criteria.statuses.length > 0 && criteria.statuses.length < 4) count += 1;
    return count;
  }, [criteria]);

  const priceButtonLabel = useMemo(() => {
    if (!criteria.minPrice && !criteria.maxPrice) return "Price";
    const minLabel = criteria.minPrice ? `$${Number(criteria.minPrice).toLocaleString()}` : "";
    const maxLabel = criteria.maxPrice ? `$${Number(criteria.maxPrice).toLocaleString()}` : "";

    if (minLabel && maxLabel) return `${minLabel} - ${maxLabel}`;
    if (minLabel) return `${minLabel}+`;
    return `Up to ${maxLabel}`;
  }, [criteria.minPrice, criteria.maxPrice]);

  const bedsBathsButtonLabel = useMemo(() => {
    const beds = criteria.bedrooms ? `${criteria.bedrooms}+ bd` : "";
    const baths = criteria.bathrooms ? `${criteria.bathrooms}+ ba` : "";

    if (beds && baths) return `${beds}, ${baths}`;
    if (beds) return beds;
    if (baths) return baths;
    return "Beds & baths";
  }, [criteria.bedrooms, criteria.bathrooms]);

  const propertyTypeButtonLabel = useMemo(() => {
    const selected = criteria.propertyTypes || [];
    if (selected.length === 0) return "Property type";
    if (selected.length === 1) {
      const type = INLINE_PROPERTY_TYPES.find((entry) => entry.value === selected[0]);
      return type?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [criteria.propertyTypes]);

  const applyLocationInput = () => {
    const raw = locationInput.trim();
    if (!raw) {
      setCriteria((prev) => ({ ...prev, zipCode: "", towns: [] }));
      return;
    }

    if (/^\d{5}$/.test(raw)) {
      setCriteria((prev) => ({ ...prev, zipCode: raw, towns: [] }));
      return;
    }

    const towns = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setCriteria((prev) => ({ ...prev, zipCode: "", towns }));
  };

  const applyPriceDraft = () => {
    setCriteria((prev) => ({
      ...prev,
      minPrice: priceDraft.min,
      maxPrice: priceDraft.max,
    }));
    setPriceOpen(false);
  };

  const applyBedsBathsDraft = () => {
    setCriteria((prev) => ({
      ...prev,
      bedrooms: bedsBathsDraft.bedrooms,
      bathrooms: bedsBathsDraft.bathrooms,
    }));
    setBedsBathsOpen(false);
  };

  const applyPropertyTypesDraft = () => {
    setCriteria((prev) => ({ ...prev, propertyTypes: propertyTypesDraft }));
    setPropertyTypeOpen(false);
  };

  const dcmls = !forceBuyer && isDcmlsHost();

  return (
    <div className={`min-h-screen flex flex-col ${dcmls ? "" : "pt-20"}`}>
      {dcmls ? <DcmlsConsumerHeader /> : <ActiveAgentBanner />}

      <main className="flex-1 bg-background">
        <div className={forceBuyer ? "px-4 lg:px-6 py-4" : "container mx-auto px-4 py-8"}>
          {/* Header — hidden in buyer mode */}
          {!forceBuyer && (
            <div className="mb-6">
              <PageTitle className="mb-2">{dcmls ? "Browse Listings" : "Property Search"}</PageTitle>
              <p className="text-muted-foreground">
                {dcmls
                  ? "Off-market and coming-soon listings shared by network agents"
                  : "Advanced search with comprehensive filters"}
              </p>
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-zinc-200/80 bg-white p-3">
            <div className={`flex flex-wrap items-center ${forceBuyer ? "lg:flex-nowrap gap-2" : "gap-2.5"}`}>
              <div className={
                forceBuyer
                  ? "relative w-full sm:flex-1 sm:min-w-[200px] lg:max-w-[420px]"
                  : "relative min-w-[220px] w-full sm:min-w-[280px] lg:w-auto lg:flex-[0_0_32%] lg:max-w-[560px]"
              }>
                <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLocationInput();
                  }}
                  placeholder="City, neighborhood, or ZIP"
                  className="pl-9 h-9 text-[13px] border-zinc-200 rounded-full"
                />
              </div>

              <div className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-zinc-50 p-0.5 shrink-0">
                <button
                  className={`h-8 min-w-[86px] px-3 rounded-full inline-flex items-center justify-center text-[13px] font-semibold transition-all ${
                    criteria.listingType === "for_sale"
                      ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  onClick={() => setCriteria((prev) => ({ ...prev, listingType: "for_sale" }))}
                >
                  For Sale
                </button>
                <button
                  className={`h-8 min-w-[86px] px-3 rounded-full inline-flex items-center justify-center text-[13px] font-semibold transition-all ${
                    criteria.listingType === "for_rent"
                      ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  onClick={() => setCriteria((prev) => ({ ...prev, listingType: "for_rent" }))}
                >
                  For Rent
                </button>
              </div>

              <Popover
                open={priceOpen}
                onOpenChange={(open) => {
                  setPriceOpen(open);
                  if (open) {
                    setPriceDraft({ min: criteria.minPrice || "", max: criteria.maxPrice || "" });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`h-9 rounded-full border-zinc-200 ${forceBuyer ? "px-3" : "px-4"} text-[13px] font-medium text-zinc-700`}>
                    {priceButtonLabel}
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] rounded-xl border-zinc-200 p-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-600">Min</Label>
                        <Input
                          value={priceDraft.min}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value.replace(/[^\d]/g, "") }))}
                          placeholder="No min"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-600">Max</Label>
                        <Input
                          value={priceDraft.max}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value.replace(/[^\d]/g, "") }))}
                          placeholder="No max"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 flex-1"
                        onClick={() => {
                          setPriceDraft({ min: "", max: "" });
                          setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                          setPriceOpen(false);
                        }}
                      >
                        Reset
                      </Button>
                      <Button type="button" className="h-9 flex-1 bg-[#0E56F5] hover:bg-[#0B46CC]" onClick={applyPriceDraft}>
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover
                open={bedsBathsOpen}
                onOpenChange={(open) => {
                  setBedsBathsOpen(open);
                  if (open) {
                    setBedsBathsDraft({ bedrooms: criteria.bedrooms || "", bathrooms: criteria.bathrooms || "" });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-full border-zinc-200 px-4 text-[13px] font-medium text-zinc-700">
                    {bedsBathsButtonLabel}
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${bedsBathsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[360px] rounded-xl border-zinc-200 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Bedrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BED_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={`h-8 rounded-full border text-xs font-medium ${
                          bedsBathsDraft.bedrooms === preset.value
                            ? "border-[#0E56F5] text-[#0E56F5]"
                            : "border-zinc-200 text-zinc-700"
                        }`}
                        onClick={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.value }))}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-zinc-900">Bathrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BATH_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={`h-8 rounded-full border text-xs font-medium ${
                          bedsBathsDraft.bathrooms === preset.value
                            ? "border-[#0E56F5] text-[#0E56F5]"
                            : "border-zinc-200 text-zinc-700"
                        }`}
                        onClick={() => setBedsBathsDraft((prev) => ({ ...prev, bathrooms: preset.value }))}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 flex-1"
                      onClick={() => {
                        setBedsBathsDraft({ bedrooms: "", bathrooms: "" });
                        setCriteria((prev) => ({ ...prev, bedrooms: "", bathrooms: "" }));
                        setBedsBathsOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button type="button" className="h-9 flex-1 bg-[#0E56F5] hover:bg-[#0B46CC]" onClick={applyBedsBathsDraft}>
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover
                open={propertyTypeOpen}
                onOpenChange={(open) => {
                  setPropertyTypeOpen(open);
                  if (open) {
                    setPropertyTypesDraft([...(criteria.propertyTypes || [])]);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-full border-zinc-200 px-4 text-[13px] font-medium text-zinc-700">
                    {propertyTypeButtonLabel}
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${propertyTypeOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] rounded-xl border-zinc-200 p-4">
                  <div className="space-y-2">
                    {INLINE_PROPERTY_TYPES.map((type) => {
                      const checked = propertyTypesDraft.includes(type.value);
                      return (
                        <label key={type.value} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-zinc-700 hover:bg-zinc-50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              setPropertyTypesDraft((prev) =>
                                checked ? prev.filter((item) => item !== type.value) : [...prev, type.value]
                              );
                            }}
                          />
                          <span>{type.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 flex-1"
                      onClick={() => {
                        setPropertyTypesDraft([]);
                        setCriteria((prev) => ({ ...prev, propertyTypes: [] }));
                        setPropertyTypeOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button type="button" className="h-9 flex-1 bg-[#0E56F5] hover:bg-[#0B46CC]" onClick={applyPropertyTypesDraft}>
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    More Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 bg-zinc-900 text-white hover:bg-zinc-900">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>More Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <UnifiedPropertySearch
                      criteria={criteria}
                      onCriteriaChange={setCriteria}
                      resultsCount={listings.length}
                      showResultsCount={true}
                      onSearch={fetchListings}
                      mode={searchMode}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Button
                variant="outline"
                className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700"
                onClick={() => toast.info("Save search is coming soon")}
              >
                Save Search
              </Button>

              <Button
                className="h-9 rounded-full bg-[#0E56F5] hover:bg-[#0B46CC] px-5 text-[13px] text-white"
                onClick={applyLocationInput}
              >
                Update
              </Button>
            </div>
          </div>

          <div>
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Search className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No properties found</h3>
                <p className="text-muted-foreground">Try adjusting your search filters</p>
              </div>
            ) : forceBuyer ? (
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="lg:w-1/2 lg:sticky lg:top-24 self-start w-full">
                  <div className="bg-card rounded-xl border border-zinc-200 overflow-hidden h-[calc(100vh-220px)]">
                    <PropertyMap
                      listings={listings}
                      onListingClick={(listingId) => navigate(`/property/${listingId}`)}
                    />
                  </div>
                </div>
                <div className="lg:w-1/2 w-full">
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase">Results</span>
                      <span className="text-base font-semibold text-zinc-900">{listings.length} Homes</span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      Recommended
                      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {listings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        viewMode="compact"
                        showActions={false}
                        agentInfo={
                          agentMap[listing.agent_id]
                            ? {
                                name: agentMap[listing.agent_id].fullName,
                                company: agentMap[listing.agent_id].company || undefined,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-end mb-4 gap-2">
                  <Button
                    variant={viewType === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewType("grid")}
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewType === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewType("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewType === "map" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewType("map")}
                  >
                    <MapIcon className="h-4 w-4" />
                  </Button>
                </div>

                {viewType === "map" ? (
                  <div className="bg-card rounded-lg border p-4">
                    <PropertyMap
                      listings={listings}
                      onListingClick={(listingId) => navigate(`/property/${listingId}`)}
                    />
                  </div>
                ) : (
                  <div className={viewType === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
                    {listings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        viewMode="compact"
                        showActions={false}
                        agentInfo={
                          agentMap[listing.agent_id]
                            ? {
                                name: agentMap[listing.agent_id].fullName,
                                company: agentMap[listing.agent_id].company || undefined,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {!forceBuyer && <Footer />}
    </div>
  );
};

export default BrowsePropertiesNew;
