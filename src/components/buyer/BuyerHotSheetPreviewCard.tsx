import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Eye, Heart, Trash2 } from "lucide-react";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import {
  buyerCollectionCardRoot,
  buyerDashboardHotFavTile,
  buyerDashboardHotFavTileBody,
  buyerDashboardHotSheetCollageGrid,
  buyerDashboardHotSheetMediaWrap,
  buyerImageMosaicCell,
  buyerImageMosaicGrid,
} from "@/lib/buyerUi";

const mosaicImg = "absolute inset-0 h-full w-full object-cover";

function HotSheetPagePhotoCell({ src }: { src?: string }) {
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

function HotSheetDashboardCollage({ photoUrls }: { photoUrls: string[] }) {
  const visiblePhotos = photoUrls.filter(Boolean).slice(0, 3);
  const collagePhotos = visiblePhotos.length
    ? Array.from({ length: 3 }, (_, index) => visiblePhotos[index % visiblePhotos.length])
    : [];

  if (!collagePhotos.length) {
    return (
      <div className={buyerDashboardHotSheetCollageGrid}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${index === 0 ? "row-span-2" : ""} relative min-h-0 min-w-0 bg-white`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={buyerDashboardHotSheetCollageGrid}>
      {collagePhotos.map((photoUrl, index) => (
        <div
          key={`${photoUrl}-${index}`}
          className={`${index === 0 ? "row-span-2" : ""} relative min-h-0 min-w-0 overflow-hidden bg-white`}
        >
          <DashboardListingImage
            photoUrl={photoUrl}
            alt=""
            imageClassName={mosaicImg}
            emptyFallback="neutral"
          />
        </div>
      ))}
    </div>
  );
}

export interface BuyerHotSheetPreviewCardProps {
  photoUrls: string[];
  title: string;
  /** Second line — e.g. “12 matches”; dashboard uses match count text. */
  subtitle?: string;
  /**
   * `dashboard` — default strip tile (two-line title + matches).
   * `hotSheetsPage` — buyer Hot Sheets index: agent-style mosaic + View/Favorites footer.
   */
  variant?: "dashboard" | "hotSheetsPage";
  /** Match count for `hotSheetsPage` footer line. */
  matchCount?: number;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  /** Buyer Hot Sheets index — opens Favorites (stops card navigation). */
  onFavoritesClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Buyer self-service — compact delete control (stops card navigation). */
  onDeleteClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Hot Sheet collage tile — `dashboard` matches `ClientDashboard` strip.
 * `hotSheetsPage` matches agent `BuyerCollectionCard` sizing and chrome.
 */
export function BuyerHotSheetPreviewCard({
  photoUrls,
  title,
  subtitle = "",
  variant = "dashboard",
  matchCount = 0,
  onClick,
  onKeyDown,
  onFavoritesClick,
  onDeleteClick,
}: BuyerHotSheetPreviewCardProps) {
  const isHotSheetsPage = variant === "hotSheetsPage";

  if (isHotSheetsPage) {
    const p = [photoUrls[0], photoUrls[1], photoUrls[2], photoUrls[3]];
    const matchLabel = `${matchCount} ${matchCount === 1 ? "match" : "matches"}`;

    return (
      <div className="relative h-full min-h-0">
        {onDeleteClick ? (
          <button
            type="button"
            aria-label="Delete hot sheet"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(e);
            }}
            className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-red-200/90 bg-white text-red-600 shadow-sm transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        ) : null}
        <article
          role="button"
          tabIndex={0}
          className={`${buyerCollectionCardRoot} flex min-h-[19rem] flex-col outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 md:min-h-[20rem]`}
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          <div className={buyerImageMosaicGrid}>
            <HotSheetPagePhotoCell src={p[0]} />
            <HotSheetPagePhotoCell src={p[1]} />
            <HotSheetPagePhotoCell src={p[2]} />
            <HotSheetPagePhotoCell src={p[3]} />
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col bg-white px-4 pb-4 pt-3 text-left">
            <div className="min-w-0 shrink-0">
              <h3 className="truncate text-lg font-semibold text-neutral-900">{title}</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm text-neutral-600 tabular-nums">{matchLabel}</p>
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
                        onFavoritesClick(e);
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

  return (
    <div className="relative h-full min-h-0">
      {onDeleteClick ? (
        <button
          type="button"
          aria-label="Delete hot sheet"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(e);
          }}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-red-200/90 bg-white text-red-600 shadow-sm transition-colors hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      ) : null}
      <article
        role="button"
        tabIndex={0}
        className={buyerDashboardHotFavTile}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <div className={buyerDashboardHotSheetMediaWrap}>
          <HotSheetDashboardCollage photoUrls={photoUrls} />
        </div>
        <div className={`${buyerDashboardHotFavTileBody} flex-1`}>
          <p className="line-clamp-1 text-[16px] font-medium leading-snug tracking-tight text-neutral-900">{title}</p>
          {subtitle ? <p className="text-[12px] font-normal leading-tight text-neutral-500 tabular-nums">{subtitle}</p> : null}
        </div>
      </article>
    </div>
  );
}
