import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  SlidersHorizontal, 
  ChevronDown, 
  X,
  MapPin,
  DollarSign,
  Home,
  Bed,
  Bath
} from "lucide-react";

interface ListingSearchTopBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onOpenMoreFilters: () => void;
  resultCount: number;
  loading: boolean;
  counties: { id: string; name: string; state: string }[];
}

export interface FilterState {
  propertyTypes: string[];
  statuses: string[];
  bedsMin: string;
  bedsMax: string;
  bathsMin: string;
  bathsMax: string;
  sqftMin: string;
  sqftMax: string;
  lotSizeMin: string;
  lotSizeMax: string;
  yearBuiltMin: string;
  yearBuiltMax: string;
  garageSpaces: string;
  parkingSpaces: string;
  priceMin: string;
  priceMax: string;
  state: string;
  county: string;
  selectedTowns: string[];
  streetAddress: string;
  zipCode: string;
  radius: string;
  keywordsInclude: string;
  keywordsExclude: string;
}

export const initialFilters: FilterState = {
  propertyTypes: [],
  statuses: ["new", "active"],
  bedsMin: "",
  bedsMax: "",
  bathsMin: "",
  bathsMax: "",
  sqftMin: "",
  sqftMax: "",
  lotSizeMin: "",
  lotSizeMax: "",
  yearBuiltMin: "",
  yearBuiltMax: "",
  garageSpaces: "",
  parkingSpaces: "",
  priceMin: "",
  priceMax: "",
  state: "MA",
  county: "",
  selectedTowns: [],
  streetAddress: "",
  zipCode: "",
  radius: "",
  keywordsInclude: "",
  keywordsExclude: "",
};

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condominium" },
  { value: "multi_family", label: "Multi Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "residential_rental", label: "Residential Rental" },
];

const STATUSES = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "price_changed", label: "Price Changed" },
  { value: "extended", label: "Extended" },
  { value: "reactivated", label: "Reactivated" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold", label: "Sold" },
  { value: "off_market", label: "Off-Market" },
];

const ListingSearchTopBar = ({
  filters,
  onFiltersChange,
  onSearch,
  onOpenMoreFilters,
  resultCount,
  loading,
  counties,
}: ListingSearchTopBarProps) => {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const togglePropertyType = (type: string) => {
    const current = filters.propertyTypes;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateFilter("propertyTypes", updated);
  };

  const toggleStatus = (status: string) => {
    const current = filters.statuses;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter("statuses", updated);
  };

  const toggleTown = (town: string) => {
    const current = filters.selectedTowns;
    const updated = current.includes(town)
      ? current.filter(t => t !== town)
      : [...current, town];
    updateFilter("selectedTowns", updated);
  };

  const hasActiveFilters = 
    filters.propertyTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priceMin ||
    filters.priceMax ||
    filters.selectedTowns.length > 0 ||
    filters.bedsMin ||
    filters.bathsMin;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="bg-card border-b border-border py-4">
      <div className="container mx-auto px-4">
        {/* Main Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Property Type Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 min-w-[140px]">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Property Type</span>
                <span className="sm:hidden">Type</span>
                {filters.propertyTypes.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {filters.propertyTypes.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium mb-3">Property Type</p>
                <div className="space-y-1">
                  {PROPERTY_TYPES.map(type => (
                    <label 
                      key={type.value} 
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.propertyTypes.includes(type.value)}
                        onCheckedChange={() => togglePropertyType(type.value)}
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
                {filters.propertyTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={() => updateFilter("propertyTypes", [])}
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Status Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 min-w-[100px]">
                <span>Status</span>
                {filters.statuses.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {filters.statuses.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium mb-3">Status</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {STATUSES.map(status => (
                    <label 
                      key={status.value} 
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                      />
                      <span className={`text-sm ${status.value === "off_market" ? "text-amber-600" : ""}`}>
                        {status.label}
                      </span>
                    </label>
                  ))}
                </div>
                {filters.statuses.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs mt-2"
                    onClick={() => updateFilter("statuses", [])}
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Price Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 min-w-[100px]">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Price</span>
                {(filters.priceMin || filters.priceMax) && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    ✓
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Price Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Min Price</Label>
                    <Input
                      type="number"
                      placeholder="No Min"
                      value={filters.priceMin}
                      onChange={e => updateFilter("priceMin", e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Price</Label>
                    <Input
                      type="number"
                      placeholder="No Max"
                      value={filters.priceMax}
                      onChange={e => updateFilter("priceMax", e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Towns Multi-Select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 min-w-[120px]">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Town(s)</span>
                <span className="sm:hidden">Towns</span>
                {filters.selectedTowns.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {filters.selectedTowns.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <TownSelector 
                filters={filters} 
                onFiltersChange={onFiltersChange}
                counties={counties}
              />
            </PopoverContent>
          </Popover>

          {/* Beds */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span>Beds</span>
                {filters.bedsMin && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {filters.bedsMin}+
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-4" align="start">
              <div className="space-y-3">
                <p className="text-sm font-medium">Bedrooms</p>
                <div className="flex gap-2">
                  {["1", "2", "3", "4", "5"].map(num => (
                    <Button
                      key={num}
                      variant={filters.bedsMin === num ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => updateFilter("bedsMin", filters.bedsMin === num ? "" : num)}
                    >
                      {num}+
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Baths */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span>Baths</span>
                {filters.bathsMin && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">
                    {filters.bathsMin}+
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-4" align="start">
              <div className="space-y-3">
                <p className="text-sm font-medium">Bathrooms</p>
                <div className="flex gap-2">
                  {["1", "2", "3", "4"].map(num => (
                    <Button
                      key={num}
                      variant={filters.bathsMin === num ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => updateFilter("bathsMin", filters.bathsMin === num ? "" : num)}
                    >
                      {num}+
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* More Filters Button */}
          <Button 
            variant="outline" 
            className="h-10 gap-2"
            onClick={onOpenMoreFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">More Filters</span>
            <span className="sm:hidden">More</span>
          </Button>

          {/* Search Button */}
          <Button 
            className="h-10 gap-2 bg-primary hover:bg-primary/90"
            onClick={onSearch}
            disabled={loading}
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 text-muted-foreground hover:text-foreground"
              onClick={() => onFiltersChange(initialFilters)}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Results Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{loading ? "..." : resultCount}</span> listings
          </div>
        </div>

        {/* Selected Towns Pills */}
        {filters.selectedTowns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {filters.selectedTowns.map(town => (
              <span
                key={town}
                className="inline-flex items-center px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => toggleTown(town)}
              >
                {town} <X className="h-3 w-3 ml-1" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Town Selector Sub-component
interface TownSelectorProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
}

const TownSelector = ({ filters, onFiltersChange, counties }: TownSelectorProps) => {
  const [townSearch, setTownSearch] = useState("");
  
  // Import MA county towns data
  const { MA_COUNTY_TOWNS } = require("@/data/maCountyTowns");
  
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleTown = (town: string) => {
    const current = filters.selectedTowns;
    const updated = current.includes(town)
      ? current.filter(t => t !== town)
      : [...current, town];
    updateFilter("selectedTowns", updated);
  };

  // Get towns based on selected county or all MA towns
  const getAvailableTowns = (): string[] => {
    if (filters.county) {
      const county = counties.find(c => c.id === filters.county);
      if (county && MA_COUNTY_TOWNS[county.name]) {
        return MA_COUNTY_TOWNS[county.name];
      }
    }
    // Return all MA towns if no county selected
    return Object.values(MA_COUNTY_TOWNS).flat() as string[];
  };

  const availableTowns = getAvailableTowns();
  const filteredTowns = townSearch
    ? availableTowns.filter(t => t.toLowerCase().includes(townSearch.toLowerCase()))
    : availableTowns;

  const filteredCounties = counties.filter(c => c.state === "MA");

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Location</p>
      
      {/* County Selector */}
      <div>
        <Label className="text-xs text-muted-foreground">County (optional)</Label>
        <Select 
          value={filters.county} 
          onValueChange={v => updateFilter("county", v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="All Counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Counties</SelectItem>
            {filteredCounties.map(county => (
              <SelectItem key={county.id} value={county.id}>
                {county.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Town Search */}
      <div>
        <Label className="text-xs text-muted-foreground">Search Towns</Label>
        <Input
          placeholder="Type to search towns..."
          value={townSearch}
          onChange={e => setTownSearch(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Towns List */}
      <div className="border rounded-md bg-background max-h-48 overflow-y-auto p-2 space-y-0.5">
        {filteredTowns.slice(0, 50).map(town => (
          <label 
            key={town} 
            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm"
          >
            <Checkbox
              checked={filters.selectedTowns.includes(town)}
              onCheckedChange={() => toggleTown(town)}
              className="h-3.5 w-3.5"
            />
            <span>{town}</span>
          </label>
        ))}
        {filteredTowns.length > 50 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Showing first 50 results. Type to search for more.
          </p>
        )}
        {filteredTowns.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No towns found
          </p>
        )}
      </div>

      {filters.selectedTowns.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => updateFilter("selectedTowns", [])}
        >
          Clear All Towns ({filters.selectedTowns.length})
        </Button>
      )}
    </div>
  );
};

export default ListingSearchTopBar;
