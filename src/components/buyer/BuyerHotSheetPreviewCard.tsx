import type { KeyboardEvent } from "react";
import { Eye } from "lucide-react";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import {
  buyerDashboardHotFavTileBody,
  buyerDashboardHotFavTile,
  buyerDashboardHotSheetCollageGrid,
  buyerDashboardHotSheetMediaWrap,
  buyerPreviewCardInteractive,
} from "@/lib/buyerUi";

const mosaicCell = "relative min-h-0 min-w-0 overflow-hidden bg-white";
const mosaicImg = "absolute inset-0 h-full w-full object-cover";

/** Hot Sheets listing page — 2×2 mosaic: tall left column + stacked right cells (empty slots stay white). */
function HotSheetPageMosaic({ photoUrls }: { photoUrls: string[] }) {
  const [a, b, c] = photoUrls.filter(Boolean).slice(0, 3);

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px] bg-white [grid-template-columns:minmax(0,3fr)_minmax(0,2fr)]">
      <div className={`${mosaicCell} row-span-2`}>
        {a ? (
          <DashboardListingImage photoUrl={a} alt="" imageClassName={mosaicImg} emptyFallback="neutral" />
        ) : null}
      </div>
      <div className={mosaicCell}>
        {b ? <DashboardListingImage photoUrl={b} alt="" imageClassName={mosaicImg} emptyFallback="neutral" /> : null}
      </div>
      <div className={mosaicCell}>
        {c ? <DashboardListingImage photoUrl={c} alt="" imageClassName={mosaicImg} emptyFallback="neutral" /> : null}
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
  /** Shown under the hot sheet name on `hotSheetsPage` only (e.g. buyer’s linked agent). */
  linkedAgentName?: string | null;
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
  linkedAgentName,
  onClick,
  onKeyDown,
}: BuyerHotSheetPreviewCardProps) {
  const agentAttribution =
    typeof linkedAgentName === "string" ? linkedAgentName.trim() : "";

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
        <div className="flex min-h-0 w-full flex-1 flex-col bg-white px-4 pb-4 pt-3 text-left">
          <div className="min-w-0 shrink-0">
            <p className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900">
              <span className="font-semibold">Hot Sheet Name: </span>
              <span>{title}</span>
            </p>
            {agentAttribution ? (
              <p className="mt-1 text-left text-xs text-zinc-500">Your agent: {agentAttribution}</p>
            ) : null}
          </div>
          <div className="mt-auto flex w-full shrink-0 items-center justify-end pt-3">
            <span className="pointer-events-none inline-flex items-center gap-1.5 text-sm font-medium text-[#0E56F5]">
              <Eye className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
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
