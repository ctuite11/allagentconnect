import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingPreview } from "@/components/share/ShareListingsDialog";

type ListingPreviewCardProps = {
  preview: ListingPreview;
  className?: string;
};

export function ListingPreviewCard({ preview, className }: ListingPreviewCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {preview.photoUrl ? (
        <img
          src={preview.photoUrl}
          alt=""
          className="h-16 w-[4.5rem] shrink-0 rounded-md border border-neutral-100 object-cover"
        />
      ) : (
        <div className="flex h-16 w-[4.5rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400">
          <Home className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-neutral-900">{preview.address}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-neutral-600">
          {preview.price ? <span className="font-semibold text-neutral-900">{preview.price}</span> : null}
          {typeof preview.beds === "number" ? <span>{preview.beds} bd</span> : null}
          {typeof preview.baths === "number" ? <span>{preview.baths} ba</span> : null}
          {typeof preview.sqft === "number" ? <span>{preview.sqft.toLocaleString()} sf</span> : null}
        </div>
      </div>
    </div>
  );
}
