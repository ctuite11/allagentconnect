import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export type AgentDirectoryPageSize = 24 | 48 | 96 | "all";

interface AgentDirectoryFiltersProps {
  sortOrder: "a-z" | "z-a";
  setSortOrder: (order: "a-z" | "z-a") => void;
  resultCount: number;
  searchQuery?: string;
  itemLabel?: string;
  /** When true, show inline skeletons instead of counts (matches grid loading). */
  loading?: boolean;
  pageSize?: AgentDirectoryPageSize;
  onPageSizeChange?: (size: AgentDirectoryPageSize) => void;
}

const AgentDirectoryFilters = ({
  sortOrder,
  setSortOrder,
  resultCount,
  searchQuery,
  itemLabel = "Agents",
  loading = false,
  pageSize,
  onPageSizeChange,
}: AgentDirectoryFiltersProps) => {
  if (loading) {
    return (
      <div className="border-b border-neutral-200/90 bg-white py-3 md:py-4">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between md:px-6">
          <Skeleton className="h-4 w-24 rounded bg-neutral-100" />
          <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-2">
            {onPageSizeChange ? (
              <Skeleton className="h-8 w-full rounded-md bg-neutral-100 min-[520px]:w-[9rem]" />
            ) : null}
            <Skeleton className="h-8 w-full rounded-md bg-neutral-100 min-[520px]:w-[11rem]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-200/90 bg-white py-3 md:py-4">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between md:px-6">
        <p className="text-[13px] font-normal text-neutral-500">
          {searchQuery ? (
            <>
              Results for &ldquo;{searchQuery}&rdquo;
              <span className="mx-1.5 text-neutral-300">·</span>
            </>
          ) : null}
          <span className="font-medium text-neutral-900">{resultCount.toLocaleString()}</span>{" "}
          {resultCount === 1 ? itemLabel.replace(/s$/i, "") : itemLabel}
        </p>

        <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-2">
          {onPageSizeChange && pageSize !== undefined ? (
            <Select
              value={String(pageSize)}
              onValueChange={(value) =>
                onPageSizeChange(value === "all" ? "all" : (Number(value) as AgentDirectoryPageSize))
              }
            >
              <SelectTrigger className="h-8 w-full rounded-lg border-neutral-200/90 bg-white text-xs font-medium text-neutral-900 shadow-none min-[520px]:w-[9rem] focus-visible:ring-2 focus-visible:ring-neutral-300/50 focus-visible:ring-offset-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">Show 24</SelectItem>
                <SelectItem value="48">Show 48</SelectItem>
                <SelectItem value="96">Show 96</SelectItem>
                <SelectItem value="all">Show all</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
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
    </div>
  );
};

export default AgentDirectoryFilters;
