import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LISTING_DEFAULT_SORT_COLUMN } from "@/lib/listingRecencySort";

export type AgentListingSortValue = "date_new" | "date_old" | "price_high" | "price_low";

export function sortColumnDirectionFromSelectValue(value: AgentListingSortValue): [string, "asc" | "desc"] {
  const colDir: Record<AgentListingSortValue, [string, "asc" | "desc"]> = {
    date_new: [LISTING_DEFAULT_SORT_COLUMN, "desc"],
    date_old: [LISTING_DEFAULT_SORT_COLUMN, "asc"],
    price_high: ["price", "desc"],
    price_low: ["price", "asc"],
  };
  return colDir[value] ?? [LISTING_DEFAULT_SORT_COLUMN, "desc"];
}

export function selectValueFromSortColumnDirection(
  sortColumn: string,
  sortDirection: "asc" | "desc",
): AgentListingSortValue {
  const key = `${sortColumn}_${sortDirection}` as const;
  const map: Record<string, AgentListingSortValue> = {
    created_at_desc: "date_new",
    created_at_asc: "date_old",
    list_date_desc: "date_new",
    list_date_asc: "date_old",
    price_desc: "price_high",
    price_asc: "price_low",
  };
  return map[key] ?? "date_new";
}

type AgentListingSortSelectProps = {
  value: AgentListingSortValue;
  onValueChange: (value: AgentListingSortValue) => void;
  triggerClassName?: string;
  className?: string;
};

export function AgentListingSortSelect({
  value,
  onValueChange,
  triggerClassName,
  className,
}: AgentListingSortSelectProps) {
  return (
    <div className={cn("min-w-0 shrink-0 max-w-[8.5rem] min-[520px]:max-w-[11rem]", className)}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={
            triggerClassName ??
            "h-8 rounded-md border-neutral-200/90 bg-white px-3 text-[12px] font-medium text-neutral-900 shadow-none focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2"
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-lg border border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <SelectItem value="date_new">Date (New)</SelectItem>
          <SelectItem value="date_old">Date (Old)</SelectItem>
          <SelectItem value="price_high">Price (High)</SelectItem>
          <SelectItem value="price_low">Price (Low)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
