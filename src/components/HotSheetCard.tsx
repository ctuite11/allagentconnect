import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, Home, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { humanizeSnakeCase } from "@/lib/format";

interface HotSheetCardProps {
  id: string;
  name: string;
  criteria: any;
  clients: any[];
  lastSentAt?: string | null;
  photos?: string[];
  onView?: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onComments: (id: string) => void;
  onDelete: (id: string) => void;
  onAddFriend?: (id: string) => void;
}

export const HotSheetCard = ({
  id,
  name,
  criteria,
  lastSentAt,
  photos = [],
  onView,
  onEdit,
  onDelete,
}: HotSheetCardProps) => {
  const navigate = useNavigate();
  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  const formatCurrencyShort = (value: unknown) => {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    return `$${Math.round(amount / 1_000)}k`;
  };

  const locationParts = asStringArray(criteria?.cities).length
    ? asStringArray(criteria?.cities)
    : asStringArray(criteria?.towns).length
      ? asStringArray(criteria?.towns)
      : asStringArray(criteria?.counties);
  const location = locationParts.length
    ? locationParts.slice(0, 2).join(", ") + (locationParts.length > 2 ? ` +${locationParts.length - 2}` : "")
    : "Saved search area";

  const minPrice = formatCurrencyShort(criteria?.minPrice);
  const maxPrice = formatCurrencyShort(criteria?.maxPrice);
  const propertyTypes = asStringArray(criteria?.propertyTypes);
  const statuses = asStringArray(criteria?.statuses);
  const chips = [
    minPrice || maxPrice ? (minPrice && maxPrice ? `${minPrice}–${maxPrice}` : minPrice ? `${minPrice}+` : `Under ${maxPrice}`) : null,
    criteria?.bedrooms ? `${String(criteria.bedrooms)}+ beds` : null,
    criteria?.bathrooms ? `${String(criteria.bathrooms)}+ baths` : null,
    propertyTypes.length ? propertyTypes.slice(0, 2).map(humanizeSnakeCase).join(", ") : null,
    statuses.length ? statuses.slice(0, 2).map(humanizeSnakeCase).join(", ") : null,
  ].filter(Boolean) as string[];

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
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );

  const renderPhotoPreview = () => {
    if (safePhotos.length === 0) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
            <Home className="h-6 w-6 text-muted-foreground" />
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
      className="group cursor-pointer overflow-hidden rounded-[22px] border border-aac-card-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-aac-card-borderHover hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {renderPhotoPreview()}
      </div>

      <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">{name}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{location}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem] p-1">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-medium text-destructive hover:bg-muted focus:bg-muted focus:text-destructive data-[highlighted]:bg-muted data-[highlighted]:text-destructive"
            >
              <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {chips.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="inline-flex items-center rounded-full border border-aac-card-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {lastSentAt ? `Last updated ${formatDistanceToNow(new Date(lastSentAt), { addSuffix: true })}` : "Last updated just now"}
        </p>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" className="h-9 rounded-full px-4 text-sm font-semibold" onClick={() => handleCardClick()}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-full border-aac-card-border px-4 text-sm font-semibold text-foreground hover:bg-muted" onClick={() => onEdit(id)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};
