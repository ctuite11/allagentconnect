import { useState } from "react";
import { Eye } from "lucide-react";
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
 * Agent Hot Sheets list (`/agent/hot-sheets`) — 2×2 photo mosaic + title, count, single “View” affordance.
 * Empty photo slots are plain white cells (no house/monogram). Whole card is clickable.
 */
export function BuyerCollectionCard({
  clientName,
  hotSheetCount,
  photos,
  onClick,
}: BuyerCollectionCardProps) {
  const p = [photos[0], photos[1], photos[2], photos[3]];

  return (
    <article
      role="button"
      tabIndex={0}
      className={`${buyerCollectionCardRoot} flex min-h-[19rem] flex-col outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 md:min-h-[20rem]`}
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
          <h3 className="truncate text-lg font-semibold text-zinc-900">{clientName}</h3>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {hotSheetCount} hot sheet{hotSheetCount !== 1 ? "s" : ""}
            </p>
            <div className="pointer-events-none flex items-center gap-1 text-sm font-medium text-[#0E56F5]">
              <Eye className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>View</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
