import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, MapPin, RotateCcw } from "lucide-react";

interface AgentSearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  states: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const AgentSearchFilters = ({
  searchQuery,
  setSearchQuery,
  selectedState,
  setSelectedState,
  states,
  onClearFilters,
  hasActiveFilters,
}: AgentSearchFiltersProps) => {
  return (
    <div className="py-4">
      <div className="max-w-6xl mx-auto px-4">
        {/* Compact Filter Card */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search name, city, brokerage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm border-neutral-200 hover:border-neutral-300 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-neutral-400 hover:text-neutral-600"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* State Select */}
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="w-36 h-9 text-sm border-neutral-200 hover:border-neutral-300">
                <MapPin className="h-3.5 w-3.5 text-neutral-400 mr-2" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-9 px-3 text-xs text-neutral-500 hover:text-neutral-700"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSearchFilters;
