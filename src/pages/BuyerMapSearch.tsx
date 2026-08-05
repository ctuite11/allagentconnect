import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ListingCard from "@/components/ListingCard";
import { MapPin, Search as SearchIcon, SlidersHorizontal, ChevronDown } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { supabase } from "@/integrations/supabase/client";
import { SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import PropertyMap from "@/components/PropertyMap";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { compareListingsByRecency } from "@/lib/listingRecencySort";
import { formatListingShareEmailStreetLine } from "@/lib/buildHotSheetShareEmailHtml";
import { buildNewListingSharedEmailSubject } from "@/lib/listingEmailSubject";
import { isDcmlsHost } from "@/lib/host";
import { getGoogleMapsBrowserKey } from "@/lib/googleMapsConfig";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { cn } from "@/lib/utils";
import { buyerFavoritesSplitPane } from "@/lib/buyerUi";

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
  const [criteria, setCriteria] = useState<SearchCriteria>(() => ({
    ...defaultSaleToolbarCriteria(),
    ...parseCriteriaFromUrl(window.location.search),
  }));
  const [locationInput, setLocationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
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
    const envKey = getGoogleMapsBrowserKey();
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
      next.sort((a, b) => compareListingsByRecency(a, b, "desc"));
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
    if (selectedVisibleListings.length === 1) {
      setShareSubject(buildNewListingSharedEmailSubject(selectedVisibleListings[0]!));
    } else {
      setShareSubject(`Share selected listings (${selectedVisibleListings.length})`);
    }
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
            const address = escapeHtml(formatListingShareEmailStreetLine(listing));
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
            const street = formatListingShareEmailStreetLine(listing);
            const cityStateZip = `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`
              .trim()
              .replace(/^,\s*|,\s*$/g, "");
            const address = [street, cityStateZip].filter(Boolean).join(", ");
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

  const fetchListings = useCallback(async () => {
    try {
      setFetchError(false);
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
      setFetchError(true);
      toast.error("Unable to load homes right now");
    } finally {
      setLoading(false);
    }
  }, [criteria]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const retryFetch = () => {
    void fetchListings();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-14 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-[1800px] px-4 pt-4 pb-3 md:px-7 md:pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap lg:gap-3">
              <div className="relative w-full max-w-[420px] min-w-0 shrink-0">
                <SearchIcon className="pointer-events-none h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLocationInput();
                  }}
                  placeholder="City, neighborhood, or ZIP"
                  className="h-9 border-neutral-200 bg-white pl-9 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors focus-visible:ring-neutral-300/50"
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
                    "h-8 min-w-[86px] rounded-md px-3 text-[13px] font-semibold leading-none tracking-tight transition-colors duration-200 ease-out",
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
                      statuses: ["coming_soon", "active", "off_market", "back_on_market"],
                    }))
                  }
                >
                  For Sale
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-8 min-w-[86px] rounded-md px-3 text-[13px] font-semibold leading-none tracking-tight transition-colors duration-200 ease-out",
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
                      statuses: ["active"],
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
                  <Button
                    variant="outline"
                    className="h-9 min-w-[124px] justify-between rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50/90"
                  >
                    <span>{priceButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[500px] rounded-2xl border-neutral-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
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
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                    {isRentSearch ? "Monthly rent" : "List price"}
                  </p>

                  {/* Histogram + Slider container */}
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex h-6 items-center gap-1">
                      {sliderChips.map((chip) => {
                        const chipIndex = chip.ratio * Math.max(1, priceStepValues.length - 1);
                        const active = chipIndex >= sliderMinIndex && chipIndex <= sliderMaxIndex;
                        return (
                          <span
                            key={chip.key}
                            className={cn(
                              "block h-2 flex-1 rounded-full transition-colors",
                              active ? "bg-neutral-700" : "bg-neutral-200",
                            )}
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
                          <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-neutral-200">
                          <SliderPrimitive.Range className="absolute h-full bg-neutral-700" />
                        </SliderPrimitive.Track>
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-neutral-700 bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-2" />
                        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-neutral-700 bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-2" />
                      </SliderPrimitive.Root>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-neutral-600">
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
                        <label className="text-[11px] font-medium text-neutral-500">Min price</label>
                        <Input
                          placeholder="No minimum"
                          value={priceFieldFocus.min ? priceDraft.min : formatCurrencyDraft(priceDraft.min, "min")}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value.replace(/[^\d]/g, "") }))}
                          onFocus={() => setPriceFieldFocus((prev) => ({ ...prev, min: true }))}
                          onBlur={() => {
                            setPriceFieldFocus((prev) => ({ ...prev, min: false }));
                            normalizePriceDraft("min");
                          }}
                          className="h-11 rounded-lg border-neutral-200 text-sm shadow-none focus-visible:ring-neutral-300/50"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-neutral-500">Max price</label>
                        <Input
                          placeholder="No maximum"
                          value={priceFieldFocus.max ? priceDraft.max : formatCurrencyDraft(priceDraft.max, "max")}
                          onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value.replace(/[^\d]/g, "") }))}
                          onFocus={() => setPriceFieldFocus((prev) => ({ ...prev, max: true }))}
                          onBlur={() => {
                            setPriceFieldFocus((prev) => ({ ...prev, max: false }));
                            normalizePriceDraft("max");
                          }}
                          className="h-11 rounded-lg border-neutral-200 text-sm shadow-none focus-visible:ring-neutral-300/50"
                        />
                        {isMaxAtTop && !priceFieldFocus.max && (
                          <p className="text-[10px] text-neutral-400">No maximum</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-5 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 rounded-lg border-neutral-200 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
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
                      className="h-10 flex-1 rounded-lg bg-neutral-900 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
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
                  <Button
                    variant="outline"
                    className="h-9 min-w-[132px] justify-between rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                  >
                    <span>{bedsBathsButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${bedsBathsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[340px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
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
                  <p className="text-sm font-semibold text-neutral-900">Bedrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BED_PRESETS.map((preset) => {
                      const selected = bedsBathsDraft.bedrooms === preset.bedrooms;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className={cn(
                            "h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 focus-visible:ring-offset-2",
                            selected
                              ? "border-neutral-900 bg-white text-neutral-900"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                          )}
                          onPointerDown={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.bedrooms }))}
                          onClick={() => setBedsBathsDraft((prev) => ({ ...prev, bedrooms: preset.bedrooms }))}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-neutral-900">Bathrooms</p>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {BATH_PRESETS.map((option) => {
                      const selected =
                        (option === "Any" && !bedsBathsDraft.bathrooms) ||
                        option.replace("+", "") === bedsBathsDraft.bathrooms;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            "h-8 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 focus-visible:ring-offset-2",
                            selected
                              ? "border-neutral-900 bg-white text-neutral-900"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                          )}
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
                  <Button
                    variant="outline"
                    className="h-9 min-w-[144px] justify-between rounded-md border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                  >
                    <span>{propertyTypeButtonLabel}</span>
                    <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${propertyTypeOpen ? "rotate-180" : ""}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[320px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
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
                  <p className="text-sm font-semibold text-neutral-900">Home type</p>
                  <div className="mt-2 space-y-2">
                    {PROPERTY_TYPE_OPTIONS.filter((type) => type !== "Any").map((type) => {
                      const checked = propertyTypesDraft.includes(type);
                      return (
                        <label
                          key={type}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50",
                            checked && "bg-neutral-50 ring-1 ring-neutral-200/80",
                          )}
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 rounded-md border-neutral-200 bg-white text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4 text-neutral-600" />
                    More filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 bg-neutral-900 text-[11px] font-medium text-white hover:bg-neutral-900">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px] rounded-xl border-neutral-200 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Bathrooms</p>
                      <Select
                        value={selectedBaths}
                        onValueChange={(value) => {
                          setCriteria((prev) => ({
                            ...prev,
                            bathrooms: value === "Any" ? "" : value.replace("+", ""),
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-2 h-9 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-neutral-300/50">
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
                      <p className="text-sm font-semibold text-neutral-900">Status</p>
                      <div className="mt-2 space-y-2">
                        {[
                          { value: "coming_soon", label: "Coming Soon" },
                          { value: "active", label: "On MLS" },
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
                        <Label className="text-xs text-neutral-600">Min sqft</Label>
                        <Input
                          value={criteria.minLivingArea || ""}
                          onChange={(e) => setCriteria((prev) => ({ ...prev, minLivingArea: e.target.value }))}
                          className="h-9 border-neutral-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-600">Max sqft</Label>
                        <Input
                          value={criteria.maxLivingArea || ""}
                          onChange={(e) => setCriteria((prev) => ({ ...prev, maxLivingArea: e.target.value }))}
                          className="h-9 border-neutral-200"
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                className="h-9 rounded-md border-neutral-200 bg-white text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                onClick={() => toast.info("Save search is coming soon")}
              >
                Save search
              </Button>

              <Button
                variant="outline"
                className="h-9 rounded-md border-neutral-200 bg-white text-[12px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                type="button"
                onClick={() =>
                  setCriteria(isRentSearch ? defaultRentToolbarCriteria() : defaultSaleToolbarCriteria())
                }
              >
                Clear filters
              </Button>
            </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-3 md:px-7 md:py-4">
        <div className="flex h-auto min-h-0 flex-col-reverse gap-3 sm:gap-4 lg:grid lg:h-[calc(100dvh-8rem)] lg:min-h-0 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none lg:gap-4">
          <section
            className={cn(
              buyerFavoritesSplitPane,
              "flex h-[50dvh] min-h-0 flex-col sm:h-[54dvh] lg:sticky lg:top-[6.25rem] lg:h-full lg:min-h-0 lg:self-start",
            )}
          >
            {loading ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2 bg-white p-3">
                <Skeleton className="h-8 w-full rounded-lg bg-neutral-100" />
                <Skeleton className="min-h-0 flex-1 rounded-xl bg-neutral-100" />
                <div className="flex shrink-0 gap-2 pt-1">
                  <Skeleton className="h-9 flex-1 rounded-lg bg-neutral-100" />
                  <Skeleton className="h-9 w-24 rounded-lg bg-neutral-100" />
                </div>
              </div>
            ) : !shouldUseLiveMap ? (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-white px-6 py-10">
                <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white px-6 py-7 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">Map unavailable</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-neutral-500">
                  {mapsKeyAvailable && import.meta.env.DEV && isLocalDevHost
                    ? "Listings still load below. Your Google Maps key may not allow localhost in development."
                    : "Listings still load below. Add a Google Maps API key to enable the live map."}
                  </p>
                </div>
              </div>
            ) : listings.length > 0 ? (
              <div className="h-full min-h-0 flex-1">
                <PropertyMap
                  listings={displayListings}
                  highlightedListingId={hoveredListingId}
                  selectedListingId={selectedListingId}
                  onListingHover={setHoveredListingId}
                  onListingSelect={handleMarkerSelect}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white px-6 py-10 text-center">
                <div className="max-w-md rounded-2xl border border-neutral-200 bg-white px-6 py-8 shadow-sm">
                  <MapPin className="mx-auto mb-3 h-9 w-9 text-neutral-400" />
                  <p className="text-[13px] leading-relaxed text-neutral-600">
                  {hasActiveFilters
                    ? "No homes match your filters on the map. Try widening price or area."
                    : "Add a location or adjust filters to see homes on the map."}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section
            className={cn(
              buyerFavoritesSplitPane,
              "flex h-auto min-h-0 max-lg:min-h-[50vh] flex-col lg:h-full lg:min-h-0",
            )}
          >
            <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2 sm:px-5 sm:py-2.5">
              <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium tabular-nums text-neutral-900">
                  {loading
                    ? "Results: —"
                    : fetchError
                      ? "Results: —"
                      : `Results: ${displayListings.length.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-3 sm:px-5 sm:py-4 lg:overflow-y-auto">
              {fetchError && !loading && listings.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <p className="min-w-0 text-[12px] leading-snug text-neutral-600">
                    Couldn&apos;t refresh. Showing your previous results.
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

              {!loading && sortedListings.length > 0 && (
                <div className="mb-3 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {visibleSelectionState.allVisible && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                          onClick={unselectAllVisible}
                        >
                          Unselect all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
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
                          className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                          onClick={addAllVisible}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={showKeptOnly ? "default" : "outline"}
                          className={
                            showKeptOnly
                              ? "h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[11px] font-medium"
                              : "h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                          }
                          onClick={() => setShowKeptOnly(true)}
                          aria-pressed={showKeptOnly}
                        >
                          Keep selected only
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
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
                        className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 disabled:opacity-50"
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
                        className="h-7 shrink-0 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 text-[11px] font-medium text-white hover:bg-neutral-800"
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
                        className="h-7 shrink-0 whitespace-nowrap rounded-md border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                        onClick={addSelectedListingsToFavorites}
                      >
                        Add to favorites
                      </Button>
                    )}
                  </div>
                  <div className="w-full min-w-0 shrink-0 min-[480px]:w-44 min-[480px]:max-w-[50%]">
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                      <SelectTrigger className="h-8 rounded-md border-neutral-200 bg-white text-[11px] font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-neutral-300/50">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-neutral-200 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="price_asc">Price: Low to High</SelectItem>
                        <SelectItem value="price_desc">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-neutral-100 bg-white p-2">
                      <Skeleton className="aspect-[4/3] w-full rounded-lg bg-neutral-100" />
                      <Skeleton className="h-4 w-[85%] rounded-md bg-neutral-100" />
                      <Skeleton className="h-3 w-[55%] rounded-md bg-neutral-100" />
                    </div>
                  ))}
                </div>
              ) : fetchError && listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
                  <p className="text-[13px] font-medium text-neutral-900">Couldn&apos;t load homes</p>
                  <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-neutral-500">
                    Check your connection and try again.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-5 h-8 rounded-md bg-neutral-900 px-4 text-[12px] font-medium text-white hover:bg-neutral-800"
                    onClick={retryFetch}
                  >
                    Try again
                  </Button>
                </div>
              ) : sortedListings.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
                  <p className="text-[13px] text-neutral-600">No listings match your filters.</p>
                  <p className="mt-1 text-[12px] text-neutral-500">Adjust location or price and search again.</p>
                </div>
              ) : showKeptOnly && displayListings.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
                  <p className="text-[13px] text-neutral-600">No kept homes in this view.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 h-8 border-neutral-200 text-[12px]"
                    onClick={() => setShowKeptOnly(false)}
                  >
                    Show all
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
            <h3 className="text-[15px] font-semibold text-neutral-900">Share selected listings</h3>
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
              <Button type="button" variant="outline" className="border-neutral-200" onClick={() => setShareModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSendShareEmail} disabled={shareSending}>
                Send email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
