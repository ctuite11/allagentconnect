import { Home } from "lucide-react";

interface BuyerCollectionCardProps {
  clientId: string;
  clientName: string;
  hotSheetCount: number;
  photos: string[];
  agentInitials: string;
  clientInitials: string;
  collaborators: string[];
  onClick: () => void;
}

function InitialCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div
      className={`h-8 w-8 rounded-full bg-zinc-200 text-zinc-600 text-xs font-medium flex items-center justify-center shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}

function PhotoCell({ src }: { src?: string }) {
  if (src) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
      <Home className="h-5 w-5 text-zinc-300" />
    </div>
  );
}

export function BuyerCollectionCard({
  clientName,
  hotSheetCount,
  photos,
  agentInitials,
  clientInitials,
  collaborators,
  onClick,
}: BuyerCollectionCardProps) {
  const p = [photos[0], photos[1], photos[2], photos[3]];

  const extraCount = Math.max(0, collaborators.length - 2);
  const visibleCollabs = collaborators.slice(0, 2);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-zinc-200 rounded-2xl shadow-sm cursor-pointer will-change-transform transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] focus-within:shadow-lg overflow-hidden"
    >
      {/* 2x2 Image Mosaic */}
      <div className="aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px bg-zinc-200">
        <PhotoCell src={p[0]} />
        <PhotoCell src={p[1]} />
        <PhotoCell src={p[2]} />
        <PhotoCell src={p[3]} />
      </div>

      {/* Card Body */}
      <div className="px-4 pt-3 pb-4">
        <h3 className="text-lg font-semibold text-zinc-900 truncate">{clientName}</h3>
        <p className="text-sm text-zinc-500 mt-0.5">
          {hotSheetCount} hot sheet{hotSheetCount !== 1 ? "s" : ""}
        </p>

        {/* Participant Row */}
        <div className="flex items-center gap-1.5 mt-3">
          <InitialCircle initials={agentInitials} className="bg-zinc-800 text-white" />
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <InitialCircle initials={clientInitials} />
          {visibleCollabs.map((c, i) => (
            <InitialCircle key={i} initials={c} />
          ))}
          {extraCount > 0 && (
            <div className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-500 text-xs font-medium flex items-center justify-center shrink-0">
              +{extraCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
