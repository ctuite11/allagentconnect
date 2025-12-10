import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X, Search, SlidersHorizontal, MapPin } from "lucide-react";
import { MA_COUNTY_TOWNS } from "@/data/maCountyTowns";

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
  streetNumber: string;
  streetName: string;
  zipCode: string;
  radius: string;
  keywordsInclude: string;
  keywordsExclude: string;
  keywordMode: "any" | "all";
  keywordType: "include" | "exclude";
  listingNumber: string;
  openHouses: boolean;
  brokerTours: boolean;
  listingEventsTimeframe: string;
  internalFilter: "all" | "off_market" | "coming_soon";
}

export const initialFilters: FilterState = {
  propertyTypes: [],
  statuses: ["new", "active", "price_changed", "back_on_market", "coming_soon"],
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
  streetNumber: "",
  streetName: "",
  zipCode: "",
  radius: "",
  keywordsInclude: "",
  keywordsExclude: "",
  keywordMode: "any",
  keywordType: "include",
  listingNumber: "",
  openHouses: false,
  brokerTours: false,
  listingEventsTimeframe: "3days",
  internalFilter: "all",
};

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "residential_rental", label: "Residential Rental" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "price_changed", label: "Price Change" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold", label: "Sold" },
  { value: "off_market", label: "Off-Market (Private)" },
];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
  onSearch: () => void;
}

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
  onSearch,
}: ListingSearchFiltersProps) => {
  const [townSearch, setTownSearch] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

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

  const removeChip = (type: "propertyType" | "status" | "town", value: string) => {
    if (type === "propertyType") {
      updateFilter("propertyTypes", filters.propertyTypes.filter(t => t !== value));
    } else if (type === "status") {
      updateFilter("statuses", filters.statuses.filter(s => s !== value));
    } else {
      updateFilter("selectedTowns", filters.selectedTowns.filter(t => t !== value));
    }
  };

  const getAvailableTowns = (): string[] => {
    if (filters.county) {
      const county = counties.find(c => c.id === filters.county);
      if (county && MA_COUNTY_TOWNS[county.name]) {
        return MA_COUNTY_TOWNS[county.name];
      }
    }
    return Object.values(MA_COUNTY_TOWNS).flat() as string[];
  };

  const availableTowns = getAvailableTowns();
  const filteredTowns = townSearch
    ? availableTowns.filter(t => t.toLowerCase().includes(townSearch.toLowerCase()))
    : availableTowns;

  const filteredCounties = counties.filter(c => c.state === filters.state);

  // Count active filters for the "More Filters" badge
  const moreFiltersCount = [
    filters.sqftMin,
    filters.sqftMax,
    filters.yearBuiltMin,
    filters.yearBuiltMax,
    filters.garageSpaces,
    filters.parkingSpaces,
    filters.keywordsInclude,
    filters.keywordsExclude,
  ].filter(Boolean).length;

  // Build active filter chips
  const activeChips: { type: "propertyType" | "status" | "town"; value: string; label: string }[] = [];
  
  filters.propertyTypes.forEach(pt => {
    const found = PROPERTY_TYPES.find(p => p.value === pt);
    if (found) activeChips.push({ type: "propertyType", value: pt, label: found.label });
  });
  
  filters.statuses.forEach(st => {
    const found = STATUSES.find(s => s.value === st);
    if (found) activeChips.push({ type: "status", value: st, label: found.label });
  });
  
  filters.selectedTowns.forEach(town => {
    activeChips.push({ type: "town", value: town, label: town });
  });

  return (
    <div className="bg-white border-b border-slate-200">
      {/* Sticky Filter Bar */}
      <div className="sticky top-16 z-20 bg-white border-b border-slate-100">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Property Type Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-medium border-slate-200 bg-white hover:bg-slate-50">
                  Property Type
                  {filters.propertyTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-slate-100">
                      {filters.propertyTypes.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-white" align="start">
                <div className="space-y-1">
                  {PROPERTY_TYPES.map(type => (
                    <label
                      key={type.value}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Checkbox
                        checked={filters.propertyTypes.includes(type.value)}
                        onCheckedChange={() => togglePropertyType(type.value)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-slate-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Status Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-medium border-slate-200 bg-white hover:bg-slate-50">
                  Status
                  {filters.statuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-slate-100">
                      {filters.statuses.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-white" align="start">
                <div className="space-y-1">
                  {STATUSES.map(status => (
                    <label
                      key={status.value}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Checkbox
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-slate-700">{status.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Price Inputs */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 h-9">
              <span className="text-xs text-slate-500">$</span>
              <Input
                type="text"
                placeholder="Min"
                value={filters.priceMin}
                onChange={e => updateFilter("priceMin", e.target.value.replace(/\D/g, ""))}
                className="h-7 w-20 border-0 p-0 text-sm focus-visible:ring-0 placeholder:text-slate-400"
              />
              <span className="text-slate-300">–</span>
              <Input
                type="text"
                placeholder="Max"
                value={filters.priceMax}
                onChange={e => updateFilter("priceMax", e.target.value.replace(/\D/g, ""))}
                className="h-7 w-20 border-0 p-0 text-sm focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* Towns Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-medium border-slate-200 bg-white hover:bg-slate-50">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  Towns
                  {filters.selectedTowns.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-slate-100">
                      {filters.selectedTowns.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 bg-white" align="start">
                <div className="p-2 border-b border-slate-100">
                  <div className="flex gap-2">
                    <Select 
                      value={filters.county || "all"} 
                      onValueChange={v => updateFilter("county", v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1 bg-white">
                        <SelectValue placeholder="All Counties" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All Counties</SelectItem>
                        {filteredCounties.map(county => (
                          <SelectItem key={county.id} value={county.id}>{county.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-2 border-b border-slate-100">
                  <Input
                    placeholder="Search towns..."
                    value={townSearch}
                    onChange={e => setTownSearch(e.target.value)}
                    className="h-8 text-sm bg-white"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-2">
                  {filteredTowns.slice(0, 50).map(town => (
                    <label
                      key={town}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Checkbox
                        checked={filters.selectedTowns.includes(town)}
                        onCheckedChange={() => toggleTown(town)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-slate-700">{town}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Beds */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 h-9">
              <span className="text-xs text-slate-500 whitespace-nowrap">Beds</span>
              <Input
                type="text"
                placeholder="Min"
                value={filters.bedsMin}
                onChange={e => updateFilter("bedsMin", e.target.value.replace(/\D/g, ""))}
                className="h-7 w-12 border-0 p-0 text-sm focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* Baths */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 h-9">
              <span className="text-xs text-slate-500 whitespace-nowrap">Baths</span>
              <Input
                type="text"
                placeholder="Min"
                value={filters.bathsMin}
                onChange={e => updateFilter("bathsMin", e.target.value.replace(/\D/g, ""))}
                className="h-7 w-12 border-0 p-0 text-sm focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* More Filters */}
            <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm font-medium border-slate-200 bg-white hover:bg-slate-50">
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                  More Filters
                  {moreFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-slate-100">
                      {moreFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 bg-white" align="start">
                <div className="space-y-4">
                  {/* SqFt */}
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Square Feet</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Min"
                        value={filters.sqftMin}
                        onChange={e => updateFilter("sqftMin", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                      <span className="text-slate-400">–</span>
                      <Input
                        type="text"
                        placeholder="Max"
                        value={filters.sqftMax}
                        onChange={e => updateFilter("sqftMax", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                  </div>

                  {/* Year Built */}
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Year Built</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Min"
                        value={filters.yearBuiltMin}
                        onChange={e => updateFilter("yearBuiltMin", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                      <span className="text-slate-400">–</span>
                      <Input
                        type="text"
                        placeholder="Max"
                        value={filters.yearBuiltMax}
                        onChange={e => updateFilter("yearBuiltMax", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                  </div>

                  {/* Parking */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Garage Spaces</Label>
                      <Input
                        type="text"
                        placeholder="Min"
                        value={filters.garageSpaces}
                        onChange={e => updateFilter("garageSpaces", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Total Parking</Label>
                      <Input
                        type="text"
                        placeholder="Min"
                        value={filters.parkingSpaces}
                        onChange={e => updateFilter("parkingSpaces", e.target.value.replace(/\D/g, ""))}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Keywords (Include)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. pool, renovated"
                      value={filters.keywordsInclude}
                      onChange={e => updateFilter("keywordsInclude", e.target.value)}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Keywords (Exclude)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. fixer, as-is"
                      value={filters.keywordsExclude}
                      onChange={e => updateFilter("keywordsExclude", e.target.value)}
                      className="h-8 text-sm bg-white"
                    />
                  </div>

                  {/* Internal Filters */}
                  <div className="border-t border-slate-100 pt-3">
                    <Label className="text-xs font-medium text-slate-600 mb-2 block">Inventory Type</Label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filters.internalFilter === "all"}
                          onCheckedChange={() => updateFilter("internalFilter", "all")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">MLS + Off-Market (Default)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filters.internalFilter === "off_market"}
                          onCheckedChange={() => updateFilter("internalFilter", "off_market")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">Off-Market Only</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filters.internalFilter === "coming_soon"}
                          onCheckedChange={() => updateFilter("internalFilter", "coming_soon")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">Coming Soon Only</span>
                      </label>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Search Button */}
            <Button 
              onClick={onSearch}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="container mx-auto px-4 py-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Active filters:</span>
            {activeChips.slice(0, 12).map((chip, i) => (
              <Badge
                key={`${chip.type}-${chip.value}-${i}`}
                variant="secondary"
                className="h-6 px-2 gap-1 text-xs font-normal bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                onClick={() => removeChip(chip.type, chip.value)}
              >
                {chip.label}
                <X className="h-3 w-3 text-slate-400" />
              </Badge>
            ))}
            {activeChips.length > 12 && (
              <span className="text-xs text-slate-500">+{activeChips.length - 12} more</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
              onClick={() => onFiltersChange(initialFilters)}
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingSearchFilters;
