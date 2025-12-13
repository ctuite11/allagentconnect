import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, MapPin, ChevronDown, RotateCcw, FileSpreadsheet, Filter, Users, Gift, Home } from "lucide-react";
import { toast } from "sonner";

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

  // Build active filters summary
  const activeFilterPills: { label: string; onRemove: () => void }[] = [];
  
  if (searchQuery) {
    activeFilterPills.push({
      label: `"${searchQuery}"`,
      onRemove: () => setSearchQuery("")
    });
  }
  
  if (selectedCounties.length > 0) {
    const selectedNames = counties
      .filter(c => selectedCounties.includes(c.id))
      .map(c => c.name)
      .slice(0, 2);
    const label = selectedNames.join(", ") + (selectedCounties.length > 2 ? ` +${selectedCounties.length - 2}` : "");
    activeFilterPills.push({
      label: `Areas: ${label}`,
      onRemove: () => selectedCounties.forEach(id => toggleCounty(id))
    });
  }
  
  if (showBuyerIncentivesOnly) {
    activeFilterPills.push({
      label: "Buyer Incentives",
      onRemove: () => setShowBuyerIncentivesOnly(false)
    });
  }
  
  if (showListingAgentsOnly) {
    activeFilterPills.push({
      label: "Has Listings",
      onRemove: () => setShowListingAgentsOnly(false)
    });
  }

  const handleSaveAsHotsheet = () => {
    toast.info("Save as Hotsheet coming soon");
  };

  return (
    <div className="sticky top-16 z-30 bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4 space-y-3">
        {/* Filter Sections Row */}
        <div className="flex flex-wrap items-stretch gap-3">
          {/* Search Section Card */}
          <div className="flex-1 min-w-[200px] max-w-md bg-background border border-border rounded-lg border-l-[6px] border-l-primary">
            <div className="relative p-2">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
              <Input
                type="text"
                placeholder="Search name, company, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-9 border-0 shadow-none focus-visible:ring-0"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Service Areas Section Card */}
          <div className="bg-background border border-border rounded-lg border-l-[6px] border-l-primary">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-full px-4 gap-2 hover:bg-muted">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Service Areas</span>
                  {selectedCounties.length > 0 && (
                    <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                      {selectedCounties.length}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
          </div>

          {/* Quick Toggles Section Card */}
          <div className="bg-background border border-border rounded-lg border-l-[6px] border-l-primary p-2 flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-incentives"
                checked={showBuyerIncentivesOnly}
                onCheckedChange={(checked) => setShowBuyerIncentivesOnly(checked as boolean)}
              />
              <Label htmlFor="filter-incentives" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-primary" />
                Buyer Incentives
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-listings"
                checked={showListingAgentsOnly}
                onCheckedChange={(checked) => setShowListingAgentsOnly(checked as boolean)}
              />
              <Label htmlFor="filter-listings" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-primary" />
                Has Listings
              </Label>
            </div>
          </div>

          {/* Sort Section Card */}
          <div className="bg-background border border-border rounded-lg border-l-[6px] border-l-primary p-2 flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort:</Label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a" | "listings")}>
              <SelectTrigger className="w-36 h-9 border-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a-z">Name A-Z</SelectItem>
                <SelectItem value="z-a">Name Z-A</SelectItem>
                <SelectItem value="listings">Most Listings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Result Count */}
          <div className="flex items-center ml-auto text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-1.5 text-primary" />
            <span className="font-semibold text-foreground">{resultCount}</span>
            <span className="ml-1">agents</span>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/50 rounded-lg px-3 py-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Active:</span>
            
            {activeFilterPills.map((pill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground"
              >
                {pill.label}
                <button
                  onClick={pill.onRemove}
                  className="hover:text-destructive ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            <div className="flex-1" />

            {/* Actions */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button
              variant="brandOutline"
              size="sm"
              onClick={handleSaveAsHotsheet}
              className="h-7 px-2 text-xs"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Save as Hotsheet
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSearchFilters;
