import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Share2, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface MyListingsRowProps {
  listings: SuccessHubSummary["listings"];
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500 text-white",
  pending: "bg-yellow-500 text-white",
  coming_soon: "bg-primary text-primary-foreground",
  off_market: "bg-zinc-400 text-white",
};

function statusLabel(s: string) {
  if (s === "coming_soon") return "Coming Soon";
  if (s === "off_market") return "Off Market";
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">My Listings</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/listings")}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all →
          </button>
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-1 rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-1 rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
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
          const photo = listing.photos?.[0] ?? null;
          return (
            <div
              key={listing.id}
              onClick={() => navigate(`/listing/${listing.id}`)}
              className="min-w-[240px] max-w-[260px] flex-shrink-0 rounded-xl border border-border bg-card cursor-pointer hover:shadow-lg hover:-translate-y-[1px] transition-all duration-200"
            >
              {/* Stats bar */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {listing.view_count.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3 w-3" /> {listing.showing_request_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {listing.view_count > 0 ? Math.floor(listing.view_count * 0.1) : 0}
                  </span>
                </div>
                <Badge
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    STATUS_COLORS[listing.status] ?? "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {statusLabel(listing.status)}
                </Badge>
              </div>

              {/* Photo */}
              <div className="relative mx-3 rounded-lg overflow-hidden aspect-[4/3] bg-muted">
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
              </div>

              {/* Details */}
              <div className="px-3 pt-2 pb-3">
                <p className="text-sm font-medium text-foreground truncate">
                  {listing.address}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {listing.city}, {listing.state}
                </p>
                <p className="text-base font-bold text-primary mt-1">
                  {formatPrice(listing.price)}
                </p>
              </div>
            </div>
          );
        })}

        {listings.length === 0 && (
          <div className="w-full py-12 text-center text-muted-foreground text-sm">
            No active listings yet.
          </div>
        )}
      </div>
    </div>
  );
}
