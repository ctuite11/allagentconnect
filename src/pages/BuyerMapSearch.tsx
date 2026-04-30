import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import { BedDouble, Bath, MapPin, Search as SearchIcon, SlidersHorizontal, Ruler, ChevronDown } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { supabase } from "@/integrations/supabase/client";
import { SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import PropertyMap from "@/components/PropertyMap";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { isDcmlsHost } from "@/lib/host";
import {
  RENT_PRICE_ABS_MAX,
  RENT_PRICE_ABS_MIN,
  RENT_PRICE_STEP_VALUES,
  SALE_PRICE_ABS_MAX,
  SALE_PRICE_ABS_MIN,
  defaultRentToolbarCriteria,
  defaultSaleToolbarCriteria,
  salePriceStepValues,
} from "@/lib/buyerSearchRentFilters";
import { toast } from "sonner";
import FavoriteButton from "@/components/FavoriteButton";
import {
  type ListingRecord,
  type AgentOfficeRecord,
  getPrimaryPhotoUrl,
  ListingImage,
  formatBrokerageLine,
  resolveListingBrokerage,
} from "@/components/buyer/buyerListingDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

  // Rental URLs always resolve to residential rentals only (purpose-built rental search).
  if (urlCriteria.listingType === "for_rent") {
    urlCriteria.propertyTypes = ["residential_rental"];
  }

  return urlCriteria;
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
    ...defaultSaleToolbarCriteria(),
    ...parseCriteriaFromUrl(window.location.search),
  }));
  const [locationInput, setLocationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [sessionKeptIds, setSessionKeptIds] = useState<Set<string>>(new Set());
  const [showKeptOnly, setShowKeptOnly] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [bedsBathsOpen, setBedsBathsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [priceFieldFocus, setPriceFieldFocus] = useState({ min: false, max: false });
  const [bedsBathsDraft, setBedsBathsDraft] = useState({ bedrooms: "", bathrooms: "" });
  const [propertyTypesDraft, setPropertyTypesDraft] = useState<string[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToEmail, setShareToEmail] = useState("");
  const [shareSubject, setShareSubject] = useState("Share selected listings");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSending, setShareSending] = useState(false);
  /** Bumps so FavoriteButton re-fetches after bulk add to favorites. */
  const [favoritesSyncKey, setFavoritesSyncKey] = useState(0);
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

  const isRentSearch = criteria.listingType === "for_rent";

  const hasActiveFilters = useMemo(() => {
    const typesCount =
      !isRentSearch && criteria.propertyTypes && criteria.propertyTypes.length > 0;
    return Boolean(
      (criteria.towns && criteria.towns.length > 0) ||
        (criteria.neighborhoods && criteria.neighborhoods.length > 0) ||
        criteria.zipCode ||
        criteria.minPrice ||
        criteria.maxPrice ||
        criteria.bedrooms ||
        criteria.bathrooms ||
        typesCount
    );
  }, [criteria, isRentSearch]);

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

  const visibleSelectionState = useMemo(() => {
    const n = displayListings.length;
    if (n === 0) {
      return { allVisible: false, someVisible: false, noneVisible: true };
    }
    const selected = displayListings.filter((l) => sessionKeptIds.has(l.id)).length;
    if (selected === 0) return { allVisible: false, someVisible: false, noneVisible: true };
    if (selected === n) return { allVisible: true, someVisible: false, noneVisible: false };
    return { allVisible: false, someVisible: true, noneVisible: false };
  }, [displayListings, sessionKeptIds]);

  const selectedVisibleListings = useMemo(
    () =>
      displayListings
        .filter((l): l is (typeof displayListings)[number] => l != null && Boolean(l.id))
        .filter((l) => sessionKeptIds.has(l.id)),
    [displayListings, sessionKeptIds],
  );

  useEffect(() => {
    if (showKeptOnly && sessionKeptIds.size === 0) {
      setShowKeptOnly(false);
    }
  }, [showKeptOnly, sessionKeptIds.size]);

  const toggleSessionKeep = (listingId: string) => {
    setSessionKeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  };

  const addAllVisible = useCallback(() => {
    setSessionKeptIds((prev) => {
      const next = new Set(prev);
      displayListings.forEach((l) => next.add(l.id));
      return next;
    });
  }, [displayListings]);

  const unselectAllVisible = useCallback(() => {
    setSessionKeptIds((prev) => {
      const next = new Set(prev);
      displayListings.forEach((l) => next.delete(l.id));
      return next;
    });
  }, [displayListings]);

  const shareVisibleSelected = useCallback(() => {
    if (selectedVisibleListings.length === 0) return;
    setShareSubject(`Share selected listings (${selectedVisibleListings.length})`);
    setShareMessage("Here are some listings I wanted to share:");
    setShareModalOpen(true);
  }, [selectedVisibleListings]);

  const addSelectedListingsToFavorites = useCallback(async () => {
    const selectedIds = displayListings.filter((l) => sessionKeptIds.has(l.id)).map((l) => l.id);
    if (selectedIds.length === 0) return;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      if (isDcmlsHost()) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/consumer/auth?mode=signup&from=${encodeURIComponent(from)}`;
      } else {
        toast.error("Please sign in to save favorites");
      }
      return;
    }

    const { data: existing } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", selectedIds);

    const existingSet = new Set((existing || []).map((r) => r.listing_id));
    const toInsert = selectedIds.filter((id) => !existingSet.has(id));

    if (toInsert.length === 0) {
      toast.info("All selected listings are already in your favorites");
      return;
    }

    const { error } = await supabase
      .from("favorites")
      .insert(toInsert.map((listing_id) => ({ user_id: user.id, listing_id })));

    if (error) {
      console.error(error);
      toast.error("Failed to add favorites");
      return;
    }

    toast.success("Selected listings added to favorites");
    setFavoritesSyncKey((k) => k + 1);
  }, [displayListings, sessionKeptIds]);

  const handleSendShareEmail = useCallback(() => {
    const run = async () => {
      if (!shareToEmail.trim() || !shareSubject.trim() || !shareMessage.trim()) {
        toast.error("Please fill in To email, Subject, and Message");
        return;
      }

      setShareSending(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) {
          toast.error("You must be logged in to send email");
          return;
        }

        const recipientEmail = shareToEmail.trim();
        const recipientName = recipientEmail.split("@")[0] || "Recipient";

        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        // CTA: matches :root --primary / --aac (hsl(221,92% 51%))
        const aacPrimaryCta = "#0E56F5";
        const sharePhotoH = 150;
        const shareImgColW = 240;

        const listingCardsHtml = selectedVisibleListings
          .map((listing) => {
            const listingUrl = `${window.location.origin}/consumer-property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const address = escapeHtml(listing.address || "Address unavailable");
            const cityStateZip = escapeHtml(
              `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim(),
            );
            const photoUrl = getPrimaryPhotoUrl(listing?.photos ?? []);
            const safePhoto = photoUrl ? escapeHtml(photoUrl) : "";
            return [
              `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:14px 0;background:#ffffff;box-shadow:0 1px 6px rgba(17,24,39,0.06);">`,
              `<tr>`,
              `<td width="${shareImgColW}" style="width:${shareImgColW}px;vertical-align:top;background:#f3f4f6;padding:0;">`,
              safePhoto
                ? `<a href="${listingUrl}" style="text-decoration:none;"><img src="${safePhoto}" alt="${address}" width="${shareImgColW}" height="${sharePhotoH}" style="display:block;width:${shareImgColW}px;max-width:100%;height:${sharePhotoH}px;object-fit:cover;object-position:center;border:0;line-height:0;font-size:0;" /></a>`
                : `<div style="box-sizing:border-box;width:${shareImgColW}px;height:${sharePhotoH}px;line-height:${sharePhotoH}px;text-align:center;background:#f3f4f6;color:#6b7280;font-size:12px;overflow:hidden;">Photo unavailable</div>`,
              `</td>`,
              `<td style="padding:16px 18px;vertical-align:top;">`,
              `<div style="font-size:22px;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(price)}</div>`,
              `<div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${address}</div>`,
              `<div style="margin-top:4px;font-size:13px;color:#6b7280;line-height:1.35;">${cityStateZip}</div>`,
              `<div style="margin-top:16px;"><a href="${listingUrl}" style="display:inline-block;background-color:${aacPrimaryCta};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">View listing</a></div>`,
              `</td>`,
              `</tr>`,
              `</table>`,
            ].join("");
          })
          .join("");

        const plainTextFallback = selectedVisibleListings
          .map((listing) => {
            const listingUrl = `${window.location.origin}/consumer-property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const address = `${listing.address || ""}, ${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim();
            return `- ${address} - ${price} - ${listingUrl}`;
          })
          .join("\n");

        const messageHtml = escapeHtml(shareMessage.trim()).replace(/\n/g, "<br>");
        // Align with supabase/functions/_shared/aacEmailTemplate.ts (hot-sheet–style brand shell)
        const aacLogoUrl =
          "https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-monogram-green.svg";
        const aacNavy = "#111317";
        const aacGreen = "#50c878";
        const composedMessageHtml = [
          `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background-color:#ffffff;">`,
          `<tr><td align="center" style="padding:24px 12px 32px;">`,
          `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">`,
          `<tr><td align="center" style="background-color:${aacNavy};border-radius:12px 12px 0 0;padding:32px 28px 0;">`,
          `<img src="${aacLogoUrl}" width="40" height="40" alt="All Agent Connect" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`,
          `<p style="margin:12px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;">All Agent Connect</p>`,
          `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Shared listings</p>`,
          `<div style="width:48px;height:2px;background-color:${aacGreen};margin:16px auto 0;border-radius:1px;"></div>`,
          `<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>`,
          `</td></tr>`,
          `<tr><td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:none;">`,
          `<div style="padding:28px 32px 24px;">`,
          `<div style="font-size:15px;line-height:1.6;color:#334155;">${messageHtml}</div>`,
          `<div style="margin-top:16px;">${listingCardsHtml}</div>`,
          `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#64748b;">`,
          `If a listing is no longer available, your agent can share updated options.`,
          `</p>`,
          `</div>`,
          `</td></tr>`,
          `<tr><td align="center" style="background-color:${aacNavy};border-top:2px solid ${aacGreen};border-radius:0 0 12px 12px;padding:22px 28px 20px;">`,
          `<img src="${aacLogoUrl}" width="24" height="24" alt="" style="display:block;margin:0 auto 10px;border:0;outline:none;" />`,
          `<p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);">All Agent Connect</p>`,
          `<p style="margin:0 0 6px;font-size:12px;">`,
          `<a href="mailto:hello@allagentconnect.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">hello@allagentconnect.com</a>`,
          `</p>`,
          `</td></tr>`,
          `</table>`,
          `<!-- plain-text-fallback: ${escapeHtml(plainTextFallback)} -->`,
          `</td></tr>`,
          `</table>`,
        ].join("");

        const { error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            recipients: [{ email: recipientEmail, name: recipientName }],
            subject: shareSubject.trim(),
            message: composedMessageHtml,
            agentId: user.id,
            sendAsGroup: false,
          },
        });

        if (error) throw error;

        toast.success("Email sent");
        setShareModalOpen(false);
      } catch (error: any) {
        console.error("Error sending share email:", error);
        toast.error(error?.message || "Failed to send email");
      } finally {
        setShareSending(false);
      }
    };

    void run();
  }, [shareToEmail, shareSubject, shareMessage, selectedVisibleListings]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (criteria.zipCode || (criteria.towns && criteria.towns.length > 0)) count += 1;
    if (criteria.minPrice || criteria.maxPrice) count += 1;
    if (criteria.bedrooms || criteria.bathrooms) count += 1;
    if (!isRentSearch && criteria.propertyTypes && criteria.propertyTypes.length > 0) count += 1;
    if (criteria.statuses && criteria.statuses.length > 0 && criteria.statuses.length < 4) count += 1;
    return count;
  }, [criteria, isRentSearch]);

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

  const priceFloor = isRentSearch ? RENT_PRICE_ABS_MIN : SALE_PRICE_ABS_MIN;
  const priceCeil = isRentSearch ? RENT_PRICE_ABS_MAX : SALE_PRICE_ABS_MAX;

  const priceStepValues = useMemo(
    () => (isRentSearch ? [...RENT_PRICE_STEP_VALUES] : salePriceStepValues()),
    [isRentSearch],
  );

  const snapToNearestPriceStep = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return priceFloor;
      const bounded = Math.max(priceFloor, Math.min(value, priceCeil));

      let nearest = priceStepValues[0] ?? bounded;
      let minDiff = Math.abs(nearest - bounded);
      for (const candidate of priceStepValues) {
        const diff = Math.abs(candidate - bounded);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = candidate;
        }
      }

      return nearest;
    },
    [priceStepValues, priceFloor, priceCeil],
  );

  const normalizePriceDraft = (field: "min" | "max") => {
    const fallback = field === "min" ? priceFloor : priceCeil;
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
    if (!priceDraft.min || !Number.isFinite(parsed)) return priceFloor;
    return snapToNearestPriceStep(parsed);
  }, [priceDraft.min, snapToNearestPriceStep, priceFloor]);

  const draftMaxNumber = useMemo(() => {
    const parsed = Number(priceDraft.max);
    if (!priceDraft.max || !Number.isFinite(parsed)) return priceCeil;
    return snapToNearestPriceStep(parsed);
  }, [priceDraft.max, snapToNearestPriceStep, priceCeil]);

  const sliderMinValue = Math.min(draftMinNumber, draftMaxNumber);
  const sliderMaxValue = Math.max(draftMinNumber, draftMaxNumber);

  const sliderMinIndex = useMemo(() => {
    const i = priceStepValues.indexOf(sliderMinValue);
    return Math.max(0, i >= 0 ? i : 0);
  }, [priceStepValues, sliderMinValue]);

  const sliderMaxIndex = useMemo(() => {
    const i = priceStepValues.indexOf(sliderMaxValue);
    return Math.max(0, i >= 0 ? i : priceStepValues.length - 1);
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
    if (field === "max" && asNumber >= priceCeil) return `$${asNumber.toLocaleString()}+`;
    return `$${asNumber.toLocaleString()}`;
  };

  const isMaxAtTop = useMemo(() => {
    if (!priceDraft.max) return true;
    const n = Number(priceDraft.max);
    return !Number.isFinite(n) || n >= priceCeil;
  }, [priceDraft.max, priceCeil]);

  const applyPriceDraft = () => {
    const minValue = snapToNearestPriceStep(Number(priceDraft.min) || priceFloor);
    const maxValue = snapToNearestPriceStep(Number(priceDraft.max) || priceCeil);
    const normalizedMin = Math.min(minValue, maxValue);
    const normalizedMax = Math.max(minValue, maxValue);

    setCriteria((prev) => ({
      ...prev,
      minPrice: normalizedMin <= priceFloor ? "" : String(normalizedMin),
      maxPrice: normalizedMax >= priceCeil ? "" : String(normalizedMax),
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
      <div className="sticky top-14 z-40 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/84">
        <div className="mx-auto w-full max-w-[1800px] px-5 md:px-7 pt-6 pb-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 md:gap-4">
              <div className="relative w-full max-w-[420px] min-w-0 shrink-0">
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
                  className={`h-8 min-w-[86px] px-3 rounded-[5px] inline-flex items-center justify-center text-[13px] font-semibold leading-none tracking-[0.01em] transition-all ${
                    criteria.listingType === "for_rent"
                      ? "bg-[#0E56F5] text-white shadow-[0_3px_8px_rgba(14,86,245,0.32)]"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  onClick={() =>
                    setCriteria((prev) => ({
                      ...prev,
                      listingType: "for_rent",
                      propertyTypes: ["residential_rental"],
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
                    setPriceDraft({
                      min: criteria.minPrice || String(priceFloor),
                      max: criteria.maxPrice || String(priceCeil),
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
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-zinc-500 mb-1">
                    {isRentSearch ? "MONTHLY RENT" : "LIST PRICE"}
                  </p>

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
                              active ? "bg-[#0E56F5] opacity-100" : "bg-zinc-300 opacity-45"
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
                          const nextMin = priceStepValues[Math.min(safeMinIndex, safeMaxIndex)] ?? priceFloor;
                          const nextMax = priceStepValues[Math.max(safeMinIndex, safeMaxIndex)] ?? priceCeil;
                          setPriceDraft({ min: String(nextMin), max: String(nextMax) });
                        }}
                        className="relative flex w-full touch-none select-none items-center"
                      >
                          <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-zinc-200">
                          <SliderPrimitive.Range className="absolute h-full bg-[#0E56F5]" />
                        </SliderPrimitive.Track>
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#0E56F5] bg-white shadow-[0_2px_8px_rgba(14,86,245,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5] focus-visible:ring-offset-1" />
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-[3px] border-[#0E56F5] bg-white shadow-[0_2px_8px_rgba(14,86,245,0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5] focus-visible:ring-offset-1" />
                      </SliderPrimitive.Root>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-600">
                        {isRentSearch ? (
                          <>
                            <span>$500</span>
                            <span>$10k+</span>
                          </>
                        ) : (
                          <>
                            <span>$50k</span>
                            <span>$10M+</span>
                          </>
                        )}
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
                        setPriceDraft({ min: String(priceFloor), max: String(priceCeil) });
                        setCriteria((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                        setPriceOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      className="h-11 flex-1 rounded-lg bg-[#0E56F5] hover:bg-[#0B46CC] text-sm font-semibold"
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
              )}

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
                variant="outline"
                className="h-9 rounded-md border-zinc-200/80 text-[12px] text-zinc-700"
                type="button"
                onClick={() =>
                  setCriteria(isRentSearch ? defaultRentToolbarCriteria() : defaultSaleToolbarCriteria())
                }
              >
                Clear Filters
              </Button>
            </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-3">
        <div className="flex flex-col-reverse gap-4 h-auto min-h-0 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none lg:h-[calc(100dvh-7.8rem)] lg:min-h-0">
          <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-[50dvh] min-h-0 sm:h-[54dvh] lg:h-full lg:min-h-0 lg:sticky lg:top-[6.05rem]">
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

          <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-auto min-h-0 max-lg:min-h-[50vh] lg:min-h-0 lg:h-full flex flex-col">
            <div className="shrink-0 border-b border-zinc-200/60 bg-white px-6 py-2.5">
              <div className="flex flex-nowrap items-center justify-between gap-2 min-w-0">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                  {loading
                    ? "Results: —"
                    : `Results: ${displayListings.length.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 min-h-0 flex-1 lg:overflow-y-auto">
              {!loading && sortedListings.length > 0 && (
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleSelectionState.allVisible && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-md px-2.5 text-xs"
                          onClick={unselectAllVisible}
                        >
                          Unselect all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-md px-2.5 text-xs"
                          onClick={shareVisibleSelected}
                        >
                          Share selected
                        </Button>
                      </>
                    )}
                    {visibleSelectionState.someVisible && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-md px-2.5 text-xs"
                          onClick={addAllVisible}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={showKeptOnly ? "default" : "outline"}
                          className="h-7 rounded-md px-2.5 text-xs"
                          onClick={() => setShowKeptOnly(true)}
                          aria-pressed={showKeptOnly}
                        >
                          Keep selected only
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-md px-2.5 text-xs"
                          onClick={shareVisibleSelected}
                        >
                          Share selected
                        </Button>
                      </>
                    )}
                    {visibleSelectionState.noneVisible && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-md px-2.5 text-xs"
                        onClick={addAllVisible}
                        disabled={displayListings.length === 0}
                      >
                        Select all
                      </Button>
                    )}
                    {showKeptOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 rounded-md px-2.5 text-xs"
                        onClick={() => setShowKeptOnly(false)}
                      >
                        Show all
                      </Button>
                    )}
                    {!visibleSelectionState.noneVisible && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-md px-2.5 text-xs"
                        onClick={addSelectedListingsToFavorites}
                      >
                        Add selected to favorites
                      </Button>
                    )}
                  </div>
                  <div className="w-44 min-w-0 max-w-[55%] shrink-0 sm:w-48 sm:max-w-[50%]">
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                      <SelectTrigger className="h-8 rounded-md border-zinc-200/80 text-xs">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="price_asc">Price: Low to High</SelectItem>
                        <SelectItem value="price_desc">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
                    const isKept = sessionKeptIds.has(listing.id);

                    return (
                    <div
                      key={listing.id}
                      ref={(el) => { cardRefs.current[listing.id] = el; }}
                      onMouseEnter={() => setHoveredListingId(listing.id)}
                      onMouseLeave={() => setHoveredListingId(null)}
                      className="w-full"
                    >
                      <ListingCard
                        listing={listing}
                        viewMode="compact"
                        showActions={false}
                        hideMlsMeta
                        onSelect={toggleSessionKeep}
                        isSelected={isKept}
                      />
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Share selected listings</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-to-email">To email</Label>
                <Input
                  id="share-to-email"
                  type="email"
                  placeholder="name@example.com"
                  value={shareToEmail}
                  onChange={(e) => setShareToEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-subject">Subject</Label>
                <Input
                  id="share-subject"
                  value={shareSubject}
                  onChange={(e) => setShareSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-message">Message</Label>
                <Textarea
                  id="share-message"
                  className="min-h-[180px]"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShareModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSendShareEmail} disabled={shareSending}>
                Send Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
