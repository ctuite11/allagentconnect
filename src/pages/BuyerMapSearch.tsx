import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, Bath, MapPin, Search as SearchIcon, SlidersHorizontal, Ruler, ChevronDown } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { supabase } from "@/integrations/supabase/client";
import { SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import PropertyMap from "@/components/PropertyMap";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { isDcmlsHost } from "@/lib/host";
import { toast } from "sonner";
import FavoriteButton from "@/components/FavoriteButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ListingRecord {
  id: string;
  agent_id?: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: string[] | null;
  property_type?: string | null;
  list_office?: string | null;
  office_name?: string | null;
}

interface AgentOfficeRecord {
  id: string;
  company?: string | null;
  office_name?: string | null;
}

const DEFAULT_CRITERIA: SearchCriteria = {
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
};

const BED_PRESETS: Array<{ label: string; bedrooms: string }> = [
  { label: "Any", bedrooms: "" },
  { label: "1+", bedrooms: "1" },
  { label: "2+", bedrooms: "2" },
  { label: "3+", bedrooms: "3" },
  { label: "4+", bedrooms: "4" },
  { label: "5+", bedrooms: "5" },
];

const PROPERTY_TYPE_OPTIONS = [
  "Any",
  "Single Family",
  "condo",
  "Multi Family",
  "Townhouse",
  "Land",
  "Commercial",
];

const BATH_PRESETS = ["Any", "1+", "1.5+", "2+", "3+", "4+"];
const PRICE_ABS_MIN = 50_000;
const PRICE_ABS_MAX = 10_000_000;

function getPrimaryPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const first = photos[0] as unknown;
  if (typeof first === "string") {
    const trimmed = first.trim();
    return trimmed ? trimmed : null;
  }

  if (first && typeof first === "object") {
    const candidate = first as { url?: unknown; src?: unknown; image_url?: unknown };
    const raw = candidate.url ?? candidate.src ?? candidate.image_url;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed ? trimmed : null;
    }
  }

  return null;
}

function ListingImage({ photos, alt }: { photos?: unknown; alt: string }) {
  const src = useMemo(() => getPrimaryPhotoUrl(photos), [photos]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-100 to-zinc-200/80">
        <div className="text-[11px] font-medium text-zinc-500">Photo unavailable</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function parseCriteriaFromUrl(search: string): Partial<SearchCriteria> {
  const params = new URLSearchParams(search);
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

  return urlCriteria;
}

function formatBrokerageLine(listOffice?: string | null): string | null {
  const normalized = listOffice?.trim();
  if (!normalized) return null;
  if (/^(listed by|listing courtesy of)\b/i.test(normalized)) return normalized;
  return `Listed by ${normalized}`;
}

function resolveListingBrokerage(listing: ListingRecord): string | null {
  return listing.list_office?.trim() || listing.office_name?.trim() || null;
}

function buildQueryParams(criteria: SearchCriteria): URLSearchParams {
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
  if (criteria.showAreas !== undefined) params.set("showAreas", criteria.showAreas ? "yes" : "no");
  return params;
}

export default function BuyerMapSearch() {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState<SearchCriteria>(() => ({
    ...DEFAULT_CRITERIA,
    ...parseCriteriaFromUrl(window.location.search),
  }));
  const [locationInput, setLocationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recommended" | "newest" | "price_asc" | "price_desc">("recommended");
  const [sessionKeptIds, setSessionKeptIds] = useState<Set<string>>(new Set());
  const [showKeptOnly, setShowKeptOnly] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [bedsBathsOpen, setBedsBathsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [priceFieldFocus, setPriceFieldFocus] = useState({ min: false, max: false });
  const [bedsBathsDraft, setBedsBathsDraft] = useState({ bedrooms: "", bathrooms: "" });
  const [propertyTypesDraft, setPropertyTypesDraft] = useState<string[]>([]);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mapsKeyAvailable, setMapsKeyAvailable] = useState(true);
  const isLocalDevHost = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }, []);

  useEffect(() => {
    const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
    const urlKey = new URLSearchParams(window.location.search).get("gmaps_key")?.trim();
    setMapsKeyAvailable(Boolean(envKey || urlKey));
  }, []);

  const shouldUseLiveMap = mapsKeyAvailable;

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

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      (criteria.towns && criteria.towns.length > 0) ||
        (criteria.neighborhoods && criteria.neighborhoods.length > 0) ||
        criteria.zipCode ||
        criteria.minPrice ||
        criteria.maxPrice ||
        criteria.bedrooms ||
        criteria.bathrooms ||
        (criteria.propertyTypes && criteria.propertyTypes.length > 0)
    );
  }, [criteria]);

  useEffect(() => {
    if (!selectedListingId) return;
    const stillPresent = listings.some((listing) => listing.id === selectedListingId);
    if (!stillPresent) setSelectedListingId(null);
  }, [listings, selectedListingId]);

  const handleMarkerSelect = (listingId: string) => {
    setSelectedListingId(listingId);
    const cardEl = cardRefs.current[listingId];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  };

  const sortedListings = useMemo(() => {
    const next = [...listings];
    if (sortBy === "price_asc") {
      next.sort((a, b) => (a.price || 0) - (b.price || 0));
      return next;
    }
    if (sortBy === "price_desc") {
      next.sort((a, b) => (b.price || 0) - (a.price || 0));
      return next;
    }
    if (sortBy === "newest") {
      next.sort((a, b) => b.id.localeCompare(a.id));
      return next;
    }
    return next;
  }, [listings, sortBy]);

  const displayListings = useMemo(() => {
    if (!showKeptOnly) return sortedListings;
    return sortedListings.filter((l) => sessionKeptIds.has(l.id));
  }, [sortedListings, showKeptOnly, sessionKeptIds]);

  const toggleSessionKeep = (listingId: string) => {
    setSessionKeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
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
    if (minLabel && maxLabel) return `${minLabel}-${maxLabel}`;
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
    if (selected.length === 1) return selected[0] === "condo" ? "Condo" : selected[0];
    return `${selected.length} types`;
  }, [criteria.propertyTypes]);

  const selectedBaths = useMemo(() => {
    if (!criteria.bathrooms) return "Any";
    return `${criteria.bathrooms}+`;
  }, [criteria.bathrooms]);

  const priceStepValues = useMemo(() => {
    const values: number[] = [];

    for (let v = 50_000; v <= 500_000; v += 25_000) values.push(v);
    for (let v = 550_000; v <= 1_000_000; v += 50_000) values.push(v);
    for (let v = 1_250_000; v <= 5_000_000; v += 250_000) values.push(v);
    for (let v = 6_000_000; v <= 10_000_000; v += 1_000_000) values.push(v);

    return values;
  }, []);

  const snapToNearestPriceStep = useCallback((value: number) => {
    if (!Number.isFinite(value)) return PRICE_ABS_MIN;
    const bounded = Math.max(PRICE_ABS_MIN, Math.min(value, PRICE_ABS_MAX));

    let nearest = priceStepValues[0];
    let minDiff = Math.abs(nearest - bounded);
    for (const candidate of priceStepValues) {
      const diff = Math.abs(candidate - bounded);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = candidate;
      }
    }

    return nearest;
  }, [priceStepValues]);

  const normalizePriceDraft = (field: "min" | "max") => {
    const fallback = field === "min" ? PRICE_ABS_MIN : PRICE_ABS_MAX;
    const raw = field === "min" ? priceDraft.min : priceDraft.max;
    const parsed = Number(raw);
    const snapped = snapToNearestPriceStep(Number.isFinite(parsed) && parsed > 0 ? parsed : fallback);

    setPriceDraft((prev) => ({
      ...prev,
      [field]: String(snapped),
    }));
  };

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
      .map((t) => t.trim())
      .filter(Boolean);

    setCriteria((prev) => ({ ...prev, zipCode: "", towns }));
  };

  const draftMinNumber = useMemo(() => {
    const parsed = Number(priceDraft.min);
    if (!priceDraft.min || !Number.isFinite(parsed)) return PRICE_ABS_MIN;
    return snapToNearestPriceStep(parsed);
  }, [priceDraft.min, snapToNearestPriceStep]);

  const draftMaxNumber = useMemo(() => {
    const parsed = Number(priceDraft.max);
    if (!priceDraft.max || !Number.isFinite(parsed)) return PRICE_ABS_MAX;
    return snapToNearestPriceStep(parsed);
  }, [priceDraft.max, snapToNearestPriceStep]);

  const sliderMinValue = Math.min(draftMinNumber, draftMaxNumber);
  const sliderMaxValue = Math.max(draftMinNumber, draftMaxNumber);

  const sliderMinIndex = useMemo(() => {
    return Math.max(0, priceStepValues.indexOf(sliderMinValue));
  }, [priceStepValues, sliderMinValue]);

  const sliderMaxIndex = useMemo(() => {
    return Math.max(0, priceStepValues.indexOf(sliderMaxValue));
  }, [priceStepValues, sliderMaxValue]);

  const sliderChips = useMemo(() => {
    const chipCount = 34;
    return Array.from({ length: chipCount }, (_, idx) => ({
      key: idx,
      ratio: (idx + 0.5) / chipCount,
    }));
  }, []);

  const formatCurrencyDraft = (value: string, field: "min" | "max" = "min") => {
    if (!value) return "";
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0) return "";
    if (field === "max" && asNumber >= PRICE_ABS_MAX) return `$${asNumber.toLocaleString()}+`;
    return `$${asNumber.toLocaleString()}`;
  };

  const isMaxAtTop = useMemo(() => {
    if (!priceDraft.max) return true;
    const n = Number(priceDraft.max);
    return !Number.isFinite(n) || n >= PRICE_ABS_MAX;
  }, [priceDraft.max]);

  const applyPriceDraft = () => {
    const minValue = snapToNearestPriceStep(Number(priceDraft.min) || PRICE_ABS_MIN);
    const maxValue = snapToNearestPriceStep(Number(priceDraft.max) || PRICE_ABS_MAX);
    const normalizedMin = Math.min(minValue, maxValue);
    const normalizedMax = Math.max(minValue, maxValue);

    setCriteria((prev) => ({
      ...prev,
      minPrice: normalizedMin <= PRICE_ABS_MIN ? "" : String(normalizedMin),
      maxPrice: normalizedMax >= PRICE_ABS_MAX ? "" : String(normalizedMax),
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

  useEffect(() => {
    const params = buildQueryParams(criteria);
    const search = params.toString();
    const url = search ? `/client/search?${search}` : "/client/search";
    window.history.replaceState(null, "", url);
    sessionStorage.setItem("buyer_last_search_url", url);
  }, [criteria]);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);

        const queryParams: Parameters<typeof buildListingsQuery>[1] = {
          listingType: criteria.listingType || "for_sale",
          statuses: criteria.statuses,
          propertyTypes: criteria.propertyTypes,
          zipCode: criteria.zipCode,
          state: criteria.state,
          cities: criteria.towns,
          neighborhoods: criteria.neighborhoods,
        };

        if (criteria.minPrice) queryParams.minPrice = parseFloat(criteria.minPrice);
        if (criteria.maxPrice) queryParams.maxPrice = parseFloat(criteria.maxPrice);
        if (criteria.bedrooms) queryParams.bedrooms = parseInt(criteria.bedrooms, 10);
        if (criteria.bathrooms) queryParams.bathrooms = parseFloat(criteria.bathrooms);
        if (criteria.minLivingArea) queryParams.minSqft = parseFloat(criteria.minLivingArea);
        if (criteria.maxLivingArea) queryParams.maxSqft = parseFloat(criteria.maxLivingArea);

        if (isDcmlsHost()) queryParams.dcmlsOnly = true;

        const { data, error } = await buildListingsQuery(supabase, queryParams).limit(250);
        if (error) throw error;

        const baseListings = (data || []) as ListingRecord[];
        const agentIds = Array.from(
          new Set(baseListings.map((listing) => listing.agent_id).filter((id): id is string => Boolean(id)))
        );

        if (agentIds.length === 0) {
          setListings(baseListings);
          setSessionKeptIds(new Set());
          setShowKeptOnly(false);
          return;
        }

        const { data: agentOfficeRows, error: agentOfficeError } = await supabase
          .from("agent_profiles")
          .select("id, company, office_name")
          .in("id", agentIds);

        if (agentOfficeError) {
          setListings(baseListings);
          setSessionKeptIds(new Set());
          setShowKeptOnly(false);
          return;
        }

        const officeByAgentId = new Map(
          ((agentOfficeRows || []) as AgentOfficeRecord[]).map((row) => [
            row.id,
            row.office_name?.trim() || row.company?.trim() || null,
          ])
        );

        const hydratedListings = baseListings.map((listing) => {
          const fallbackOffice = listing.agent_id ? officeByAgentId.get(listing.agent_id) || null : null;
          return {
            ...listing,
            list_office: listing.list_office?.trim() || fallbackOffice,
          };
        });

        setListings(hydratedListings);
        setSessionKeptIds(new Set());
        setShowKeptOnly(false);
      } catch (error) {
        console.error(error);
        toast.error("Unable to load homes right now");
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [criteria]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/82">
        <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7 pt-6 pb-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
              <div className="relative min-w-[230px] w-full sm:min-w-[280px] lg:w-auto lg:flex-[0_0_36%] lg:max-w-[620px]">
                <SearchIcon className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLocationInput();
                  }}
                  placeholder="City, neighborhood, or ZIP"
                  className="pl-9 h-9 text-[13px] border-zinc-200/80 rounded-md"
                />
              </div>

              <div className="inline-flex h-9 items-center rounded-md border border-zinc-200/80 bg-zinc-50 p-0.5 ring-1 ring-zinc-100/90 shrink-0">
                <button
                  className={`h-8 min-w-[86px] px-3 rounded-[5px] inline-flex items-center justify-center text-[13px] font-semibold leading-none tracking-[0.01em] transition-all ${
                    criteria.listingType === "for_sale"
                      ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  onClick={() => setCriteria((prev) => ({ ...prev, listingType: "for_sale" }))}
                >
                  For Sale
                </button>
                <button
                  className={`h-8 min-w-[86px] px-3 rounded-[5px] inline-flex items-center justify-center text-[13px] font-semibold leading-none tracking-[0.01em] transition-all ${
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
                    setPriceDraft({
                      min: criteria.minPrice || String(PRICE_ABS_MIN),
                      max: criteria.maxPrice || String(PRICE_ABS_MAX),
                    });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 min-w-[124px] rounded-md border-zinc-200/80 px-3 text-[12px] text-zinc-700 justify-between">
                    <span>{priceButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[500px] rounded-2xl border-zinc-200/80 bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.14)]"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setPriceOpen(false);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPriceDraft();
                    }
                  }}
                >
                  {/* Header */}
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-zinc-500 mb-1">LIST PRICE</p>

                  {/* Histogram + Slider container */}
                  <div className="mt-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 px-4 py-4">
                    <div className="flex h-6 items-center gap-1">
                      {sliderChips.map((chip) => {
                        const chipIndex = chip.ratio * Math.max(1, priceStepValues.length - 1);
                        const active = chipIndex >= sliderMinIndex && chipIndex <= sliderMaxIndex;
                        return (
                          <span
                            key={chip.key}
                            className={`block h-2.5 flex-1 rounded-full ${
                              active ? "bg-[#1a72ff] opacity-100" : "bg-zinc-300 opacity-45"
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="relative mt-3">
                      <SliderPrimitive.Root
                        min={0}
                        max={Math.max(0, priceStepValues.length - 1)}
                        step={1}
                        minStepsBetweenThumbs={1}
                        value={[sliderMinIndex, sliderMaxIndex]}
                        onValueChange={([nextMinIndex, nextMaxIndex]) => {
                          const safeMinIndex = Math.max(0, Math.min(nextMinIndex, priceStepValues.length - 1));
                          const safeMaxIndex = Math.max(0, Math.min(nextMaxIndex, priceStepValues.length - 1));
                          const nextMin = priceStepValues[Math.min(safeMinIndex, safeMaxIndex)] ?? PRICE_ABS_MIN;
                          const nextMax = priceStepValues[Math.max(safeMinIndex, safeMaxIndex)] ?? PRICE_ABS_MAX;
                          setPriceDraft({ min: String(nextMin), max: String(nextMax) });
                        }}
                        className="relative flex w-full touch-none select-none items-center"
                      >
                        <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-zinc-200">
                          <SliderPrimitive.Range className="absolute h-full bg-[#1a72ff]" />
                        </SliderPrimitive.Track>
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#1a72ff] bg-white shadow-[0_2px_8px_rgba(26,114,255,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a72ff] focus-visible:ring-offset-1" />
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#1a72ff] bg-white shadow-[0_2px_8px_rgba(26,114,255,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a72ff] focus-visible:ring-offset-1" />
                      </SliderPrimitive.Root>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-600">
                        <span>$50k</span>
                        <span>$10M+</span>
                      </div>
                    </div>
                  </div>

                  {/* Min / Max inputs */}
                  <div className="mt-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-zinc-500">Min price</label>
                        <Input
                          placeholder="No minimum"
                          value={priceFieldFocus.min ? priceDraft.min : formatCurrencyDraft(priceDraft.min, "min")}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value.replace(/[^\d]/g, "") }))}
                          onFocus={() => setPriceFieldFocus((prev) => ({ ...prev, min: true }))}
                          onBlur={() => {
                            setPriceFieldFocus((prev) => ({ ...prev, min: false }));
                            normalizePriceDraft("min");
                          }}
                          className="h-12 text-sm rounded-lg border-zinc-300"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-zinc-500">Max price</label>
                        <Input
                          placeholder="No maximum"
                          value={priceFieldFocus.max ? priceDraft.max : formatCurrencyDraft(priceDraft.max, "max")}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value.replace(/[^\d]/g, "") }))}
                          onFocus={() => setPriceFieldFocus((prev) => ({ ...prev, max: true }))}
                          onBlur={() => {
                            setPriceFieldFocus((prev) => ({ ...prev, max: false }));
                            normalizePriceDraft("max");
                          }}
                          className="h-12 text-sm rounded-lg border-zinc-300"
                        />
                        {isMaxAtTop && !priceFieldFocus.max && (
                          <p className="text-[10px] text-zinc-400">No maximum</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-5 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-lg border-zinc-300 text-zinc-700 text-sm font-medium hover:bg-zinc-50"
                      onClick={() => {
                        setPriceDraft({ min: String(PRICE_ABS_MIN), max: String(PRICE_ABS_MAX) });
                        setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                        setPriceOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      className="h-11 flex-1 rounded-lg bg-[#1a72ff] hover:bg-[#1460d8] text-sm font-semibold"
                      onClick={applyPriceDraft}
                    >
                      Done
                    </Button>
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
                  <Button variant="outline" className="h-9 min-w-[132px] rounded-md border-zinc-200/80 px-3 text-[12px] text-zinc-700 justify-between">
                    <span>{bedsBathsButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${bedsBathsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[340px] rounded-xl border-zinc-200 p-4"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setBedsBathsOpen(false);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyBedsBathsDraft();
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-zinc-900">Number of Bedrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BED_PRESETS.map((preset) => {
                      const selected = bedsBathsDraft.bedrooms === preset.bedrooms;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className={`h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5] focus-visible:ring-offset-1 ${
                            selected
                              ? "border-[#0E56F5] bg-white text-[#0E56F5]"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                          }`}
                          onPointerDown={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.bedrooms }))}
                          onClick={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.bedrooms }))}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-zinc-900">Number of Bathrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BATH_PRESETS.map((option) => {
                      const selected =
                        (option === "Any" && !bedsBathsDraft.bathrooms) ||
                        option.replace("+", "") === bedsBathsDraft.bathrooms;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5] focus-visible:ring-offset-1 ${
                            selected
                              ? "border-[#0E56F5] bg-white text-[#0E56F5]"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                          }`}
                          onPointerDown={() =>
                            setBedsBathsDraft((prev) => ({ ...prev, bathrooms: option === "Any" ? "" : option.replace("+", "") }))
                          }
                          onClick={() =>
                            setBedsBathsDraft((prev) => ({ ...prev, bathrooms: option === "Any" ? "" : option.replace("+", "") }))
                          }
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 flex-1 transition-transform active:scale-[0.98]"
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
                      className="h-9 flex-1 bg-[#0E56F5] hover:bg-[#0B46CC] transition-transform active:scale-[0.98]"
                      onClick={applyBedsBathsDraft}
                    >
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
                  <Button variant="outline" className="h-9 min-w-[144px] rounded-md border-zinc-200/80 px-3 text-[12px] text-zinc-700 justify-between">
                    <span>{propertyTypeButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 text-zinc-500 transition-transform ${propertyTypeOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[320px] rounded-xl border-zinc-200 p-4"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setPropertyTypeOpen(false);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPropertyTypesDraft();
                    }
                  }}
                >
                  <p className="text-sm font-semibold text-zinc-900">Home Type</p>
                  <div className="mt-2 space-y-2">
                    {PROPERTY_TYPE_OPTIONS.filter((type) => type !== "Any").map((type) => {
                      const checked = propertyTypesDraft.includes(type);
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-zinc-700 transition-colors active:bg-zinc-100 ${
                            checked ? "bg-[#0E56F5]/5" : "hover:bg-zinc-50"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              setPropertyTypesDraft((prev) =>
                                checked ? prev.filter((item) => item !== type) : [...prev, type]
                              );
                            }}
                          />
                          <span>{type === "condo" ? "Condo" : type}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 flex-1 transition-transform active:scale-[0.98]"
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
                      className="h-9 flex-1 bg-[#0E56F5] hover:bg-[#0B46CC] transition-transform active:scale-[0.98]"
                      onClick={applyPropertyTypesDraft}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-md border-zinc-200/80 text-[12px] text-zinc-700">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    More Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 bg-zinc-900 text-white hover:bg-zinc-900">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px] p-4 rounded-xl border-zinc-200">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Bathrooms</p>
                      <Select
                        value={selectedBaths}
                        onValueChange={(value) => {
                          setCriteria((prev) => ({
                            ...prev,
                            bathrooms: value === "Any" ? "" : value.replace("+", ""),
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-2 h-9 border-zinc-200/80">
                          <SelectValue placeholder="Baths" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            { label: "Any", value: "Any" },
                            { label: "1+", value: "1+" },
                            { label: "2+", value: "2+" },
                            { label: "3+", value: "3+" },
                            { label: "4+", value: "4+" },
                          ].map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Status</p>
                      <div className="mt-2 space-y-2">
                        {[
                          { value: "coming_soon", label: "Coming Soon" },
                          { value: "active", label: "Active" },
                          { value: "off_market", label: "Private" },
                          { value: "back_on_market", label: "Back on Market" },
                        ].map((status) => {
                          const checked = (criteria.statuses || []).includes(status.value);
                          return (
                            <div key={status.value} className="flex items-center gap-2">
                              <Checkbox
                                id={`status-${status.value}`}
                                checked={checked}
                                onCheckedChange={() => {
                                  setCriteria((prev) => {
                                    const current = prev.statuses || [];
                                    const statuses = checked
                                      ? current.filter((s) => s !== status.value)
                                      : [...current, status.value];
                                    return { ...prev, statuses };
                                  });
                                }}
                              />
                              <Label htmlFor={`status-${status.value}`}>{status.label}</Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-600">Min Sqft</Label>
                        <Input
                          value={criteria.minLivingArea || ""}
                          onChange={(e) => setCriteria((prev) => ({ ...prev, minLivingArea: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-600">Max Sqft</Label>
                        <Input
                          value={criteria.maxLivingArea || ""}
                          onChange={(e) => setCriteria((prev) => ({ ...prev, maxLivingArea: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                  className="h-9 rounded-md border-zinc-200/80 text-[12px] text-zinc-700"
                onClick={() => toast.info("Save search is coming soon")}
              >
                Save Search
              </Button>

              <Button
                className="h-9 rounded-md bg-[#0E56F5] hover:bg-[#0B46CC] text-[12px] text-white"
                onClick={applyLocationInput}
              >
                Update
              </Button>
            </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[52%_48%] gap-4 h-auto lg:h-[calc(100dvh-7.8rem)] lg:min-h-0">
          <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-[62dvh] sm:h-[66dvh] lg:h-full lg:min-h-0 lg:sticky lg:top-[6.05rem]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0E56F5]" />
              </div>
            ) : !shouldUseLiveMap ? (
              <div className="h-full flex items-center justify-center px-8 bg-gradient-to-b from-zinc-50 to-white">
                <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white/80 shadow-[0_14px_32px_rgba(15,23,42,0.05)] px-6 py-7 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Map Preview Unavailable</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-5">
                  {mapsKeyAvailable && import.meta.env.DEV && isLocalDevHost
                    ? "Listings are available now. Your current Google Maps key does not allow localhost, so the map is shown as a preview placeholder in local development."
                    : "Listings are available now. Add a Google Maps key to enable the live map experience."}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                  </div>
                </div>
              </div>
            ) : listings.length > 0 ? (
              <div className="h-full">
                <PropertyMap
                  listings={displayListings}
                  highlightedListingId={hoveredListingId}
                  selectedListingId={selectedListingId}
                  onListingHover={setHoveredListingId}
                  onListingSelect={handleMarkerSelect}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-zinc-50/40">
                <MapPin className="h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-600 max-w-md">
                  {hasActiveFilters
                    ? "No homes match your current filters. Try widening price or area to repopulate the map."
                    : "Enter a location and set filters to begin exploring homes on the map."}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-auto lg:h-full lg:min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-200/60 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-600 tracking-[0.08em]">RESULTS</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">{sortedListings.length.toLocaleString()} Homes</p>
              </div>
              <div className="w-[180px] shrink-0">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
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

            <div className="px-4 py-2.5 border-b border-zinc-200/60 bg-zinc-50/60 flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-zinc-600">
                <span className="font-semibold text-zinc-900 tabular-nums">{sessionKeptIds.size}</span>{" "}
                kept
              </span>
              <Button
                type="button"
                size="sm"
                variant={!showKeptOnly ? "default" : "outline"}
                className="h-7 rounded-md text-xs px-2.5"
                onClick={() => setShowKeptOnly(false)}
              >
                Show all
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showKeptOnly ? "default" : "outline"}
                className="h-7 rounded-md text-xs px-2.5"
                onClick={() => setShowKeptOnly(true)}
                disabled={sessionKeptIds.size === 0}
              >
                Show kept only
              </Button>
            </div>

            <div className="p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              {loading ? (
                <div className="py-10 text-center text-sm text-zinc-500">Loading listings...</div>
              ) : sortedListings.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">No listings found for current filters.</div>
              ) : showKeptOnly && displayListings.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500 px-3">
                  <p>No kept homes in this view.</p>
                  <Button type="button" variant="outline" className="mt-3" size="sm" onClick={() => setShowKeptOnly(false)}>
                    Show all
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {displayListings.map((listing) => {
                    const brokerageLine = formatBrokerageLine(resolveListingBrokerage(listing));
                    const isKept = sessionKeptIds.has(listing.id);

                    return (
                    <div
                      key={listing.id}
                      ref={(el) => { cardRefs.current[listing.id] = el; }}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/property/${listing.id}`)}
                      onMouseEnter={() => setHoveredListingId(listing.id)}
                      onMouseLeave={() => setHoveredListingId(null)}
                      onFocus={() => setHoveredListingId(listing.id)}
                      onBlur={() => setHoveredListingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/property/${listing.id}`);
                        }
                      }}
                      className={`group w-full rounded-[24px] bg-white overflow-hidden text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 transition-all duration-200 ease-out transform-gpu ${
                        listing.id === selectedListingId
                          ? "ring-2 ring-[#0E56F5]/50 shadow-[0_8px_28px_rgba(14,86,245,0.18)]"
                          : listing.id === hoveredListingId
                            ? "-translate-y-px shadow-[0_8px_24px_rgba(15,23,42,0.13)] ring-1 ring-zinc-200"
                            : "shadow-[0_2px_8px_rgba(15,23,42,0.07)] ring-1 ring-zinc-200/80 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] hover:ring-zinc-300/80"
                      }`}
                    >
                      <div className="relative w-full overflow-hidden bg-zinc-100" style={{ aspectRatio: "16/10" }}>
                        <ListingImage photos={listing.photos} alt={listing.address} />
                        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/55 via-white/15 to-transparent pointer-events-none" />
                        <div
                          className="absolute top-2 left-2 z-20 pointer-events-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isKept}
                            onChange={() => toggleSessionKeep(listing.id)}
                            className="h-5 w-5"
                            title="Keep in this search"
                            aria-label={isKept ? "Remove from this session" : "Keep in this search"}
                          />
                        </div>
                        <div
                          className="absolute top-2 right-2 z-20 max-w-[calc(100%-6.5rem)] flex min-h-0 items-center justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FavoriteButton
                            listingId={listing.id}
                            size="icon"
                            photoIcon
                            className="!h-7 !w-7 !min-w-0 p-0 [&>svg]:!h-6 [&>svg]:!w-6"
                          />
                        </div>
                      </div>

                      <div className="relative border-t border-zinc-200/45 bg-gradient-to-b from-white via-white to-[#fbfcff] px-3.5 pb-3.5 pt-3">
                        <p className="text-[1.05rem] font-semibold tracking-[-0.02em] leading-none text-zinc-950">
                          ${listing.price?.toLocaleString()}
                        </p>
                        <p className="mt-1.5 text-[13px] font-medium leading-[1.3] text-zinc-900 break-words">
                          {listing.address}
                        </p>
                        <p className="mt-1 text-[11.5px] font-medium leading-[1.35] text-zinc-500">
                          {listing.city}, {listing.state} {listing.zip_code}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-medium leading-none text-zinc-600">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                            <BedDouble className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                            {listing.bedrooms ?? "--"} bd
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                            <Bath className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                            {listing.bathrooms ?? "--"} ba
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                            <Ruler className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                            {listing.square_feet ? `${listing.square_feet.toLocaleString()} sqft` : "--"}
                          </span>
                        </div>
                        {brokerageLine && (
                          <p className="mt-2 text-[12px] leading-none text-zinc-400">
                            {brokerageLine}
                          </p>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
