import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
    navigate(`/hot-sheets/${id}/review`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="cursor-pointer rounded-[22px] border border-zinc-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold leading-tight tracking-tight text-zinc-950">{name}</h3>
          <p className="mt-1 truncate text-sm text-zinc-500">{location}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-100" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem] p-1">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-gray-50 focus:bg-gray-50 focus:text-red-600 data-[highlighted]:bg-gray-50 data-[highlighted]:text-red-600"
            >
              <Trash2 className="h-4 w-4 shrink-0 text-red-600" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {chips.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        <p className="min-w-0 truncate text-xs text-zinc-500">
          {lastSentAt ? `Last updated ${formatDistanceToNow(new Date(lastSentAt), { addSuffix: true })}` : "Last updated just now"}
        </p>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" className="h-9 rounded-full px-4 text-sm font-semibold" onClick={() => navigate(`/hot-sheets/${id}/review`)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-full border-zinc-200 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50" onClick={() => onEdit(id)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
};
