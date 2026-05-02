import { Fragment, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Share2, Heart } from "lucide-react";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { cn } from "@/lib/utils";

const AUTO_FIT_GRID =
  "grid gap-4 grid-cols-1 md:gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]";
const CARD_IMG_AUTO = "aspect-[4/3] min-h-[168px]";

interface MyListingsRowProps {
  listings: SuccessHubSummary["listings"];
  /** Success Hub: responsive autofit grid (same rhythm as Market activity) */
  autoFitGrid?: boolean;
}

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toLocaleString()}`;
}

export function MyListingsRow({ listings, denseGrid = false }: MyListingsRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  const renderCard = (
    listing: (typeof listings)[number],
    opts: { autoFit: boolean },
  ) => {
    const raw = listing.photos?.[0];
    const photo = typeof raw === "string" ? raw : raw?.url ?? null;
    const imgClass = opts.autoFit ? CARD_IMG_AUTO : "h-44";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/listing/${listing.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/listing/${listing.id}`);
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-none transition-colors duration-150 hover:border-zinc-200",
          opts.dense ? "min-w-0 w-full" : "min-h-[280px] w-[280px] max-w-[280px] shrink-0",
        )}
      >
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden rounded-t-2xl border-b border-zinc-100 bg-white",
            imgClass,
          )}
        >
          {photo ? (
            <img src={photo} alt={listing.address} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">No photo</div>
          )}
          <div className="absolute left-2 top-2">
            <ListingStatusBadge status={listing.status} size="sm" />
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col", opts.autoFit ? "px-4 pb-3 pt-2.5" : "px-4 pb-3 pt-3")}>
          <p
            className={cn(
              "font-semibold leading-tight text-[#0E56F5]",
              opts.autoFit ? "text-lg font-bold tracking-tight" : "text-lg",
            )}
          >
            {formatPrice(listing.price)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-neutral-900">{listing.address}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {listing.city}, {listing.state}
          </p>

          <div className={cn("mt-auto border-t border-zinc-100", opts.autoFit ? "pt-2.5" : "pt-2.5")}>
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-500",
                opts.autoFit ? "text-[13px]" : "text-[11px]",
              )}
            >
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" /> {listing.view_count.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" /> {listing.showing_request_count}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 shrink-0 text-[#0E56F5]" />{" "}
                {listing.view_count > 0 ? Math.floor(listing.view_count * 0.1) : 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900">My listings</h3>
          <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">
            Your active AAC listings — views and engagement at a glance.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/agent/listings")}
            className="text-sm font-medium text-[#0E56F5] hover:underline"
          >
            View all →
          </button>
          {!denseGrid ? (
            <>
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className="rounded-full border border-zinc-100 p-1 transition-colors hover:border-zinc-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className="rounded-full border border-zinc-100 p-1 transition-colors hover:border-zinc-200 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {autoFitGrid ? (
        <div className={AUTO_FIT_GRID}>
          {listings.map((listing) => (
            <Fragment key={listing.id}>{renderCard(listing, { autoFit: true })}</Fragment>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 scrollbar-hide"
        >
          {listings.map((listing) => (
            <Fragment key={listing.id}>{renderCard(listing, { autoFit: false })}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
