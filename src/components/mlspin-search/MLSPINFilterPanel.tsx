import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Search, RotateCcw } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";

interface FilterState {
  propertyTypes: string[];
  statuses: string[];
  bedsMin: string;
  bedsMax: string;
  bathsMin: string;
  bathsMax: string;
  sqftMin: string;
  sqftMax: string;
  yearBuiltMin: string;
  yearBuiltMax: string;
  parkingMin: string;
  priceMin: string;
  priceMax: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  radius: string;
  state: string;
  county: string;
  selectedTowns: string[];
  openHouse: boolean;
  brokerTour: boolean;
  keywordsInclude: string;
  keywordsExclude: string;
}

interface MLSPINFilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  onReset: () => void;
  counties: { id: string; name: string; state: string }[];
}

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "townhouse", label: "Townhouse" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "off_market", label: "Off-Market (Private)" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

const STATES = [
  { value: "MA", label: "Massachusetts" },
  { value: "CT", label: "Connecticut" },
  { value: "NH", label: "New Hampshire" },
  { value: "RI", label: "Rhode Island" },
  { value: "ME", label: "Maine" },
  { value: "VT", label: "Vermont" },
];

interface FilterGroupProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const FilterGroup = ({ title, defaultOpen = true, children }: FilterGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50 transition-colors">
        <span>{title}</span>
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const MLSPINFilterPanel = ({
  filters,
  onFiltersChange,
  onSearch,
  onReset,
  counties,
}: MLSPINFilterPanelProps) => {
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: filters.state,
    county: filters.county ? counties.find(c => c.id === filters.county)?.name : undefined,
    showAreas: true,
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

  const handleTownSelect = (town: string) => {
    const current = filters.selectedTowns;
    const updated = current.includes(town)
      ? current.filter(t => t !== town)
      : [...current, town];
    updateFilter("selectedTowns", updated);
  };

  const filteredCounties = counties.filter(c => 
    !filters.state || c.state === filters.state
  );

  return (
    <div className="w-72 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
        <span className="text-sm font-semibold">Search Filters</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={onSearch} className="h-7 px-3 text-xs bg-primary">
            <Search className="h-3 w-3 mr-1" />
            Search
          </Button>
        </div>
      </div>

      {/* Scrollable Filters */}
      <div className="flex-1 overflow-y-auto">
        {/* Property Type */}
        <FilterGroup title="Property Type">
          <div className="grid grid-cols-2 gap-1">
            {PROPERTY_TYPES.map(type => (
              <label key={type.value} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                <Checkbox
                  checked={filters.propertyTypes.includes(type.value)}
                  onCheckedChange={() => togglePropertyType(type.value)}
                  className="h-3.5 w-3.5"
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </FilterGroup>

        {/* Status */}
        <FilterGroup title="Status">
          <div className="grid grid-cols-2 gap-1">
            {STATUSES.map(status => (
              <label key={status.value} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                <Checkbox
                  checked={filters.statuses.includes(status.value)}
                  onCheckedChange={() => toggleStatus(status.value)}
                  className="h-3.5 w-3.5"
                />
                <span className={status.value === "off_market" ? "text-amber-600 dark:text-amber-400" : ""}>
                  {status.label}
                </span>
              </label>
            ))}
          </div>
        </FilterGroup>

        {/* Standard Criteria */}
        <FilterGroup title="Standard Criteria">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Beds Min</Label>
                <Input
                  type="number"
                  value={filters.bedsMin}
                  onChange={e => updateFilter("bedsMin", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Beds Max</Label>
                <Input
                  type="number"
                  value={filters.bedsMax}
                  onChange={e => updateFilter("bedsMax", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Baths Min</Label>
                <Input
                  type="number"
                  value={filters.bathsMin}
                  onChange={e => updateFilter("bathsMin", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Baths Max</Label>
                <Input
                  type="number"
                  value={filters.bathsMax}
                  onChange={e => updateFilter("bathsMax", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">SqFt Min</Label>
                <Input
                  type="number"
                  value={filters.sqftMin}
                  onChange={e => updateFilter("sqftMin", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SqFt Max</Label>
                <Input
                  type="number"
                  value={filters.sqftMax}
                  onChange={e => updateFilter("sqftMax", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Year Built Min</Label>
                <Input
                  type="number"
                  value={filters.yearBuiltMin}
                  onChange={e => updateFilter("yearBuiltMin", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Year Built Max</Label>
                <Input
                  type="number"
                  value={filters.yearBuiltMax}
                  onChange={e => updateFilter("yearBuiltMax", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Any"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Parking Spaces (Min)</Label>
              <Input
                type="number"
                value={filters.parkingMin}
                onChange={e => updateFilter("parkingMin", e.target.value)}
                className="h-7 text-xs"
                placeholder="Any"
              />
            </div>
          </div>
        </FilterGroup>

        {/* Price */}
        <FilterGroup title="Price">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Low</Label>
              <Input
                type="number"
                value={filters.priceMin}
                onChange={e => updateFilter("priceMin", e.target.value)}
                className="h-7 text-xs"
                placeholder="$0"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">High</Label>
              <Input
                type="number"
                value={filters.priceMax}
                onChange={e => updateFilter("priceMax", e.target.value)}
                className="h-7 text-xs"
                placeholder="No Max"
              />
            </div>
          </div>
        </FilterGroup>

        {/* Address */}
        <FilterGroup title="Address" defaultOpen={false}>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">St #</Label>
                <Input
                  value={filters.streetNumber}
                  onChange={e => updateFilter("streetNumber", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="123"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Street Name</Label>
                <Input
                  value={filters.streetName}
                  onChange={e => updateFilter("streetName", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Main St"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Zip Code</Label>
                <Input
                  value={filters.zipCode}
                  onChange={e => updateFilter("zipCode", e.target.value)}
                  className="h-7 text-xs"
                  placeholder="02101"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Radius (mi)</Label>
                <Select value={filters.radius} onValueChange={v => updateFilter("radius", v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Exact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Exact</SelectItem>
                    <SelectItem value="1">1 mile</SelectItem>
                    <SelectItem value="5">5 miles</SelectItem>
                    <SelectItem value="10">10 miles</SelectItem>
                    <SelectItem value="25">25 miles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </FilterGroup>

        {/* Towns */}
        <FilterGroup title="Towns">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select value={filters.state} onValueChange={v => updateFilter("state", v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">County</Label>
                <Select 
                  value={filters.county} 
                  onValueChange={v => updateFilter("county", v)}
                  disabled={!filters.state}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCounties.map(county => (
                      <SelectItem key={county.id} value={county.id}>
                        {county.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filters.state && townsList.length > 0 && (
              <div className="border rounded-md bg-background max-h-40 overflow-y-auto p-2 space-y-1">
                {townsList.map(town => (
                  <label key={town} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <Checkbox
                      checked={filters.selectedTowns.includes(town)}
                      onCheckedChange={() => handleTownSelect(town)}
                      className="h-3.5 w-3.5"
                    />
                    <span>{town}</span>
                  </label>
                ))}
              </div>
            )}
            {filters.selectedTowns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.selectedTowns.map(town => (
                  <span
                    key={town}
                    className="inline-flex items-center px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded cursor-pointer hover:bg-primary/20"
                    onClick={() => handleTownSelect(town)}
                  >
                    {town} ×
                  </span>
                ))}
              </div>
            )}
          </div>
        </FilterGroup>

        {/* Listing Events */}
        <FilterGroup title="Listing Events" defaultOpen={false}>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <Checkbox
                checked={filters.openHouse}
                onCheckedChange={checked => updateFilter("openHouse", !!checked)}
                className="h-3.5 w-3.5"
              />
              <span>Has Open House</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <Checkbox
                checked={filters.brokerTour}
                onCheckedChange={checked => updateFilter("brokerTour", !!checked)}
                className="h-3.5 w-3.5"
              />
              <span>Has Broker Tour</span>
            </label>
          </div>
        </FilterGroup>

        {/* Keywords */}
        <FilterGroup title="Keywords" defaultOpen={false}>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Include</Label>
              <Input
                value={filters.keywordsInclude}
                onChange={e => updateFilter("keywordsInclude", e.target.value)}
                className="h-7 text-xs"
                placeholder="pool, garage..."
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Exclude</Label>
              <Input
                value={filters.keywordsExclude}
                onChange={e => updateFilter("keywordsExclude", e.target.value)}
                className="h-7 text-xs"
                placeholder="basement, HOA..."
              />
            </div>
          </div>
        </FilterGroup>
      </div>
    </div>
  );
};

export default MLSPINFilterPanel;
