import { useState, useEffect, useMemo, useCallback } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronDown, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { useUserRole } from "@/hooks/useUserRole";
import { isDcmlsHost } from "@/lib/host";
import {
  RENT_PRICE_STEP_VALUES,
  defaultRentToolbarCriteria,
  defaultSaleToolbarCriteria,
} from "@/lib/buyerSearchRentFilters";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import PropertyMap from "@/components/PropertyMap";
import { buyerFavoritesSplitPane, buyerPageMain, buyerPageShell } from "@/lib/buyerUi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const rentMonthlyPriceLabels = {
  minOptions: [{ value: "", label: "No min" }, ...RENT_PRICE_STEP_VALUES.map((v) => ({ value: String(v), label: `$${v.toLocaleString()}` }))],
  maxOptions: [{ value: "", label: "No max" }, ...RENT_PRICE_STEP_VALUES.map((v) => ({ value: String(v), label: `$${v.toLocaleString()}` }))],
};

function BrowseResultsViewToggle({ value, onChange }: { value: "map" | "list"; onChange: (v: "map" | "list") => void }) {
  return (
    <div
      className="inline-flex rounded-lg border border-neutral-200 bg-white p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      role="group"
      aria-label="Results view"
    >
      {(["map", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "h-7 rounded-md px-3 text-[13px] font-medium transition-colors duration-200 ease-out",
            value === v
              ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
          )}
        >
          {v === "map" ? "Map" : "List"}
        </button>
      ))}
    </div>
  );
}

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
  const location = useLocation();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [user, setUser] = useState<any>(null);
  const [resultsView, setResultsView] = useState<"map" | "list">("map");

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { role } = useUserRole(user);
  const searchMode = role === "agent" ? "agent" : "consumer";

  const buyerListingDetailTo = useMemo(() => {
    if (!forceBuyer) return undefined;
    const returnTo = `${location.pathname}${location.search}`;
    return (listingId: string) => {
      const q = new URLSearchParams({ returnTo });
      return `/consumer-property/${listingId}?${q.toString()}`;
    };
  }, [forceBuyer, location.pathname, location.search]);

  const [criteria, setCriteria] = useState<SearchCriteria>(() => defaultSaleToolbarCriteria());
  const isRentSearch = criteria.listingType === "for_rent";
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

  const fetchListings = useCallback(async () => {
    try {
      setFetchError(false);
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
      setFetchError(true);
      toast.error("Failed to load properties");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [criteria, forceBuyer]);

  // Fetch listings when criteria changes
  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

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
    if (isRentSearch) {
      const minV = priceDraft.min ? Number(priceDraft.min) : NaN;
      const maxV = priceDraft.max ? Number(priceDraft.max) : NaN;
      let lo = "";
      let hi = "";
      if (Number.isFinite(minV) && Number.isFinite(maxV)) {
        lo = String(Math.min(minV, maxV));
        hi = String(Math.max(minV, maxV));
      } else if (Number.isFinite(minV)) {
        lo = String(minV);
      } else if (Number.isFinite(maxV)) {
        hi = String(maxV);
      }
      setCriteria((prev) => ({
        ...prev,
        minPrice: lo,
        maxPrice: hi,
      }));
      setPriceOpen(false);
      return;
    }
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

  const retryFetch = () => {
    void fetchListings();
  };

  const outlineFilterBtn = cn(
    "h-9 rounded-md border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50/90",
  );

  return (
    <div className={cn("flex flex-col bg-white", forceBuyer ? buyerPageShell : "min-h-screen", !dcmls && "pt-20")}>
      {dcmls ? <DcmlsConsumerHeader /> : <ActiveAgentBanner />}

      <main className="flex-1 bg-white">
        <div className={forceBuyer ? buyerPageMain : "container mx-auto max-w-[1800px] px-4 py-6 md:px-6 md:py-8"}>
          {/* Header — hidden in buyer mode */}
          {!forceBuyer && (
            <div className="mb-5 md:mb-6">
              <PageTitle className="mb-2">{dcmls ? "Browse Listings" : "Property Search"}</PageTitle>
              <p className="text-[13px] leading-relaxed text-neutral-500 md:text-sm">
                {dcmls
                  ? "Off-market and coming-soon listings shared by network agents"
                  : "Advanced search with comprehensive filters"}
              </p>
            </div>
          )}

          <div className="mb-5 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm md:mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap lg:gap-3">
              <div className="relative w-full max-w-[420px] min-w-0 shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLocationInput();
                  }}
                  placeholder="City, neighborhood, or ZIP"
                  className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-neutral-300/50"
                />
              </div>

              <div
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                role="group"
                aria-label="Listing type"
              >
                <button
                  type="button"
                  className={cn(
                    "h-8 min-w-[86px] rounded-md px-3 text-[13px] font-semibold transition-colors duration-200 ease-out",
                    criteria.listingType === "for_sale"
                      ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                  onClick={() =>
                    setCriteria((prev) => ({
                      ...prev,
                      listingType: "for_sale",
                      propertyTypes: [],
                      minPrice: "",
                      maxPrice: "",
                    }))
                  }
                >
                  For Sale
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-8 min-w-[86px] rounded-md px-3 text-[13px] font-semibold transition-colors duration-200 ease-out",
                    criteria.listingType === "for_rent"
                      ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                  onClick={() =>
                    setCriteria((prev) => ({
                      ...prev,
                      listingType: "for_rent",
                      propertyTypes: [],
                      minPrice: "",
                      maxPrice: "",
                    }))
                  }
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
                  <Button variant="outline" className={cn(outlineFilterBtn, "min-w-[124px] justify-between")}>
                    <span>{priceButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  {isRentSearch ? (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Monthly rent</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-neutral-600">Minimum</Label>
                          <Select
                            value={priceDraft.min === "" ? "none-m" : priceDraft.min}
                            onValueChange={(v) => setPriceDraft((prev) => ({ ...prev, min: v === "none-m" ? "" : v }))}
                          >
                            <SelectTrigger className="h-9 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-neutral-300/50">
                              <SelectValue placeholder="Minimum" />
                            </SelectTrigger>
                            <SelectContent>
                              {rentMonthlyPriceLabels.minOptions.map((o) => (
                                <SelectItem key={o.value === "" ? "none-m" : `m-${o.value}`} value={o.value === "" ? "none-m" : o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-neutral-600">Maximum</Label>
                          <Select
                            value={priceDraft.max === "" ? "none-x" : priceDraft.max}
                            onValueChange={(v) => setPriceDraft((prev) => ({ ...prev, max: v === "none-x" ? "" : v }))}
                          >
                            <SelectTrigger className="h-9 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-neutral-300/50">
                              <SelectValue placeholder="Maximum" />
                            </SelectTrigger>
                            <SelectContent>
                              {rentMonthlyPriceLabels.maxOptions.map((o) => (
                                <SelectItem key={o.value === "" ? "none-x" : `x-${o.value}`} value={o.value === "" ? "none-x" : o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 flex-1 border-neutral-200"
                          onClick={() => {
                            setPriceDraft({ min: "", max: "" });
                            setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                            setPriceOpen(false);
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          className="h-9 flex-1 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                          onClick={applyPriceDraft}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-neutral-600">Min</Label>
                          <Input
                            value={priceDraft.min}
                            onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="No min"
                            className="h-9 border-neutral-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-neutral-600">Max</Label>
                          <Input
                            value={priceDraft.max}
                            onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="No max"
                            className="h-9 border-neutral-200"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 flex-1 border-neutral-200"
                          onClick={() => {
                            setPriceDraft({ min: "", max: "" });
                            setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                            setPriceOpen(false);
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          className="h-9 flex-1 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                          onClick={applyPriceDraft}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
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
                  <Button variant="outline" className={cn(outlineFilterBtn, "min-w-[132px] justify-between")}>
                    <span>{bedsBathsButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${bedsBathsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[360px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  <p className="text-sm font-semibold text-neutral-900">Bedrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BED_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={cn(
                          "h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 focus-visible:ring-offset-2",
                          bedsBathsDraft.bedrooms === preset.value
                            ? "border-neutral-900 text-neutral-900"
                            : "border-neutral-200 text-neutral-700 hover:border-neutral-300",
                        )}
                        onClick={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.value }))}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-neutral-900">Bathrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BATH_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={cn(
                          "h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 focus-visible:ring-offset-2",
                          bedsBathsDraft.bathrooms === preset.value
                            ? "border-neutral-900 text-neutral-900"
                            : "border-neutral-200 text-neutral-700 hover:border-neutral-300",
                        )}
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
                      className="h-9 flex-1 border-neutral-200"
                      onClick={() => {
                        setBedsBathsDraft({ bedrooms: "", bathrooms: "" });
                        setCriteria((prev) => ({ ...prev, bedrooms: "", bathrooms: "" }));
                        setBedsBathsOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      className="h-9 flex-1 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                      onClick={applyBedsBathsDraft}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {!isRentSearch && (
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
                    <Button variant="outline" className={cn(outlineFilterBtn, "min-w-[144px] justify-between")}>
                      <span>{propertyTypeButtonLabel}</span>
                      <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${propertyTypeOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                    <div className="space-y-2">
                      {INLINE_PROPERTY_TYPES.map((type) => {
                        const checked = propertyTypesDraft.includes(type.value);
                        return (
                          <label
                            key={type.value}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50",
                              checked && "bg-neutral-50 ring-1 ring-neutral-200/80",
                            )}
                          >
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
                        className="h-9 flex-1 border-neutral-200"
                        onClick={() => {
                          setPropertyTypesDraft([]);
                          setCriteria((prev) => ({ ...prev, propertyTypes: [] }));
                          setPropertyTypeOpen(false);
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        className="h-9 flex-1 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
                        onClick={applyPropertyTypesDraft}
                      >
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className={cn(outlineFilterBtn, "justify-start gap-0")}>
                    <SlidersHorizontal className="mr-2 h-4 w-4 text-neutral-600" />
                    More filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 bg-neutral-900 text-[11px] font-medium text-white hover:bg-neutral-900">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full border-neutral-200 sm:max-w-[560px] overflow-y-auto bg-white">
                  <SheetHeader>
                    <SheetTitle className="text-neutral-900">More filters</SheetTitle>
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

              <Button variant="outline" className={outlineFilterBtn} onClick={() => toast.info("Save search is coming soon")}>
                Save search
              </Button>

              <Button
                variant="outline"
                type="button"
                className={outlineFilterBtn}
                onClick={() =>
                  setCriteria(isRentSearch ? defaultRentToolbarCriteria() : defaultSaleToolbarCriteria())
                }
              >
                Clear filters
              </Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1800px]">
            {fetchError && !loading && listings.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="min-w-0 text-[12px] leading-snug text-neutral-600">
                  Couldn&apos;t refresh results. Showing the previous list.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 border-neutral-200 text-[11px] font-medium"
                  onClick={retryFetch}
                >
                  Try again
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[min(420px,70dvh)] flex-col gap-3 sm:gap-4 lg:grid lg:h-[calc(100dvh-14rem)] lg:min-h-[380px] lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:gap-4">
                <section className={cn(buyerFavoritesSplitPane, "flex h-[46dvh] min-h-0 flex-col sm:h-[50dvh] lg:h-full")}>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                    <Skeleton className="h-8 w-full rounded-lg bg-neutral-100" />
                    <Skeleton className="min-h-0 flex-1 rounded-xl bg-neutral-100" />
                    <div className="flex shrink-0 gap-2 pt-1">
                      <Skeleton className="h-9 flex-1 rounded-lg bg-neutral-100" />
                      <Skeleton className="h-9 w-24 rounded-lg bg-neutral-100" />
                    </div>
                  </div>
                </section>
                <section className={cn(buyerFavoritesSplitPane, "flex min-h-[280px] flex-1 flex-col p-4 lg:min-h-0")}>
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <Skeleton className="h-5 w-32 rounded-md bg-neutral-100" />
                    <Skeleton className="h-7 w-[5.5rem] rounded-lg bg-neutral-100" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2 rounded-xl border border-neutral-100 bg-white p-2">
                        <Skeleton className="aspect-[4/3] w-full rounded-lg bg-neutral-100" />
                        <Skeleton className="h-4 w-[85%] rounded-md bg-neutral-100" />
                        <Skeleton className="h-3 w-[55%] rounded-md bg-neutral-100" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : fetchError && listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
                <p className="text-[15px] font-semibold text-neutral-900">Couldn&apos;t load properties</p>
                <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-neutral-500">
                  Check your connection and try again.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-6 h-8 rounded-md bg-neutral-900 px-4 text-[12px] font-medium text-white hover:bg-neutral-800"
                  onClick={retryFetch}
                >
                  Try again
                </Button>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold text-neutral-900">No properties match</h3>
                <p className="mt-1 max-w-md text-[13px] leading-relaxed text-neutral-500">
                  Try a different location or widen your filters.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                  <p className="text-[13px] font-medium tabular-nums text-neutral-900">
                    Results: {listings.length.toLocaleString()}
                  </p>
                  <BrowseResultsViewToggle value={resultsView} onChange={setResultsView} />
                </div>

                {resultsView === "map" ? (
                  <div className="flex h-auto min-h-0 flex-col-reverse gap-3 sm:gap-4 lg:grid lg:h-[calc(100dvh-12rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none lg:gap-4">
                    <section
                      className={cn(
                        buyerFavoritesSplitPane,
                        "flex h-[50dvh] min-h-0 flex-col overflow-hidden sm:h-[54dvh] lg:sticky lg:top-24 lg:h-full lg:min-h-0 lg:self-start",
                      )}
                    >
                      <div className="min-h-0 flex-1">
                        <PropertyMap
                          listings={listings}
                          onListingClick={(listingId) =>
                            navigate(
                              buyerListingDetailTo
                                ? buyerListingDetailTo(listingId)
                                : `/property/${listingId}`,
                            )
                          }
                        />
                      </div>
                    </section>

                    <section
                      className={cn(
                        buyerFavoritesSplitPane,
                        "flex h-auto min-h-0 max-lg:min-h-[48vh] flex-col lg:h-full lg:min-h-0",
                      )}
                    >
                      <div className="min-h-0 flex-1 px-4 py-4 sm:px-5 lg:overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2">
                          {listings.map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              viewMode="compact"
                              showActions={false}
                              compactListingDetailTo={
                                buyerListingDetailTo
                                  ? buyerListingDetailTo(listing.id)
                                  : undefined
                              }
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
                    </section>
                  </div>
                ) : (
                  <div className={cn(buyerFavoritesSplitPane, "overflow-hidden")}>
                    <div className="p-5 sm:p-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                        {listings.map((listing) => (
                          <ListingCard
                            key={listing.id}
                            listing={listing}
                            viewMode="compact"
                            showActions={false}
                            compactListingDetailTo={
                              buyerListingDetailTo
                                ? buyerListingDetailTo(listing.id)
                                : undefined
                            }
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
