import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { LISTING_STATUS, OFF_MARKET_STATUSES } from "@/constants/status";
import type { BannerData, OpenHouseBannerData } from "@/components/ListingCardShell";

/**
 * useListingBanners — shared lifecycle photo-banner derivation.
 *
 * Temporary override precedence (highest first):
 * 1. PRICE REDUCED — price decrease within 24h
 * 2. BACK ON MARKET — return from off-market within 24h
 * 3. Persistent base status banner for every searchable listing status
 *
 * Open house is independent and may coexist with whichever primary banner wins.
 *
 * NEW LISTING is retired: active (and legacy `new`) listings use ON MLS.
 * getStatusChangeBanner() must not return null solely because the status is
 * outside Active / Coming Soon / Off Market.
 */

const TEMP_BANNER_HOURS = 24;

/** Solid photo-badge colors aligned with LISTING_STATUS_CONFIG families. */
const PERSISTENT_STATUS_BANNERS: Record<
  string,
  { text: string; color: string; iconType: BannerData["iconType"] }
> = {
  [LISTING_STATUS.ACTIVE]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  [LISTING_STATUS.NEW]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  // Marketable lifecycle variants still read as on-MLS once temporary BOM expires.
  [LISTING_STATUS.BACK_ON_MARKET]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  [LISTING_STATUS.PRICE_CHANGED]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  [LISTING_STATUS.EXTENDED]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  [LISTING_STATUS.REACTIVATED]: { text: "ON MLS", color: "bg-neutral-900", iconType: "sparkles" },
  [LISTING_STATUS.COMING_SOON]: { text: "COMING SOON", color: "bg-amber-600", iconType: "sparkles" },
  [LISTING_STATUS.OFF_MARKET]: { text: "OFF MARKET", color: "bg-rose-600", iconType: "refresh" },
  [LISTING_STATUS.PENDING]: { text: "PENDING", color: "bg-violet-600", iconType: "refresh" },
  [LISTING_STATUS.UNDER_AGREEMENT]: { text: "UNDER AGREEMENT", color: "bg-violet-600", iconType: "refresh" },
  [LISTING_STATUS.CONTINGENT]: { text: "CONTINGENT", color: "bg-violet-600", iconType: "refresh" },
  [LISTING_STATUS.SOLD]: { text: "SOLD", color: "bg-neutral-700", iconType: "refresh" },
  [LISTING_STATUS.RENTED]: { text: "RENTED", color: "bg-neutral-700", iconType: "refresh" },
  [LISTING_STATUS.WITHDRAWN]: { text: "WITHDRAWN", color: "bg-neutral-600", iconType: "refresh" },
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: {
    text: "TEMPORARILY WITHDRAWN",
    color: "bg-neutral-600",
    iconType: "refresh",
  },
  [LISTING_STATUS.CANCELLED]: { text: "CANCELLED", color: "bg-neutral-600", iconType: "refresh" },
  [LISTING_STATUS.CANCELED]: { text: "CANCELLED", color: "bg-neutral-600", iconType: "refresh" },
  [LISTING_STATUS.EXPIRED]: { text: "EXPIRED", color: "bg-neutral-600", iconType: "refresh" },
  [LISTING_STATUS.DRAFT]: { text: "DRAFT", color: "bg-neutral-500", iconType: "refresh" },
};

export interface UseListingBannersInput {
  id: string;
  status: string;
  is_relisting?: boolean | null;
  open_houses?: unknown;
}

export interface UseListingBannersResult {
  /** Always set for listing cards — temporary BOM or persistent status. */
  statusBanner: BannerData;
  priceChangeBanner: BannerData | null;
  openHouseBanner: OpenHouseBannerData | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function getNextOpenHouse(openHouses: unknown): any | null {
  if (!openHouses || !Array.isArray(openHouses)) return null;
  const now = new Date();
  const upcoming = (openHouses as any[])
    .filter((oh: any) => {
      if (!oh?.date || !oh?.end_time) return false;
      const end = new Date(`${oh.date}T${oh.end_time}:00`);
      return end > now;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] || null;
}

function fallbackStatusBanner(status: string): BannerData {
  const text = status
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase() || "LISTING";
  return {
    text,
    color: "bg-neutral-700",
    iconType: "refresh",
  };
}

export function useListingBanners(listing: UseListingBannersInput): UseListingBannersResult {
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadStatusHistory = async () => {
      try {
        const { data } = await supabase
          .from("listing_status_history")
          .select("*")
          .eq("listing_id", listing.id)
          .order("changed_at", { ascending: false })
          .limit(5);
        if (!cancelled && data) setStatusHistory(data);
      } catch (error) {
        console.error("Error loading status history:", error);
      }
    };

    const loadPriceHistory = async () => {
      try {
        const { data } = await supabase
          .from("favorite_price_history")
          .select("*")
          .eq("listing_id", listing.id)
          .order("changed_at", { ascending: false })
          .limit(1);
        if (!cancelled && data) setPriceHistory(data);
      } catch (error) {
        console.error("Error loading price history:", error);
      }
    };

    loadStatusHistory();
    loadPriceHistory();

    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  const getPriceChangeBanner = (): BannerData | null => {
    if (priceHistory.length === 0) return null;

    const recentPriceChange = priceHistory[0];
    if (
      hoursSince(recentPriceChange.changed_at) <= TEMP_BANNER_HOURS &&
      recentPriceChange.new_price < recentPriceChange.old_price
    ) {
      return {
        text: "PRICE REDUCED",
        color: "bg-red-600",
        iconType: "trendingDown",
      };
    }

    return null;
  };

  const getBackOnMarketBanner = (): BannerData | null => {
    const currentStatus = listing.status;
    const isActiveStatus =
      currentStatus === LISTING_STATUS.ACTIVE ||
      currentStatus === LISTING_STATUS.NEW ||
      currentStatus === LISTING_STATUS.BACK_ON_MARKET;

    if (!isActiveStatus || statusHistory.length < 2) return null;

    const previousStatus = statusHistory[1]?.new_status;
    const changeDate = statusHistory[0].changed_at;
    if (hoursSince(changeDate) > TEMP_BANNER_HOURS) return null;

    if (OFF_MARKET_STATUSES.includes(previousStatus)) {
      return {
        text: "BACK ON MARKET",
        color: "bg-orange-600",
        iconType: "refresh",
      };
    }

    return null;
  };

  /** Persistent base status for every searchable listing card status. */
  const getBaseStatusBanner = (): BannerData => {
    const mapped = PERSISTENT_STATUS_BANNERS[listing.status];
    if (mapped) return { ...mapped };
    return fallbackStatusBanner(listing.status);
  };

  /**
   * statusBanner carries temporary BACK ON MARKET or the persistent base status.
   * PRICE REDUCED is returned separately and must win in ListingPhotoBanners.
   * Never null for a listing card status — unknown statuses get a fallback chip.
   */
  const getStatusChangeBanner = (): BannerData => {
    return getBackOnMarketBanner() ?? getBaseStatusBanner();
  };

  const getOpenHouseBanner = (): OpenHouseBannerData | null => {
    const nextOH = getNextOpenHouse(listing.open_houses);
    if (!nextOH) return null;
    const isBrokerOnly = nextOH.event_type === "broker_tour";
    return {
      text: isBrokerOnly ? "BROKER TOUR" : "OPEN HOUSE",
      date: format(new Date(nextOH.date), "MMM d"),
      time: `${formatTime(nextOH.start_time)} - ${formatTime(nextOH.end_time)}`,
      color: isBrokerOnly ? "bg-purple-600" : "bg-green-600",
      isBroker: isBrokerOnly,
    };
  };

  return {
    statusBanner: getStatusChangeBanner(),
    priceChangeBanner: getPriceChangeBanner(),
    openHouseBanner: getOpenHouseBanner(),
  };
}
