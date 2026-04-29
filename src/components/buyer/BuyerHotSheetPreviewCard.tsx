import type { KeyboardEvent } from "react";
import { Eye } from "lucide-react";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import AACMonogram from "@/components/ui/AACMonogram";
import {
  buyerDashboardHotFavTileBody,
  buyerDashboardHotFavTile,
  buyerDashboardHotSheetCollageGrid,
  buyerDashboardHotSheetMediaWrap,
  buyerPreviewCardInteractive,
} from "@/lib/buyerUi";

/** Hot Sheets listing page — 2×2 mosaic: tall left column + stacked right cells (optional empty quadrant). */
function HotSheetPageMosaic({ photoUrls }: { photoUrls: string[] }) {
  const [a, b, c] = photoUrls.filter(Boolean).slice(0, 3);

  if (!a) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-[#0E56F5]" aria-hidden>
        <AACMonogram className="h-8 w-8" size={32} />
      </div>
    );
  }

  const cellWrap = "relative min-h-0 min-w-0 overflow-hidden bg-white";

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white [grid-template-columns:minmax(0,3fr)_minmax(0,2fr)]">
      <div className={`${cellWrap} row-span-2`}>
        <DashboardListingImage
          photoUrl={a}
          alt=""
          imageClassName="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className={cellWrap}>
        {b ? (
          <DashboardListingImage
            photoUrl={b}
            alt=""
            imageClassName="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className={cellWrap}>
        {c ? (
          <DashboardListingImage
            photoUrl={c}
            alt=""
            imageClassName="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
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
      <div className="flex h-full w-full items-center justify-center bg-white text-[#0E56F5]" aria-hidden>
        <AACMonogram className="h-7 w-7" size={28} />
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
            imageClassName="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export interface BuyerHotSheetPreviewCardProps {
  photoUrls: string[];
  title: string;
  /** Second line — e.g. “12 matches”; dashboard uses match count text. Omitted when `variant` is hotSheetsPage. */
  subtitle?: string;
  /**
   * `dashboard` — default strip tile (two-line title + matches).
   * `hotSheetsPage` — buyer Hot Sheets route: labeled name + Eye/View footer (whole card still primary action).
   */
  variant?: "dashboard" | "hotSheetsPage";
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Hot Sheet collage tile — `dashboard` matches `ClientDashboard` strip.
 * `hotSheetsPage` adds labeled title + Eye/View affordance for `/client/hot-sheets`; whole-card click unchanged.
 */
export function BuyerHotSheetPreviewCard({
  photoUrls,
  title,
  subtitle = "",
  variant = "dashboard",
  onClick,
  onKeyDown,
}: BuyerHotSheetPreviewCardProps) {
  const isHotSheetsPage = variant === "hotSheetsPage";
  const rootClass = isHotSheetsPage
    ? `${buyerPreviewCardInteractive} flex min-h-[19rem] flex-col md:min-h-[20rem]`
    : buyerDashboardHotFavTile;
  const mediaWrapClass = isHotSheetsPage
    ? "relative h-52 shrink-0 w-full overflow-hidden rounded-t-2xl bg-white md:h-56"
    : buyerDashboardHotSheetMediaWrap;

  return (
    <article
      role="button"
      tabIndex={0}
      className={rootClass}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className={mediaWrapClass}>
        {isHotSheetsPage ? (
          <HotSheetPageMosaic photoUrls={photoUrls} />
        ) : (
          <HotSheetDashboardCollage photoUrls={photoUrls} />
        )}
      </div>
      {isHotSheetsPage ? (
        <div className="flex min-h-[5.5rem] flex-1 flex-col bg-white px-4 pb-5 pt-3 text-left">
          <p className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900">
            <span className="font-semibold">Hot Sheet Name: </span>
            <span>{title}</span>
          </p>
          <div className="mt-auto flex justify-end pt-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0E56F5] pointer-events-none" aria-hidden>
              <Eye className="h-4 w-4 shrink-0" strokeWidth={2} />
              View
            </span>
          </div>
        </div>
      ) : (
        <div className={`${buyerDashboardHotFavTileBody} flex-1`}>
          <p className="line-clamp-1 text-[16px] font-medium leading-snug tracking-tight text-neutral-900">{title}</p>
          {subtitle ? <p className="text-[12px] font-normal leading-tight text-gray-500">{subtitle}</p> : null}
        </div>
      )}
    </article>
  );
}
