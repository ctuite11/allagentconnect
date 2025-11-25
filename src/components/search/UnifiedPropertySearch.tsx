import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Home, Building2, Users, MapPin, DollarSign, Bed, Bath, Calendar, Waves, Eye } from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { cn } from "@/lib/utils";

export interface SearchCriteria {
  // Location
  state?: string;
  county?: string;
  towns?: string[];
  zipCode?: string;
  showAreas?: boolean;
  
  // Property Type
  propertyTypes?: string[];
  
  // Price
  minPrice?: string;
  maxPrice?: string;
  
  // Beds/Baths
  bedrooms?: string;
  bathrooms?: string;
  
  // Status
  statuses?: string[];
  
  // Advanced
  minLivingArea?: string;
  maxLivingArea?: string;
  minLotSize?: string;
  maxLotSize?: string;
  garageSpaces?: string;
  parkingSpaces?: string;
  minYearBuilt?: string;
  maxYearBuilt?: string;
  maxCondoFee?: string;
  waterfront?: boolean;
  waterView?: boolean;
  hasBasement?: boolean;
  propertyStyle?: string;
  hasHOA?: string;
  
  // Keywords
  keywords?: string;
  keywordMatch?: "any" | "all";
  keywordType?: "include" | "exclude";
}

interface UnifiedPropertySearchProps {
  criteria: SearchCriteria;
  onCriteriaChange: (criteria: SearchCriteria) => void;
  resultsCount?: number;
  showResultsCount?: boolean;
  onSearch?: () => void;
  onClear?: () => void;
  mode?: "agent" | "consumer";
}

const PROPERTY_TYPES = [
  { value: "Single Family", label: "Single Family", icon: Home },
  { value: "Condominium", label: "Condo", icon: Building2 },
  { value: "Multi Family", label: "Multi-Family", icon: Users },
  { value: "Land", label: "Land", icon: MapPin },
  { value: "Commercial", label: "Commercial", icon: Building2 },
  { value: "Business Opp.", label: "Business Opportunity", icon: DollarSign },
  { value: "Mobile Home", label: "Mobile Home", icon: Home },
  { value: "Residential Rental", label: "Residential Rental", icon: Home },
];

const AGENT_STATUSES = [
  { value: "new", label: "New" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "active", label: "Active" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "contingent", label: "Contingent" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold", label: "Sold" },
  { value: "expired", label: "Expired" },
  { value: "extended", label: "Extended" },
  { value: "price_changed", label: "Price Change" },
  { value: "temp_withdrawn", label: "Temp Withdrawn" },
  { value: "canceled", label: "Canceled" },
];

const CONSUMER_STATUSES = [
  { value: "new", label: "New" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "active", label: "Active" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "contingent", label: "Contingent" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "price_changed", label: "Price Change" },
];

const DEFAULT_STATUSES = ["new", "coming_soon", "active", "back_on_market"];

const PRICE_SUGGESTIONS = [
  { label: "$100K", value: "100000" },
  { label: "$250K", value: "250000" },
  { label: "$500K", value: "500000" },
  { label: "$750K", value: "750000" },
  { label: "$1M", value: "1000000" },
  { label: "$1.5M", value: "1500000" },
  { label: "$2M", value: "2000000" },
];

const BED_BATH_OPTIONS = ["0+", "1+", "2+", "3+", "4+", "5+"];

export const UnifiedPropertySearch = ({
  criteria,
  onCriteriaChange,
  resultsCount,
  showResultsCount = true,
  onSearch,
  onClear,
  mode = "consumer",
}: UnifiedPropertySearchProps) => {
  const STATUSES = mode === "agent" ? AGENT_STATUSES : CONSUMER_STATUSES;
  
  const [isLocationOpen, setIsLocationOpen] = useState(true);
  const [isPropertyTypeOpen, setIsPropertyTypeOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isBedsOpen, setIsBedsOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isKeywordsOpen, setIsKeywordsOpen] = useState(false);
  const [townSearchQuery, setTownSearchQuery] = useState("");

  // Initialize default statuses if not set
  useEffect(() => {
    if (!criteria.statuses || criteria.statuses.length === 0) {
      updateCriteria({ statuses: DEFAULT_STATUSES });
    }
  }, []);

  const updateCriteria = (updates: Partial<SearchCriteria>) => {
    onCriteriaChange({ ...criteria, ...updates });
  };

  const togglePropertyType = (type: string) => {
    const current = criteria.propertyTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateCriteria({ propertyTypes: updated });
  };

  const toggleStatus = (status: string) => {
    const current = criteria.statuses || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    updateCriteria({ statuses: updated });
  };

  const handleSelectAllTypes = () => {
    const allTypes = PROPERTY_TYPES.map((t) => t.value);
    const current = criteria.propertyTypes || [];
    updateCriteria({
      propertyTypes: current.length === allTypes.length ? [] : allTypes,
    });
  };

  const handleSelectAllStatuses = () => {
    const allStatuses = STATUSES.map((s) => s.value);
    const current = criteria.statuses || [];
    updateCriteria({
      statuses: current.length === allStatuses.length ? [] : allStatuses,
    });
  };

  const handleClearAll = () => {
    onCriteriaChange({
      statuses: DEFAULT_STATUSES,
      propertyTypes: [],
      towns: [],
      state: "MA",
    });
    if (onClear) onClear();
  };

  // Town picker hook
  const state = criteria.state || "MA";
  const county = criteria.county || "all";
  const showAreas = criteria.showAreas ? "yes" : "no";

  const { townsList, expandedCities, toggleCityExpansion, hasCountyData } = useTownsPicker({
    state,
    county,
    showAreas,
  });

  const currentStateCounties = getCountiesForState(state);
  const selectedTowns = criteria.towns || [];

  const toggleTown = (town: string) => {
    const current = criteria.towns || [];
    const updated = current.includes(town)
      ? current.filter((t) => t !== town)
      : [...current, town];
    updateCriteria({ towns: updated });
  };

  // Check if Boston is selected and show neighborhood badge
  const isBostonSelected = selectedTowns.includes("Boston");

  return (
    <div className="space-y-3">
      {/* Results Count */}
      {showResultsCount && resultsCount !== undefined && (
        <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">{resultsCount}</span>
            <span className="text-muted-foreground">Results</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
            {onSearch && (
              <Button size="sm" onClick={onSearch}>
                Search
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      <Collapsible open={isLocationOpen} onOpenChange={setIsLocationOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">LOCATION</h3>
            </div>
            {isLocationOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              {/* State Selection */}
              <div className="space-y-2">
                <Label>State</Label>
                <Select
                  value={state}
                  onValueChange={(value) => updateCriteria({ state: value, county: "all", towns: [] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* County Selection - Agent mode only */}
              {mode === "agent" && hasCountyData && (
                <div className="space-y-2">
                  <Label>County</Label>
                  <Select value={county} onValueChange={(value) => updateCriteria({ county: value, towns: [] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Counties</SelectItem>
                      {currentStateCounties.map((countyName) => (
                        <SelectItem key={countyName} value={countyName}>
                          {countyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Zip Code */}
              <div className="space-y-2">
                <Label>Zip Code</Label>
                <Input
                  placeholder="Enter zip code"
                  value={criteria.zipCode || ""}
                  onChange={(e) => updateCriteria({ zipCode: e.target.value })}
                />
              </div>

              {/* Show Areas Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showAreas"
                  checked={criteria.showAreas !== false}
                  onCheckedChange={(checked) => updateCriteria({ showAreas: !!checked })}
                />
                <label htmlFor="showAreas" className="text-sm cursor-pointer">
                  Include neighborhoods/areas
                </label>
              </div>

              {/* Boston Badge */}
              {isBostonSelected && (
                <Badge variant="secondary" className="w-full justify-center py-2">
                  Selecting Boston includes all neighborhoods unless you select specific ones
                </Badge>
              )}

              {/* Towns Picker */}
              <div className="space-y-2">
                <Label>Towns & Cities</Label>
                <Input
                  placeholder="Type full or partial name to filter..."
                  value={townSearchQuery}
                  onChange={(e) => setTownSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <TownsPicker
                    towns={townsList}
                    selectedTowns={selectedTowns}
                    onToggleTown={toggleTown}
                    expandedCities={expandedCities}
                    onToggleCityExpansion={toggleCityExpansion}
                    state={state}
                    searchQuery={townSearchQuery}
                    variant="checkbox"
                    showAreas={criteria.showAreas !== false}
                    showSelectAll={true}
                    onSelectAll={() => {
                      const allTopLevelTowns = townsList.filter(t => !t.includes('-'));
                      const allSelected = allTopLevelTowns.every(t => selectedTowns.includes(t));
                      updateCriteria({ towns: allSelected ? [] : allTopLevelTowns });
                    }}
                  />
                </div>
                
                {/* Selected Towns Summary */}
                {selectedTowns.length > 0 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Selected: {selectedTowns.length} location{selectedTowns.length !== 1 ? 's' : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => updateCriteria({ towns: [] })}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {selectedTowns.map((town) => (
                        <div
                          key={town}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-xs"
                        >
                          <span>{town.includes('-') ? town.split('-')[1] : town}</span>
                          <button
                            type="button"
                            onClick={() => toggleTown(town)}
                            className="hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Property Type */}
      <Collapsible open={isPropertyTypeOpen} onOpenChange={setIsPropertyTypeOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">PROPERTY TYPE</h3>
            </div>
            {isPropertyTypeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-3 border-t">
              {/* Select All */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-select-all"
                  checked={(criteria.propertyTypes || []).length === PROPERTY_TYPES.length}
                  onCheckedChange={handleSelectAllTypes}
                />
                <label htmlFor="type-select-all" className="text-sm font-medium cursor-pointer">
                  Select All
                </label>
              </div>

              {/* Property Types Grid */}
              <div className="grid grid-cols-2 gap-3">
                {PROPERTY_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = (criteria.propertyTypes || []).includes(type.value);
                  return (
                    <div
                      key={type.value}
                      onClick={() => togglePropertyType(type.value)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      )}
                    >
                      <Checkbox checked={isSelected} />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{type.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Price */}
      <Collapsible open={isPriceOpen} onOpenChange={setIsPriceOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">PRICE</h3>
            </div>
            {isPriceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Price</Label>
                  <Input
                    type="number"
                    placeholder="No min"
                    value={criteria.minPrice || ""}
                    onChange={(e) => updateCriteria({ minPrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Price</Label>
                  <Input
                    type="number"
                    placeholder="No max"
                    value={criteria.maxPrice || ""}
                    onChange={(e) => updateCriteria({ maxPrice: e.target.value })}
                  />
                </div>
              </div>

              {/* Price Suggestions */}
              <div className="flex flex-wrap gap-2">
                {PRICE_SUGGESTIONS.map((price) => (
                  <Button
                    key={price.value}
                    variant="outline"
                    size="sm"
                    onClick={() => updateCriteria({ maxPrice: price.value })}
                  >
                    {price.label}
                  </Button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Beds & Baths */}
      <Collapsible open={isBedsOpen} onOpenChange={setIsBedsOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">BEDS & BATHS</h3>
            </div>
            {isBedsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              {/* Bedrooms */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bed className="h-4 w-4" />
                  Bedrooms
                </Label>
                <ToggleGroup
                  type="single"
                  value={criteria.bedrooms || ""}
                  onValueChange={(value) => updateCriteria({ bedrooms: value })}
                  className="justify-start flex-wrap"
                >
                  {BED_BATH_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option} value={option.replace("+", "")} variant="outline" size="sm">
                      {option}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Bathrooms */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bath className="h-4 w-4" />
                  Bathrooms
                </Label>
                <ToggleGroup
                  type="single"
                  value={criteria.bathrooms || ""}
                  onValueChange={(value) => updateCriteria({ bathrooms: value })}
                  className="justify-start flex-wrap"
                >
                  {BED_BATH_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option} value={option.replace("+", "")} variant="outline" size="sm">
                      {option}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Status */}
      <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">STATUS</span>
            </div>
            {isStatusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-3 border-t">
              {/* Select All */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-select-all"
                  checked={(criteria.statuses || []).length === STATUSES.length}
                  onCheckedChange={handleSelectAllStatuses}
                />
                <label htmlFor="status-select-all" className="text-sm font-medium cursor-pointer">
                  Select All
                </label>
              </div>

              {/* Status Checkboxes */}
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={(criteria.statuses || []).includes(status.value)}
                      onCheckedChange={() => toggleStatus(status.value)}
                    />
                    <label
                      htmlFor={`status-${status.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {status.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Advanced Filters */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <h3 className="font-semibold text-sm">ADVANCED FILTERS</h3>
            {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              {/* Living Area */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Living Area (sqft)</Label>
                  <Input
                    type="number"
                    placeholder="No min"
                    value={criteria.minLivingArea || ""}
                    onChange={(e) => updateCriteria({ minLivingArea: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Living Area (sqft)</Label>
                  <Input
                    type="number"
                    placeholder="No max"
                    value={criteria.maxLivingArea || ""}
                    onChange={(e) => updateCriteria({ maxLivingArea: e.target.value })}
                  />
                </div>
              </div>

              {/* Lot Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Lot Size (acres)</Label>
                  <Input
                    type="number"
                    placeholder="No min"
                    value={criteria.minLotSize || ""}
                    onChange={(e) => updateCriteria({ minLotSize: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Lot Size (acres)</Label>
                  <Input
                    type="number"
                    placeholder="No max"
                    value={criteria.maxLotSize || ""}
                    onChange={(e) => updateCriteria({ maxLotSize: e.target.value })}
                  />
                </div>
              </div>

              {/* Parking & Garage */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Garage Spaces</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={criteria.garageSpaces || ""}
                    onChange={(e) => updateCriteria({ garageSpaces: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parking Spaces</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={criteria.parkingSpaces || ""}
                    onChange={(e) => updateCriteria({ parkingSpaces: e.target.value })}
                  />
                </div>
              </div>

              {/* Year Built */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Min Year Built
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1990"
                    value={criteria.minYearBuilt || ""}
                    onChange={(e) => updateCriteria({ minYearBuilt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Max Year Built
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 2024"
                    value={criteria.maxYearBuilt || ""}
                    onChange={(e) => updateCriteria({ maxYearBuilt: e.target.value })}
                  />
                </div>
              </div>

              {/* Condo Fee */}
              <div className="space-y-2">
                <Label>Max Condo Fee</Label>
                <Input
                  type="number"
                  placeholder="No max"
                  value={criteria.maxCondoFee || ""}
                  onChange={(e) => updateCriteria({ maxCondoFee: e.target.value })}
                />
              </div>

              {/* Features */}
              <div className="space-y-3">
                <Label>Features</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="waterfront"
                      checked={criteria.waterfront || false}
                      onCheckedChange={(checked) => updateCriteria({ waterfront: !!checked })}
                    />
                    <label htmlFor="waterfront" className="text-sm cursor-pointer flex items-center gap-2">
                      <Waves className="h-4 w-4" />
                      Waterfront
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="waterView"
                      checked={criteria.waterView || false}
                      onCheckedChange={(checked) => updateCriteria({ waterView: !!checked })}
                    />
                    <label htmlFor="waterView" className="text-sm cursor-pointer flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Water View
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasBasement"
                      checked={criteria.hasBasement || false}
                      onCheckedChange={(checked) => updateCriteria({ hasBasement: !!checked })}
                    />
                    <label htmlFor="hasBasement" className="text-sm cursor-pointer">
                      Basement
                    </label>
                  </div>
                </div>
              </div>

              {/* HOA */}
              <div className="space-y-2">
                <Label>HOA</Label>
                <Select
                  value={criteria.hasHOA || "any"}
                  onValueChange={(value) => updateCriteria({ hasHOA: value === "any" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Keywords */}
      <Collapsible open={isKeywordsOpen} onOpenChange={setIsKeywordsOpen}>
        <div className="bg-card rounded-lg shadow-sm border">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 transition-colors">
            <h3 className="font-semibold text-sm">KEYWORD SEARCH</h3>
            {isKeywordsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">
              <div className="space-y-2">
                <Label>Keywords</Label>
                <Input
                  placeholder="Enter keywords..."
                  value={criteria.keywords || ""}
                  onChange={(e) => updateCriteria({ keywords: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Match Type</Label>
                  <Select
                    value={criteria.keywordMatch || "any"}
                    onValueChange={(value: "any" | "all") => updateCriteria({ keywordMatch: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">ANY (match any word)</SelectItem>
                      <SelectItem value="all">ALL (match all words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Keyword Type</Label>
                  <Select
                    value={criteria.keywordType || "include"}
                    onValueChange={(value: "include" | "exclude") => updateCriteria({ keywordType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">INCLUDE</SelectItem>
                      <SelectItem value="exclude">EXCLUDE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Map Placeholder */}
      <div className="bg-card rounded-lg shadow-sm border p-6 text-center">
        <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Map view will be available in future release.
        </p>
      </div>
    </div>
  );
};
