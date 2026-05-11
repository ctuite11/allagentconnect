import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, Bell } from "lucide-react";

interface HotSheetCardProps {
  id: string;
  name: string;
  criteria: any;
  clients: any[];
  lastSentAt?: string | null;
  photos?: string[];
  onView?: (id: string) => void;
  onShare: (id: string) => void;
  onComments: (id: string) => void;
  onAddFriend?: (id: string) => void;
}

export const HotSheetCard = ({
  id,
  name,
  photos = [],
  onView,
}: HotSheetCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (onView) onView(id);
    else navigate(`/hot-sheets/${id}/review`);
  };

  const safePhotos = photos.filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0).slice(0, 4);

  const renderImage = (src: string, index: number) => (
    <img
      key={`${src}-${index}`}
      src={src}
      alt={`${name} listing preview ${index + 1}`}
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );

  const renderPhotoPreview = () => {
    if (safePhotos.length === 0) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
            <Bell className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (safePhotos.length === 1) return renderImage(safePhotos[0], 0);

    if (safePhotos.length === 2) {
      return <div className="grid h-full w-full grid-cols-2 gap-1">{safePhotos.map(renderImage)}</div>;
    }

    return (
      <div className="grid h-full w-full grid-cols-[1.45fr_1fr] gap-1">
        <div className="min-h-0 overflow-hidden">{renderImage(safePhotos[0], 0)}</div>
        <div className="grid min-h-0 grid-rows-3 gap-1 overflow-hidden">
          {safePhotos.slice(1, 4).map(renderImage)}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={handleCardClick}
      className="cursor-pointer overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-neutral-300 hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {renderPhotoPreview()}
      </div>

      <div className="flex flex-col gap-1.5 px-5 pb-1 pt-4">
        <h3 className="min-w-0 truncate text-[14px] font-medium leading-snug text-neutral-800">Hot Sheet Name: {name}</h3>
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary" onClick={handleCardClick}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
};
