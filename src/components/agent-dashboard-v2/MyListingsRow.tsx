import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Share2, Heart } from "lucide-react";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface MyListingsRowProps {
  listings: SuccessHubSummary["listings"];
}

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toLocaleString()}`;
}

export function MyListingsRow({ listings }: MyListingsRowProps) {
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
    const amount = 320;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-[15px] font-semibold text-neutral-900">My listings</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/listings")}
            type="button"
            className="text-sm font-medium text-[#0E56F5] hover:underline"
          >
            View all →
          </button>
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
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
      >
        {listings.map((listing) => {
          const raw = listing.photos?.[0];
          const photo = typeof raw === "string" ? raw : raw?.url ?? null;
          return (
            <div
              key={listing.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/listing/${listing.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/listing/${listing.id}`);
                }
              }}
              className="min-w-[248px] max-w-[268px] flex-shrink-0 cursor-pointer rounded-2xl border border-zinc-100 bg-white shadow-none transition-colors duration-150 hover:border-zinc-200"
            >
              {/* Stats bar */}
              <div className="flex items-center px-3 pt-3 pb-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {listing.view_count.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3.5 w-3.5" /> {listing.showing_request_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {listing.view_count > 0 ? Math.floor(listing.view_count * 0.1) : 0}
                  </span>
                </div>
              </div>

              {/* Photo */}
              <div className="relative mx-3 aspect-[4/3] overflow-hidden rounded-xl border border-zinc-100 bg-white">
                {photo ? (
                  <img
                    src={photo}
                    alt={listing.address}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No photo
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <ListingStatusBadge status={listing.status} size="sm" />
                </div>
              </div>

              {/* Details */}
              <div className="px-3 pt-2 pb-3">
                <p className="text-sm font-medium text-foreground truncate">
                  {listing.address}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {listing.city}, {listing.state}
                </p>
                <p className="mt-1 text-base font-bold text-[#0E56F5]">
                  {formatPrice(listing.price)}
                </p>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
