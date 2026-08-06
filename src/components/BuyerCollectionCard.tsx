import { useState, type MouseEvent } from "react";
import { BellOff, BellRing, Eye, Heart, Pencil } from "lucide-react";
import {
  buyerCollectionCardRoot,
  buyerImageMosaicCell,
  buyerImageMosaicGrid,
} from "@/lib/buyerUi";

interface BuyerCollectionCardProps {
  clientName: string;
  hotSheetCount: number;
  photos: string[];
  onClick: () => void;
  /** When set, shows a Favorites control (CRM buyer favorites) next to View. */
  onFavoritesClick?: () => void;
  /** When set, shows an Edit button overlay on the card. */
  onEditClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Metadata row label. Default: Buyer Name */
  nameLabel?: string;
  /** When false, show the name as stored (e.g. hot sheet titles). Default: title-case like buyer names. */
  titleCaseName?: boolean;
  /** Alert state of the underlying hot sheet(s). Omit to hide alert status entirely. */
  isActive?: boolean;
  /** Ownership context, e.g. "Personal Hot Sheet" or "Client: Natay Lopachak". */
  ownerLabel?: string;
  /** When set, renders a Pause/Resume alerts control. */
  onToggleActive?: (next: boolean) => void;
  /** Disables the Pause/Resume control while a toggle is in flight. */
  toggleBusy?: boolean;
}

function titleCaseToken(term: string): string {
  const t = term.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Title-case each name part so `brody tuite` → `Brody Tuite`. */
function formatBuyerDisplayName(raw: string): string {
  const formatted = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
  return formatted || "Unnamed Client";
}

function PhotoCell({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={buyerImageMosaicCell} aria-hidden />;
  }
  return (
    <div className={buyerImageMosaicCell}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Agent Hot Sheets list (`/agent/hot-sheets`) — 2×2 photo mosaic + title, count, View + optional Favorites.
 * Empty photo slots are plain white cells (no house/monogram). Whole card is clickable; Favorites stops propagation.
 */
export function BuyerCollectionCard({
  clientName,
  hotSheetCount,
  photos,
  onClick,
  onFavoritesClick,
  onEditClick,
  nameLabel = "Buyer Name",
  titleCaseName = true,
  isActive,
  ownerLabel,
  onToggleActive,
  toggleBusy = false,
}: BuyerCollectionCardProps) {
  const p = [photos[0], photos[1], photos[2], photos[3]];
  const displayName = titleCaseName
    ? formatBuyerDisplayName(clientName)
    : clientName.trim() || "Untitled hot sheet";

  return (
    <div className="relative h-full min-h-0">
      {onEditClick ? (
        <button
          type="button"
          aria-label="Edit hot sheet"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(e);
          }}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white shadow-sm transition-colors hover:bg-neutral-50"
        >
          <Pencil className="h-3.5 w-3.5 text-neutral-700" aria-hidden strokeWidth={2} />
        </button>
      ) : null}
      <article
      role="button"
      tabIndex={0}
      className={`${buyerCollectionCardRoot} flex min-h-[19rem] flex-col outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 md:min-h-[20rem]`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className={buyerImageMosaicGrid}>
        <PhotoCell src={p[0]} />
        <PhotoCell src={p[1]} />
        <PhotoCell src={p[2]} />
        <PhotoCell src={p[3]} />
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col bg-white px-4 pb-4 pt-3 text-left">
        <div className="min-w-0 shrink-0">
          {ownerLabel ? (
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {ownerLabel}
            </p>
          ) : null}
          <p className="truncate text-[13px] leading-snug" title={displayName}>
            <span className="text-neutral-500">{nameLabel}: </span>
            <span className="font-medium text-neutral-800">{displayName}</span>
          </p>
          {typeof isActive === "boolean" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <BellRing className="h-3 w-3" aria-hidden />
                  Alerts on
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300">
                  <BellOff className="h-3 w-3" aria-hidden />
                  Paused — alerts are not being sent
                </span>
              )}
              {onToggleActive ? (
                <button
                  type="button"
                  disabled={toggleBusy}
                  className="pointer-events-auto rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActive(!isActive);
                  }}
                >
                  {isActive ? "Pause alerts" : "Resume alerts"}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm text-neutral-600">
              {hotSheetCount} hot sheet{hotSheetCount !== 1 ? "s" : ""}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <div className="pointer-events-none flex items-center gap-1 text-sm font-medium text-[#0E56F5]">
                <Eye className="h-4 w-4 shrink-0 text-[#0E56F5]" strokeWidth={2} aria-hidden />
                <span>View</span>
              </div>
              {onFavoritesClick ? (
                <button
                  type="button"
                  className="pointer-events-auto inline-flex items-center gap-1 text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavoritesClick();
                  }}
                >
                  <Heart
                    className="h-4 w-4 shrink-0 fill-[#FF2D55] text-[#FF2D55] stroke-[#FF2D55]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>Favorites</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      </article>
    </div>
  );
}
