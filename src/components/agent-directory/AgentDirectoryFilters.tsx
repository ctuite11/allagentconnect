import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentDirectoryFiltersProps {
  sortOrder: "a-z" | "z-a";
  setSortOrder: (order: "a-z" | "z-a") => void;
  resultCount: number;
  searchQuery?: string;
}

const AgentDirectoryFilters = ({
  sortOrder,
  setSortOrder,
  resultCount,
  searchQuery,
}: AgentDirectoryFiltersProps) => {
  return (
    <div className="border-b border-zinc-200 py-6">
      <div className="mx-auto max-w-[1200px] px-6 flex items-center justify-between">
        {/* Left: Result Count */}
        <div className="text-[15px] font-medium text-zinc-900">
          {resultCount} Agents Found{searchQuery ? ` for "${searchQuery}"` : ""}
        </div>

        {/* Right: Sort Dropdown Only */}
        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a")}>
          <SelectTrigger className="w-48 h-10 border-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a-z">Agent Last Name A-Z</SelectItem>
            <SelectItem value="z-a">Agent Last Name Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default AgentDirectoryFilters;
