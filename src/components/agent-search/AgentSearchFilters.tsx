import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Search, X, MapPin, ChevronDown, RotateCcw, FileSpreadsheet, Filter, Gift, Home, Sparkles } from "lucide-react";
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
}: AgentSearchFiltersProps) => {
  const hasActiveFilters = searchQuery || selectedCounties.length > 0 || showBuyerIncentivesOnly || showListingAgentsOnly;

  // Get unique states from counties
  const uniqueStates = [...new Set(counties.map(c => c.state))].sort();

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
    <div className="sticky top-16 z-30 bg-muted/30 py-4">
      <div className="container mx-auto px-4">
        {/* Filter Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
          {/* Row 1: Search, State, County */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input - Wide */}
            <div className="relative flex-1 min-w-[280px] max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search name, company, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 border-neutral-200 hover:border-neutral-300 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 text-neutral-400 hover:text-neutral-600"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* State Select */}
            <Select>
              <SelectTrigger className="w-40 h-10 border-neutral-200 hover:border-neutral-300">
                <MapPin className="h-4 w-4 text-neutral-400 mr-2" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* County Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="h-10 px-4 gap-2 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <span className="text-sm">County</span>
                  {selectedCounties.length > 0 && (
                    <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-xs font-medium">
                      {selectedCounties.length}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
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

          {/* Divider */}
          <div className="border-t border-neutral-200 my-3" />

          {/* Row 2: Sort, Agent Intel Toggle, Quick Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-neutral-500 whitespace-nowrap">Sort:</Label>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a" | "listings")}>
                <SelectTrigger className="w-36 h-9 border-neutral-200 hover:border-neutral-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-z">Name A-Z</SelectItem>
                  <SelectItem value="z-a">Name Z-A</SelectItem>
                  <SelectItem value="listings">Most Listings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-neutral-200" />

            {/* Agent Intel Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <Label htmlFor="agent-intel" className="text-sm font-medium cursor-pointer">Agent Intel</Label>
              </div>
              <Switch id="agent-intel" />
              <span className="text-xs text-neutral-400">View agent analytics</span>
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-neutral-200" />

            {/* Quick Filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="filter-incentives"
                  checked={showBuyerIncentivesOnly}
                  onCheckedChange={(checked) => setShowBuyerIncentivesOnly(checked as boolean)}
                />
                <Label htmlFor="filter-incentives" className="text-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-emerald-600" />
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
                  <Home className="h-3.5 w-3.5 text-emerald-600" />
                  Has Listings
                </Label>
              </div>
            </div>

            {/* Clear Filters - Push to Right */}
            {hasActiveFilters && (
              <>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFilters}
                  className="h-8 px-3 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="mt-3 bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-neutral-500">Active:</span>
            
            {activeFilterPills.map((pill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 bg-neutral-100 border border-neutral-200 rounded-md px-2 py-1 text-xs font-medium text-neutral-700"
              >
                {pill.label}
                <button
                  onClick={pill.onRemove}
                  className="hover:text-red-500 ml-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAsHotsheet}
              className="h-7 px-3 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1.5" />
              Save as Hotsheet
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSearchFilters;
