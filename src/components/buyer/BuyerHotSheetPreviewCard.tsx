import type { KeyboardEvent } from "react";
import { DashboardListingImage } from "@/components/buyer/DashboardListingImage";
import AACMonogram from "@/components/ui/AACMonogram";
import {
  buyerDashboardHotFavTileBody,
  buyerDashboardHotFavTile,
  buyerDashboardHotSheetCollageGrid,
  buyerDashboardHotSheetMediaWrap,
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
  /** Second line — e.g. “12 matches”; dashboard uses match count text. */
  subtitle: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * The Hot Sheet preview tile from Buyer Dashboard (“Hot Sheets” strip): collage + footer, nothing else.
 * Do not restyle — keep in sync with `ClientDashboard` markup.
 */
export function BuyerHotSheetPreviewCard({
  photoUrls,
  title,
  subtitle,
  onClick,
  onKeyDown,
}: BuyerHotSheetPreviewCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      className={buyerDashboardHotFavTile}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className={buyerDashboardHotSheetMediaWrap}>
        <HotSheetPreviewCollage photoUrls={photoUrls} />
      </div>
      <div className={`${buyerDashboardHotFavTileBody} flex-1`}>
        <p className="line-clamp-1 text-[14px] font-medium leading-snug tracking-tight text-neutral-800">{title}</p>
        <p className="text-[12px] font-normal leading-tight text-gray-500">{subtitle}</p>
      </div>
    </article>
  );
}
