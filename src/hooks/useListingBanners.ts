import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { LISTING_STATUS, isComingSoon } from "@/constants/status";
import type { BannerData, OpenHouseBannerData } from "@/components/ListingCardShell";

/**
 * useListingBanners — shared lifecycle photo-banner derivation.
 *
 * Extracted verbatim from src/components/ListingCard.tsx. Both the agent-side
 * ListingCard and the buyer-side SearchListingCard consume this hook so the
 * Coming Soon / New Listing / Back on Market / Price Reduced / Off Market /
 * Open House banners stay in lockstep.
 *
 * Timing rules (must match agent card):
 * - COMING SOON       — while status = coming_soon
 * - NEW LISTING       — status = new, or status = active within 48h of the
 *                       most recent active transition, and !is_relisting
 * - BACK ON MARKET    — previous status was pending/under_agreement/withdrawn/
 *                       cancelled/temporarily_withdrawn, now active, within 48h
 * - PRICE REDUCED     — most recent favorite_price_history row is a decrease,
 *                       within 48h
 * - OFF MARKET        — while status = off_market
 * - OPEN HOUSE / BROKER OPEN — next upcoming open_houses event
 */

export interface UseListingBannersInput {
  id: string;
  status: string;
  is_relisting?: boolean | null;
  open_houses?: unknown;
}

export interface UseListingBannersResult {
  statusBanner: BannerData | null;
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

  const getStatusChangeBanner = (): BannerData | null => {
    const currentStatus = listing.status;

    if (isComingSoon(currentStatus)) {
      return {
        text: "COMING SOON",
        color: "bg-purple-600",
        iconType: "sparkles",
      };
    }

    const isNewStatus = currentStatus === LISTING_STATUS.NEW;
    const isActiveStatus = currentStatus === LISTING_STATUS.ACTIVE;

    if ((isNewStatus || isActiveStatus) && !listing.is_relisting) {
      if (isNewStatus) {
        return {
          text: "NEW LISTING",
          color: "bg-neutral-900",
          iconType: "sparkles",
        };
      }

      if (isActiveStatus && statusHistory.length > 0) {
        const allActiveStatuses = statusHistory.filter(
          (h) => h.new_status === LISTING_STATUS.ACTIVE,
        );
        if (allActiveStatuses.length >= 1) {
          const mostRecentActiveDate = new Date(allActiveStatuses[0].changed_at);
          const hoursSinceActive =
            (Date.now() - mostRecentActiveDate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceActive <= 48) {
            return {
              text: "NEW LISTING",
              color: "bg-neutral-900",
              iconType: "sparkles",
            };
          }
        }
      }
    }

    if (statusHistory.length >= 2 && isActiveStatus) {
      const previousStatus = statusHistory[1]?.new_status;
      const changeDate = new Date(statusHistory[0].changed_at);
      const hoursSinceChange = (Date.now() - changeDate.getTime()) / (1000 * 60 * 60);

      const offMarketStatuses = [
        LISTING_STATUS.PENDING,
        LISTING_STATUS.UNDER_AGREEMENT,
        LISTING_STATUS.WITHDRAWN,
        LISTING_STATUS.CANCELLED,
        LISTING_STATUS.TEMPORARILY_WITHDRAWN,
      ];
      if (offMarketStatuses.includes(previousStatus) && hoursSinceChange <= 48) {
        return {
          text: "BACK ON MARKET",
          color: "bg-orange-600",
          iconType: "refresh",
        };
      }
    }

    if (currentStatus === LISTING_STATUS.OFF_MARKET) {
      return {
        text: "OFF MARKET",
        color: "bg-rose-600",
        iconType: "refresh",
      };
    }

    return null;
  };

  const getPriceChangeBanner = (): BannerData | null => {
    if (priceHistory.length === 0) return null;

    const recentPriceChange = priceHistory[0];
    const changeDate = new Date(recentPriceChange.changed_at);
    const hoursSinceChange = (Date.now() - changeDate.getTime()) / (1000 * 60 * 60);

    if (
      hoursSinceChange <= 48 &&
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