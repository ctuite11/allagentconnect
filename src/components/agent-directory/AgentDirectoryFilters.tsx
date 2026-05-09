import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentDirectoryFiltersProps {
  sortOrder: "a-z" | "z-a";
  setSortOrder: (order: "a-z" | "z-a") => void;
  resultCount: number;
  searchQuery?: string;
  itemLabel?: string;
  /** When true, show inline skeletons instead of counts (matches grid loading). */
  loading?: boolean;
}

const AgentDirectoryFilters = ({
  sortOrder,
  setSortOrder,
  resultCount,
  searchQuery,
  itemLabel = "Agents",
  loading = false,
}: AgentDirectoryFiltersProps) => {
  if (loading) {
    return (
      <div className="border-b border-neutral-200/90 bg-white py-3 md:py-4">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between md:px-6">
          <Skeleton className="h-5 w-40 rounded-md bg-neutral-100" />
          <Skeleton className="h-8 w-full rounded-md bg-neutral-100 min-[520px]:w-[11rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-200/90 bg-white py-3 md:py-4">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between md:px-6">
        <p className="text-[13px] font-medium tabular-nums text-neutral-900">
          {resultCount.toLocaleString()}{" "}
          {resultCount === 1
            ? itemLabel.replace(/s$/i, "").toLowerCase()
            : itemLabel.toLowerCase()}{" "}
          found
          {searchQuery ? (
            <span className="font-normal text-neutral-500">
              {" "}
              for &ldquo;{searchQuery}&rdquo;
            </span>
          ) : null}
        </p>

        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a")}>
          <SelectTrigger className="h-8 w-full rounded-lg border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none min-[520px]:w-[11rem] focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a-z">Name A–Z</SelectItem>
            <SelectItem value="z-a">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default AgentDirectoryFilters;
