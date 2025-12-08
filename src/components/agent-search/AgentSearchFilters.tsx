import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, MapPin, ChevronDown, Filter } from "lucide-react";

interface County {
  id: string;
  name: string;
  state: string;
}

interface AgentSearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCounties: string[];
  toggleCounty: (countyId: string) => void;
  counties: County[];
  showBuyerIncentivesOnly: boolean;
  setShowBuyerIncentivesOnly: (value: boolean) => void;
  showListingAgentsOnly: boolean;
  setShowListingAgentsOnly: (value: boolean) => void;
  sortOrder: "a-z" | "z-a" | "listings";
  setSortOrder: (order: "a-z" | "z-a" | "listings") => void;
  onClearFilters: () => void;
  resultCount: number;
}

const AgentSearchFilters = ({
  searchQuery,
  setSearchQuery,
  selectedCounties,
  toggleCounty,
  counties,
  showBuyerIncentivesOnly,
  setShowBuyerIncentivesOnly,
  showListingAgentsOnly,
  setShowListingAgentsOnly,
  sortOrder,
  setSortOrder,
  onClearFilters,
  resultCount,
}: AgentSearchFiltersProps) => {
  const hasActiveFilters = searchQuery || selectedCounties.length > 0 || showBuyerIncentivesOnly || showListingAgentsOnly;

  return (
    <div className="sticky top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search name, company, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Service Areas Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <MapPin className="h-4 w-4" />
                Service Areas
                {selectedCounties.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {selectedCounties.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Filter by County</p>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {counties.map((county) => (
                    <div
                      key={county.id}
                      className="flex items-center space-x-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleCounty(county.id)}
                    >
                      <Checkbox
                        id={`filter-county-${county.id}`}
                        checked={selectedCounties.includes(county.id)}
                        onCheckedChange={() => toggleCounty(county.id)}
                      />
                      <Label
                        htmlFor={`filter-county-${county.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {county.name}, {county.state}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedCounties.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => selectedCounties.forEach(id => toggleCounty(id))}
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Quick Toggles */}
          <div className="flex items-center gap-4 border-l border-border pl-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-incentives"
                checked={showBuyerIncentivesOnly}
                onCheckedChange={(checked) => setShowBuyerIncentivesOnly(checked as boolean)}
              />
              <Label htmlFor="filter-incentives" className="text-sm cursor-pointer whitespace-nowrap">
                Buyer Incentives
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-listings"
                checked={showListingAgentsOnly}
                onCheckedChange={(checked) => setShowListingAgentsOnly(checked as boolean)}
              />
              <Label htmlFor="filter-listings" className="text-sm cursor-pointer whitespace-nowrap">
                Has Listings
              </Label>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort:</Label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a" | "listings")}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a-z">Name A-Z</SelectItem>
                <SelectItem value="z-a">Name Z-A</SelectItem>
                <SelectItem value="listings">Most Listings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Result Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resultCount}</span> agents
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSearchFilters;
