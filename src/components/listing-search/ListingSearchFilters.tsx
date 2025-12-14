import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  Search, 
  MapPin
} from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { cn } from "@/lib/utils";

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
  hasNoMin: boolean;
  hasNoMax: boolean;
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
  listDateFrom: string;
  listDateTo: string;
  offMarketTimeframe: string;
  rooms: string;
  acres: string;
  pricePerSqFt: string;
  listDatePreset: string;
}

// Format number with commas for display
const formatNumberWithCommas = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  return Number(numericValue).toLocaleString();
};

// Parse formatted number back to raw digits
const parseFormattedNumber = (value: string): string => {
  return value.replace(/\D/g, "");
};

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
  hasNoMin: false,
  hasNoMax: false,
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
  listDateFrom: "",
  listDateTo: "",
  offMarketTimeframe: "6months",
  rooms: "",
  acres: "",
  pricePerSqFt: "",
  listDatePreset: "any",
};

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "residential_rental", label: "Rental" },
];

const PRIMARY_STATUSES = [
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "price_changed", label: "Price Changed" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold", label: "Sold" },
];

const MORE_STATUSES = [
  { value: "private", label: "Private" },
  { value: "extended", label: "Extended" },
  { value: "reactivated", label: "Reactivated" },
  { value: "pending", label: "Pending" },
  { value: "contingent", label: "Contingent" },
  { value: "temporarily_withdrawn", label: "Temp. Withdrawn" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
  { value: "rented", label: "Rented" },
];

const LIST_DATE_PRESETS = [
  { value: "any", label: "Any Time" },
  { value: "today", label: "Today" },
  { value: "3days", label: "Last 3 Days" },
  { value: "7days", label: "Last 7 Days" },
  { value: "14days", label: "Last 14 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "90days", label: "Last 90 Days" },
];

const PRICE_CHIPS = [
  { value: "500000", label: "$500k" },
  { value: "750000", label: "$750k" },
  { value: "1000000", label: "$1M" },
  { value: "1500000", label: "$1.5M" },
  { value: "2000000", label: "$2M+" },
];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
  onSearch: () => void;
}

// Toggle Pill Component
const TogglePill = ({ 
  label, 
  active, 
  onClick 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150",
      active 
        ? "bg-primary text-primary-foreground border-primary" 
        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
    )}
  >
    {label}
  </button>
);

// Section Card with subtle styling
const SectionCard = ({ 
  title, 
  children, 
  rightSlot,
  className 
}: { 
  title: string; 
  children: React.ReactNode; 
  rightSlot?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("bg-card border border-border rounded-lg", className)}>
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      {rightSlot}
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

// Collapsible Section
const CollapsibleSection = ({ 
  title, 
  children,
  defaultOpen = true,
  rightSlot
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-card border border-border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {rightSlot}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          {children}
        </div>
      )}
    </div>
  );
};

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
  onSearch,
}: ListingSearchFiltersProps) => {
  const [townSearch, setTownSearch] = useState("");
  const [showAreas, setShowAreas] = useState(true);
  const [showMoreStatuses, setShowMoreStatuses] = useState(false);

  // Get county name from ID for the hook
  const selectedCountyName = filters.county 
    ? counties.find(c => c.id === filters.county)?.name || ""
    : "";

  // Use the canonical towns picker hook
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: filters.state,
    county: selectedCountyName,
    showAreas,
  });

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

  const addAllTowns = () => {
    updateFilter("selectedTowns", [...new Set([...filters.selectedTowns, ...townsList])]);
  };

  const clearCriteria = () => {
    onFiltersChange({
      ...filters,
      bedsMin: "",
      bathsMin: "",
      sqftMin: "",
      yearBuiltMin: "",
      parkingSpaces: "",
      acres: "",
      pricePerSqFt: "",
      rooms: "",
    });
  };

  const filteredCounties = counties.filter(c => c.state === filters.state);

  return (
    <div className="space-y-4">
      {/* ROW 1: 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-4">
        
        {/* LEFT: Property Type */}
        <SectionCard title="Property Type">
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map(type => (
              <TogglePill
                key={type.value}
                label={type.label}
                active={filters.propertyTypes.includes(type.value)}
                onClick={() => togglePropertyType(type.value)}
              />
            ))}
          </div>
        </SectionCard>

        {/* MIDDLE: Status + Date + Price */}
        <div className="space-y-4">
          {/* Status */}
          <SectionCard title="Status">
            <div className="flex flex-wrap gap-2">
              {PRIMARY_STATUSES.map(status => (
                <TogglePill
                  key={status.value}
                  label={status.label}
                  active={filters.statuses.includes(status.value)}
                  onClick={() => toggleStatus(status.value)}
                />
              ))}
              <button
                onClick={() => setShowMoreStatuses(!showMoreStatuses)}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMoreStatuses ? "Less" : "More..."}
              </button>
            </div>
            {showMoreStatuses && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                {MORE_STATUSES.map(status => (
                  <TogglePill
                    key={status.value}
                    label={status.label}
                    active={filters.statuses.includes(status.value)}
                    onClick={() => toggleStatus(status.value)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Date + Price Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Listed */}
            <SectionCard title="Listed">
              <Select 
                value={filters.listDatePreset} 
                onValueChange={v => updateFilter("listDatePreset", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SectionCard>

            {/* Off-Market Timeframe */}
            <SectionCard title="Off-Market Window">
              <Select 
                value={filters.offMarketTimeframe} 
                onValueChange={v => updateFilter("offMarketTimeframe", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                  <SelectItem value="12months">12 Months</SelectItem>
                  <SelectItem value="24months">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </SectionCard>
          </div>

          {/* Price Range */}
          <SectionCard title="Price Range">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="text"
                      placeholder="Any"
                      value={formatNumberWithCommas(filters.priceMin)}
                      onChange={e => updateFilter("priceMin", parseFormattedNumber(e.target.value))}
                      className="h-8 text-sm pl-6"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="text"
                      placeholder="Any"
                      value={formatNumberWithCommas(filters.priceMax)}
                      onChange={e => updateFilter("priceMax", parseFormattedNumber(e.target.value))}
                      className="h-8 text-sm pl-6"
                    />
                  </div>
                </div>
              </div>
              {/* Quick chips */}
              <div className="flex flex-wrap gap-1.5">
                {PRICE_CHIPS.map(chip => (
                  <button
                    key={chip.value}
                    onClick={() => updateFilter("priceMax", chip.value)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] rounded border transition-colors",
                      filters.priceMax === chip.value
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT: Standard Criteria */}
        <SectionCard 
          title="Criteria" 
          rightSlot={
            <button 
              onClick={clearCriteria}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Beds (min)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.bedsMin}
                  onChange={e => updateFilter("bedsMin", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Baths (min)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.bathsMin}
                  onChange={e => updateFilter("bathsMin", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">SqFt (min)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.sqftMin}
                  onChange={e => updateFilter("sqftMin", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">$/SqFt (max)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.pricePerSqFt}
                  onChange={e => updateFilter("pricePerSqFt", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Year Built (from)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.yearBuiltMin}
                  onChange={e => updateFilter("yearBuiltMin", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Parking (min)</Label>
                <Input
                  type="text"
                  placeholder="Any"
                  value={filters.parkingSpaces}
                  onChange={e => updateFilter("parkingSpaces", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Acres (min)</Label>
              <Input
                type="text"
                placeholder="Any"
                value={filters.acres}
                onChange={e => updateFilter("acres", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ROW 2: Geography */}
      <CollapsibleSection title="Geography" defaultOpen={true}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: State/County + Town Picker */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">State</Label>
                <Select value={filters.state} onValueChange={v => updateFilter("state", v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MA">Massachusetts</SelectItem>
                    <SelectItem value="NH">New Hampshire</SelectItem>
                    <SelectItem value="RI">Rhode Island</SelectItem>
                    <SelectItem value="CT">Connecticut</SelectItem>
                    <SelectItem value="ME">Maine</SelectItem>
                    <SelectItem value="VT">Vermont</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">County</Label>
                <Select 
                  value={filters.county || "all"} 
                  onValueChange={v => updateFilter("county", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All Counties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Counties</SelectItem>
                    {filteredCounties.map(county => (
                      <SelectItem key={county.id} value={county.id}>{county.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Town Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search towns..."
                value={townSearch}
                onChange={e => setTownSearch(e.target.value)}
                className="h-8 text-sm pl-8"
              />
              {townSearch && (
                <button 
                  onClick={() => setTownSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Town Picker */}
            <div className="h-[240px] border border-border rounded-lg bg-background overflow-hidden">
              <ScrollArea className="h-full p-2">
                <button
                  onClick={addAllTowns}
                  className="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-muted rounded transition-colors font-medium mb-1"
                >
                  Add All Towns ({townsList.length})
                </button>
                <TownsPicker
                  towns={townsList}
                  selectedTowns={filters.selectedTowns}
                  onToggleTown={toggleTown}
                  expandedCities={expandedCities}
                  onToggleCityExpansion={toggleCityExpansion}
                  state={filters.state}
                  searchQuery={townSearch}
                  variant="button"
                  showAreas={showAreas}
                />
              </ScrollArea>
            </div>
          </div>

          {/* Right: Selected Towns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">
                Selected Towns ({filters.selectedTowns.length})
              </Label>
              {filters.selectedTowns.length > 0 && (
                <button
                  onClick={() => updateFilter("selectedTowns", [])}
                  className="text-[10px] text-destructive hover:text-destructive/80 transition-colors"
                >
                  Remove All
                </button>
              )}
            </div>
            <div className="h-[280px] border border-border rounded-lg bg-background overflow-hidden">
              <ScrollArea className="h-full p-2">
                {filters.selectedTowns.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-2 py-3 text-center">
                    No towns selected
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {filters.selectedTowns.map(town => (
                      <button
                        key={town}
                        onClick={() => toggleTown(town)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded transition-colors text-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-between group"
                      >
                        <span>{town}</span>
                        <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ROW 3: Address + Keywords (collapsed by default) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollapsibleSection title="Address Search" defaultOpen={false}>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Street #</Label>
              <Input
                type="text"
                placeholder=""
                value={filters.streetNumber}
                onChange={e => updateFilter("streetNumber", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Street Name</Label>
              <Input
                type="text"
                placeholder=""
                value={filters.streetName}
                onChange={e => updateFilter("streetName", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Zip Code</Label>
              <Input
                type="text"
                placeholder=""
                value={filters.zipCode}
                onChange={e => updateFilter("zipCode", e.target.value.replace(/\D/g, ""))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Keywords" defaultOpen={false}>
          <Input
            type="text"
            placeholder="Enter keywords separated by commas..."
            value={filters.keywordsInclude}
            onChange={e => updateFilter("keywordsInclude", e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Searches public remarks only
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default ListingSearchFilters;