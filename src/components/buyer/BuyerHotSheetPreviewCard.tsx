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

function HotSheetPreviewCollage({ photoUrls }: { photoUrls: string[] }) {
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
    ? `${buyerPreviewCardInteractive} flex min-h-[16rem] flex-col`
    : buyerDashboardHotFavTile;

  return (
    <article
      role="button"
      tabIndex={0}
      className={rootClass}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className={buyerDashboardHotSheetMediaWrap}>
        <HotSheetPreviewCollage photoUrls={photoUrls} />
      </div>
      {isHotSheetsPage ? (
        <div className="flex flex-1 flex-col justify-between gap-2 bg-white px-3 pb-3 pt-3 text-left">
          <p className="text-sm leading-snug text-neutral-900">
            <span className="font-semibold">Hot Sheet Name: </span>
            <span className="font-semibold">{title}</span>
          </p>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0E56F5] pointer-events-none" aria-hidden>
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
