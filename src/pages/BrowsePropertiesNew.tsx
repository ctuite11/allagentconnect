import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import ListingCard from "@/components/ListingCard";
import PropertyMap from "@/components/PropertyMap";
import { ActiveAgentBanner } from "@/components/ActiveAgentBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, MapPin, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { useUserRole } from "@/hooks/useUserRole";
import { isDcmlsHost } from "@/lib/host";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";

interface BrowsePropertiesNewProps {
  /** Buyer-only chain: forces consumer search mode and skips host/agent banners.
   *  Used by /client/search inside BuyerLayout (BuyerPortalHeader handles the toolbar). */
  forceBuyer?: boolean;
}

const BrowsePropertiesNew = ({ forceBuyer = false }: BrowsePropertiesNewProps = {}) => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [user, setUser] = useState<any>(null);

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { role } = useUserRole(user);
  const searchMode = forceBuyer ? "consumer" : role === "agent" ? "agent" : "consumer";

  const [criteria, setCriteria] = useState<SearchCriteria>({
    listingType: "for_sale",
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

      // Force DCMLS-only filter on directconnectmls.com
      if (isDcmlsHost()) queryParams.dcmlsOnly = true;

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

  const handleViewResults = () => {
    const params = buildQueryParams();
    navigate(`/search?${params.toString()}`);
  };

  const dcmls = forceBuyer ? false : isDcmlsHost();
  const [sortBy, setSortBy] = useState<"recommended" | "newest" | "price_asc" | "price_desc">("recommended");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(criteria.zipCode || "");

  useEffect(() => {
    setSearchInput(criteria.zipCode || "");
  }, [criteria.zipCode]);

  const sortedListings = useMemo(() => {
    const arr = [...listings];
    switch (sortBy) {
      case "newest":
        return arr.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        );
      case "price_asc":
        return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
      case "price_desc":
        return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
      default:
        return arr;
    }
  }, [listings, sortBy]);

  const activeFilterCount =
    (criteria.propertyTypes?.length || 0) +
    (criteria.minPrice ? 1 : 0) +
    (criteria.maxPrice ? 1 : 0) +
    (criteria.bedrooms ? 1 : 0) +
    (criteria.bathrooms ? 1 : 0) +
    (criteria.minLivingArea ? 1 : 0) +
    (criteria.maxLivingArea ? 1 : 0) +
    (criteria.towns?.length || 0) +
    (criteria.neighborhoods?.length || 0);

  const applySearchInput = () => {
    const raw = searchInput.trim();
    if (!raw) {
      setCriteria((prev) => ({ ...prev, zipCode: undefined, towns: [] }));
      return;
    }
    if (/^\d{5}$/.test(raw)) {
      setCriteria((prev) => ({ ...prev, zipCode: raw, towns: [] }));
      return;
    }
    const towns = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setCriteria((prev) => ({ ...prev, zipCode: undefined, towns }));
  };

  // ---- Inline popover labels ----
  const formatPriceShort = (v: string) => {
    const n = parseFloat(v);
    if (!n || Number.isNaN(n)) return "";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  };
  const priceLabel = (() => {
    const min = formatPriceShort(criteria.minPrice || "");
    const max = formatPriceShort(criteria.maxPrice || "");
    if (min && max) return `${min} – ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return "Price";
  })();
  const bedsBathsLabel = (() => {
    const bd = criteria.bedrooms ? `${criteria.bedrooms}+ bd` : "";
    const ba = criteria.bathrooms ? `${criteria.bathrooms}+ ba` : "";
    if (bd && ba) return `${bd}, ${ba}`;
    if (bd) return bd;
    if (ba) return ba;
    return "Beds & baths";
  })();
  const PROPERTY_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "single_family", label: "Single Family" },
    { value: "condo", label: "Condo" },
    { value: "multi_family", label: "Multi Family" },
    { value: "townhouse", label: "Townhouse" },
    { value: "land", label: "Land" },
    { value: "other", label: "Other" },
  ];
  const propertyTypeLabel = (() => {
    const arr = criteria.propertyTypes || [];
    if (arr.length === 0) return "Property type";
    if (arr.length === 1) {
      const found = PROPERTY_TYPE_OPTIONS.find((o) => o.value === arr[0]);
      return found?.label || "1 selected";
    }
    return `${arr.length} selected`;
  })();

  // Local drafts for popovers (commit on Apply)
  const [priceDraft, setPriceDraft] = useState({ min: criteria.minPrice || "", max: criteria.maxPrice || "" });
  const [bbDraft, setBbDraft] = useState({ bd: criteria.bedrooms || "", ba: criteria.bathrooms || "" });
  const [typesDraft, setTypesDraft] = useState<string[]>(criteria.propertyTypes || []);
  useEffect(() => {
    setPriceDraft({ min: criteria.minPrice || "", max: criteria.maxPrice || "" });
  }, [criteria.minPrice, criteria.maxPrice]);
  useEffect(() => {
    setBbDraft({ bd: criteria.bedrooms || "", ba: criteria.bathrooms || "" });
  }, [criteria.bedrooms, criteria.bathrooms]);
  useEffect(() => {
    setTypesDraft(criteria.propertyTypes || []);
  }, [criteria.propertyTypes]);

  const STEPS = ["", "1", "2", "3", "4", "5"];
  const SegRow = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="inline-flex h-9 w-full items-center rounded-full border border-zinc-200 bg-white p-0.5">
      {STEPS.map((s) => {
        const active = value === s;
        const label = s === "" ? "Any" : `${s}+`;
        return (
          <button
            key={s || "any"}
            type="button"
            onClick={() => onChange(s)}
            className={`flex-1 h-8 rounded-full text-[12px] font-medium transition-all ${
              active ? "bg-[#0E56F5] text-white" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col bg-white ${dcmls || forceBuyer ? "" : "pt-14"}`}>
      {forceBuyer ? null : dcmls ? <DcmlsConsumerHeader /> : <ActiveAgentBanner />}

      {dcmls && (
        <div className="border-b border-zinc-200/60 bg-white">
          <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-2">
            <p className="text-[12px] text-zinc-500">
              Off-market and coming-soon listings shared by network agents
            </p>
          </div>
        </div>
      )}

      {/* Sticky filter bar */}
      <div className="sticky top-14 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-b border-zinc-200/60">
        <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 sm:flex-initial sm:w-[300px]">
              <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearchInput();
                }}
                placeholder="City, neighborhood, or ZIP"
                className="pl-9 h-9 text-[13px] border-zinc-200/80 rounded-full"
              />
            </div>

            {/* For Sale / For Rent toggle */}
            <div className="inline-flex h-9 items-center rounded-full border border-zinc-200/80 bg-zinc-50 p-0.5 ring-1 ring-zinc-100/90 shrink-0">
              <button
                type="button"
                className={`h-8 min-w-[80px] px-3 rounded-full inline-flex items-center justify-center text-[13px] font-semibold leading-none transition-all ${
                  criteria.listingType === "for_sale"
                    ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
                onClick={() => setCriteria((prev) => ({ ...prev, listingType: "for_sale" }))}
              >
                For Sale
              </button>
              <button
                type="button"
                className={`h-8 min-w-[80px] px-3 rounded-full inline-flex items-center justify-center text-[13px] font-semibold leading-none transition-all ${
                  criteria.listingType === "for_rent"
                    ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
                onClick={() => setCriteria((prev) => ({ ...prev, listingType: "for_rent" }))}
              >
                For Rent
              </button>
            </div>

            {/* Price */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700 inline-flex items-center gap-1.5"
                >
                  {priceLabel}
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[300px] p-4">
                <p className="text-[12px] font-semibold text-zinc-700 mb-2">Price range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-zinc-500">Min</Label>
                    <Input
                      type="number"
                      placeholder="No min"
                      value={priceDraft.min}
                      onChange={(e) => setPriceDraft((p) => ({ ...p, min: e.target.value }))}
                      className="h-9 text-[13px] mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-zinc-500">Max</Label>
                    <Input
                      type="number"
                      placeholder="No max"
                      value={priceDraft.max}
                      onChange={(e) => setPriceDraft((p) => ({ ...p, max: e.target.value }))}
                      className="h-9 text-[13px] mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="ghost"
                    className="h-8 text-[12px]"
                    onClick={() => {
                      setPriceDraft({ min: "", max: "" });
                      setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    className="h-8 text-[12px] bg-[#0E56F5] hover:bg-[#0B46CC] text-white rounded-full px-4"
                    onClick={() =>
                      setCriteria((prev) => ({
                        ...prev,
                        minPrice: priceDraft.min,
                        maxPrice: priceDraft.max,
                      }))
                    }
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Beds & baths */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700 inline-flex items-center gap-1.5"
                >
                  {bedsBathsLabel}
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[360px] p-4">
                <div>
                  <p className="text-[12px] font-semibold text-zinc-700 mb-2">Bedrooms</p>
                  <SegRow value={bbDraft.bd} onChange={(v) => setBbDraft((p) => ({ ...p, bd: v }))} />
                </div>
                <div className="mt-4">
                  <p className="text-[12px] font-semibold text-zinc-700 mb-2">Bathrooms</p>
                  <SegRow value={bbDraft.ba} onChange={(v) => setBbDraft((p) => ({ ...p, ba: v }))} />
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="ghost"
                    className="h-8 text-[12px]"
                    onClick={() => {
                      setBbDraft({ bd: "", ba: "" });
                      setCriteria((prev) => ({ ...prev, bedrooms: "", bathrooms: "" }));
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    className="h-8 text-[12px] bg-[#0E56F5] hover:bg-[#0B46CC] text-white rounded-full px-4"
                    onClick={() =>
                      setCriteria((prev) => ({
                        ...prev,
                        bedrooms: bbDraft.bd,
                        bathrooms: bbDraft.ba,
                      }))
                    }
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Property type */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700 inline-flex items-center gap-1.5"
                >
                  {propertyTypeLabel}
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[260px] p-4">
                <p className="text-[12px] font-semibold text-zinc-700 mb-2">Property type</p>
                <div className="space-y-2">
                  {PROPERTY_TYPE_OPTIONS.map((opt) => {
                    const checked = typesDraft.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setTypesDraft((prev) =>
                              c ? [...prev, opt.value] : prev.filter((v) => v !== opt.value),
                            )
                          }
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="ghost"
                    className="h-8 text-[12px]"
                    onClick={() => {
                      setTypesDraft([]);
                      setCriteria((prev) => ({ ...prev, propertyTypes: [] }));
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    className="h-8 text-[12px] bg-[#0E56F5] hover:bg-[#0B46CC] text-white rounded-full px-4"
                    onClick={() =>
                      setCriteria((prev) => ({ ...prev, propertyTypes: typesDraft }))
                    }
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* More Filters (opens Sheet with full UnifiedPropertySearch) */}
            <Sheet open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700 inline-flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  More Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 bg-zinc-900 text-white hover:bg-zinc-900">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>All Filters</SheetTitle>
                </SheetHeader>
                <UnifiedPropertySearch
                  criteria={criteria}
                  onCriteriaChange={setCriteria}
                  resultsCount={listings.length}
                  showResultsCount={true}
                  onSearch={() => {
                    fetchListings();
                    setMoreFiltersOpen(false);
                  }}
                  mode={searchMode}
                />
              </SheetContent>
            </Sheet>

            <div className="flex-1" />

            <Button
              variant="outline"
              className="h-9 rounded-full border-zinc-200 px-4 text-[13px] text-zinc-700"
              onClick={() => toast.info("Save search is coming soon")}
            >
              Save Search
            </Button>

            <Button
              className="h-9 rounded-full bg-[#0E56F5] hover:bg-[#0B46CC] px-5 text-[13px] text-white"
              onClick={() => {
                applySearchInput();
                fetchListings();
              }}
            >
              Update
            </Button>
          </div>
        </div>
      </div>

      {/* Main content: map + results split */}
      <main className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-3 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[52%_48%] gap-4 lg:h-[calc(100dvh-9rem)]">
          {/* Map panel */}
          <section className="hidden lg:block rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden lg:sticky lg:top-[7rem] lg:h-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0E56F5]" />
              </div>
            ) : listings.length > 0 ? (
              <div className="h-full">
                <PropertyMap
                  listings={listings}
                  onListingClick={(id) => navigate(`/property/${id}`)}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-zinc-50/40">
                <MapPin className="h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-600 max-w-md">
                  No homes match your current filters. Try widening price or area.
                </p>
              </div>
            )}
          </section>

          {/* Results panel */}
          <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden lg:h-full flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-200/60 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-600 tracking-[0.08em]">RESULTS</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">
                  {sortedListings.length.toLocaleString()} Homes
                </p>
              </div>
              <div className="w-[180px] shrink-0">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 rounded-md border-zinc-200/80 text-xs">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E56F5]" />
                </div>
              ) : sortedListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <Search className="h-12 w-12 text-zinc-400 mb-3" />
                  <h3 className="text-base font-semibold text-zinc-900 mb-1">No properties found</h3>
                  <p className="text-sm text-zinc-500">Try adjusting your search filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sortedListings.map((listing) => (
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
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default BrowsePropertiesNew;
