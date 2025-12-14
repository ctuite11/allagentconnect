import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  Search, 
  Home, 
  Calendar, 
  DollarSign, 
  MapPin, 
  Tag,
  Building,
  FileText
} from "lucide-react";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";

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
  statuses: ["new", "active", "price_changed", "back_on_market", "extended", "reactivated", "coming_soon", "private"],
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
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "price_changed", label: "Price Changed" },
  { value: "back_on_market", label: "Back on Market" },
  { value: "extended", label: "Extended" },
  { value: "reactivated", label: "Reactivated" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "private", label: "Private" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "pending", label: "Pending" },
  { value: "contingent", label: "Contingent" },
  { value: "temporarily_withdrawn", label: "Temporarily Withdrawn" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
  onSearch: () => void;
}

// Section Header Component - ALL rails use primary blue, icons use semantic colors
const SectionHeader = ({ 
  icon: Icon, 
  title, 
  isOpen, 
  onToggle,
  iconColor = "text-muted-foreground"
}: { 
  icon: React.ElementType; 
  title: string; 
  isOpen: boolean; 
  onToggle: () => void;
  iconColor?: string;
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-1.5 bg-muted/30 hover:bg-muted/50 transition-colors"
  >
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{title}</span>
    </div>
    {isOpen ? (
      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    )}
  </button>
);

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
  onSearch,
}: ListingSearchFiltersProps) => {
  const [townSearch, setTownSearch] = useState("");
  const [addressType, setAddressType] = useState<"street" | "location">("street");
  const [showAreas, setShowAreas] = useState(true);
  
  // Collapsible section states
  const [sectionsOpen, setSectionsOpen] = useState({
    propertyType: true,
    status: true,
    dateTimeframe: true,
    standardCriteria: true,
    address: true,
    towns: true,
    listingEvents: true,
    keywords: true,
    additionalCriteria: false,
  });

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

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  const toggleAllPropertyTypes = () => {
    if (filters.propertyTypes.length === PROPERTY_TYPES.length) {
      updateFilter("propertyTypes", []);
    } else {
      updateFilter("propertyTypes", PROPERTY_TYPES.map(p => p.value));
    }
  };

  const toggleStatus = (status: string) => {
    const current = filters.statuses;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter("statuses", updated);
  };

  const toggleAllStatuses = () => {
    if (filters.statuses.length === STATUSES.length) {
      updateFilter("statuses", []);
    } else {
      updateFilter("statuses", STATUSES.map(s => s.value));
    }
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

  const filteredCounties = counties.filter(c => c.state === filters.state);

  return (
    <div className="bg-card border border-border/60 rounded-lg p-3">
        {/* ROW 1: 3-Column Grid - Property Type (narrow) | Status+Date+Price (wide) | Standard Criteria */}
        <div className="flex gap-3 mb-3">
          
          {/* PROPERTY TYPE Section (narrow) */}
          <div className="w-[160px] shrink-0 bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
            <div className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border-b border-border/40">
              <Home className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Property Type</span>
            </div>
            <div className="p-2.5 space-y-1">
              <label className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors">
                <Checkbox
                  checked={filters.propertyTypes.length === PROPERTY_TYPES.length}
                  onCheckedChange={toggleAllPropertyTypes}
                  className="h-3 w-3"
                />
                <span className="text-[11px] font-medium text-foreground">Select All</span>
              </label>
              {PROPERTY_TYPES.map(type => (
                <label
                  key={type.value}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors"
                >
                  <Checkbox
                    checked={filters.propertyTypes.includes(type.value)}
                    onCheckedChange={() => togglePropertyType(type.value)}
                    className="h-3 w-3"
                  />
                  <span className="text-[11px] text-muted-foreground">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* MIDDLE SECTION: Status + Date/Timeframe + Price Range (wide, combined card) */}
          <div className="flex-1 bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
            {/* STATUS + DATE/TIMEFRAME Header */}
            <div className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border-b border-border/40">
              <Tag className="h-3.5 w-3.5 text-teal-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Status & Date</span>
            </div>
            
            {/* Top row: Status (left) + Date/Timeframe (right, vertically centered) */}
            <div className="p-2.5 flex gap-3">
              {/* STATUS Section - 2 columns, no scroll */}
              <div className="flex-1">
                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors mb-1">
                  <Checkbox
                    checked={filters.statuses.length === STATUSES.length}
                    onCheckedChange={toggleAllStatuses}
                    className="h-3 w-3"
                  />
                  <span className="text-[11px] font-medium text-foreground">Select All</span>
                </label>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {STATUSES.map(status => (
                    <label
                      key={status.value}
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors"
                    >
                      <Checkbox
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                        className="h-3 w-3"
                      />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* DATE/TIMEFRAME Section (right side, vertically centered) */}
              <div className="w-[170px] shrink-0 pl-3 border-l border-border/40 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Date / Timeframe</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">List Date</Label>
                    <Input
                      type="date"
                      value={filters.listDateFrom}
                      onChange={e => updateFilter("listDateFrom", e.target.value)}
                      className="h-6 text-[11px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Off-Market Timeframe</Label>
                    <Select 
                      value={filters.offMarketTimeframe} 
                      onValueChange={v => updateFilter("offMarketTimeframe", v)}
                    >
                      <SelectTrigger className="h-6 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3months">Today - 3 Months</SelectItem>
                        <SelectItem value="6months">Today - 6 Months</SelectItem>
                        <SelectItem value="12months">Today - 12 Months</SelectItem>
                        <SelectItem value="24months">Today - 24 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* PRICE RANGE Section (below Status+Date, full width within this card) */}
            <div className="px-2.5 py-2 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-green-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Price Range</span>
              </div>
              <div className="flex items-end gap-3">
                {/* Min Price */}
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min</Label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="100,000"
                        value={filters.hasNoMin ? "" : formatNumberWithCommas(filters.priceMin)}
                        onChange={e => updateFilter("priceMin", parseFormattedNumber(e.target.value))}
                        disabled={filters.hasNoMin}
                        className="h-6 text-[11px] pl-5 disabled:opacity-50"
                      />
                    </div>
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <Checkbox
                        checked={filters.hasNoMin}
                        onCheckedChange={(checked) => {
                          onFiltersChange({ 
                            ...filters, 
                            hasNoMin: !!checked,
                            priceMin: checked ? "" : filters.priceMin
                          });
                        }}
                        className="h-2.5 w-2.5"
                      />
                      <span className="text-[10px] text-muted-foreground">No Min</span>
                    </label>
                  </div>
                </div>
                {/* Max Price */}
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max</Label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="500,000"
                        value={filters.hasNoMax ? "" : formatNumberWithCommas(filters.priceMax)}
                        onChange={e => updateFilter("priceMax", parseFormattedNumber(e.target.value))}
                        disabled={filters.hasNoMax}
                        className="h-6 text-[11px] pl-5 disabled:opacity-50"
                      />
                    </div>
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <Checkbox
                        checked={filters.hasNoMax}
                        onCheckedChange={(checked) => {
                          onFiltersChange({ 
                            ...filters, 
                            hasNoMax: !!checked,
                            priceMax: checked ? "" : filters.priceMax
                          });
                        }}
                        className="h-2.5 w-2.5"
                      />
                      <span className="text-[10px] text-muted-foreground">No Max</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STANDARD SEARCH CRITERIA Section (right) */}
          <div className="w-[280px] shrink-0 bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
            <SectionHeader 
              icon={Building} 
              title="Standard Search Criteria" 
              isOpen={sectionsOpen.standardCriteria}
              onToggle={() => toggleSection("standardCriteria")}
              iconColor="text-purple-500"
            />
            {sectionsOpen.standardCriteria && (
              <div className="p-2.5 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Bedrooms</Label>
                    <Input
                      type="text"
                      placeholder="Min"
                      value={filters.bedsMin}
                      onChange={e => updateFilter("bedsMin", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Total Baths</Label>
                    <Input
                      type="text"
                      placeholder="Min"
                      value={filters.bathsMin}
                      onChange={e => updateFilter("bathsMin", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Rooms</Label>
                    <Input
                      type="text"
                      placeholder="Min"
                      value={filters.rooms}
                      onChange={e => updateFilter("rooms", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Acres</Label>
                    <Input
                      type="text"
                      placeholder="Min"
                      value={filters.acres}
                      onChange={e => updateFilter("acres", e.target.value)}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Living Area</Label>
                    <Input
                      type="text"
                      placeholder="Min SqFt"
                      value={filters.sqftMin}
                      onChange={e => updateFilter("sqftMin", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Price/SqFt</Label>
                    <Input
                      type="text"
                      placeholder="Max"
                      value={filters.pricePerSqFt}
                      onChange={e => updateFilter("pricePerSqFt", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Year Built</Label>
                    <Input
                      type="text"
                      placeholder="From"
                      value={filters.yearBuiltMin}
                      onChange={e => updateFilter("yearBuiltMin", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Parking</Label>
                    <Input
                      type="text"
                      placeholder="Min"
                      value={filters.parkingSpaces}
                      onChange={e => updateFilter("parkingSpaces", e.target.value.replace(/\D/g, ""))}
                      className="h-6 text-[11px] bg-background"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: ADDRESS Section (Full Width) */}
        <div className="bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden mb-3">
          <SectionHeader 
            icon={MapPin} 
            title="Address" 
            isOpen={sectionsOpen.address}
            onToggle={() => toggleSection("address")}
            iconColor="text-teal-500"
          />
          {sectionsOpen.address && (
            <div className="p-2.5">
              <RadioGroup 
                value={addressType} 
                onValueChange={(v) => setAddressType(v as "street" | "location")}
                className="flex items-center gap-3 mb-2"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="street" id="street" className="h-3 w-3" />
                  <Label htmlFor="street" className="text-[11px] text-foreground cursor-pointer">Street Address</Label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="location" id="location" className="h-3 w-3" />
                  <Label htmlFor="location" className="text-[11px] text-foreground cursor-pointer">My Location</Label>
                </div>
              </RadioGroup>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Street #</Label>
                  <Input
                    type="text"
                    placeholder=""
                    value={filters.streetNumber}
                    onChange={e => updateFilter("streetNumber", e.target.value)}
                    className="h-6 text-[11px] bg-background"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Street Name</Label>
                  <Input
                    type="text"
                    placeholder=""
                    value={filters.streetName}
                    onChange={e => updateFilter("streetName", e.target.value)}
                    className="h-6 text-[11px] bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Zip Code</Label>
                  <Input
                    type="text"
                    placeholder=""
                    value={filters.zipCode}
                    onChange={e => updateFilter("zipCode", e.target.value.replace(/\D/g, ""))}
                    className="h-6 text-[11px] bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Radius</Label>
                  <Input
                    type="text"
                    placeholder=""
                    value={filters.radius}
                    onChange={e => updateFilter("radius", e.target.value)}
                    className="h-6 text-[11px] bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Miles</Label>
                  <Select defaultValue="miles">
                    <SelectTrigger className="h-6 text-[11px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="miles">Miles</SelectItem>
                      <SelectItem value="km">Kilometers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ROW 3: 2-Column Grid for Towns + Events/Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          
          {/* TOWNS Section */}
          <div className="bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
            <SectionHeader 
              icon={MapPin} 
              title="Towns" 
              isOpen={sectionsOpen.towns}
              onToggle={() => toggleSection("towns")}
              iconColor="text-teal-500"
            />
            {sectionsOpen.towns && (
              <div className="p-2.5">
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">State</Label>
                    <Select value={filters.state} onValueChange={v => updateFilter("state", v)}>
                      <SelectTrigger className="h-6 text-[11px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="MA">MA</SelectItem>
                        <SelectItem value="NH">NH</SelectItem>
                        <SelectItem value="RI">RI</SelectItem>
                        <SelectItem value="CT">CT</SelectItem>
                        <SelectItem value="ME">ME</SelectItem>
                        <SelectItem value="VT">VT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">County</Label>
                    <Select 
                      value={filters.county || "all"} 
                      onValueChange={v => updateFilter("county", v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="h-6 text-[11px] bg-background">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="all">All Counties</SelectItem>
                        {filteredCounties.map(county => (
                          <SelectItem key={county.id} value={county.id}>{county.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">Areas</Label>
                    <div className="flex items-center gap-2 h-6">
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input 
                          type="radio" 
                          name="areas" 
                          checked={showAreas === true}
                          onChange={() => setShowAreas(true)}
                          className="h-2.5 w-2.5" 
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input 
                          type="radio" 
                          name="areas" 
                          checked={showAreas === false}
                          onChange={() => setShowAreas(false)}
                          className="h-2.5 w-2.5" 
                        />
                        No
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Two-column layout: Town Picker | Selected Towns */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Left Column: Town Picker */}
                  <div>
                    <div className="relative mb-1.5">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search towns..."
                        value={townSearch}
                        onChange={e => setTownSearch(e.target.value)}
                        className="h-6 text-[11px] bg-background pl-6"
                      />
                      {townSearch && (
                        <button 
                          onClick={() => setTownSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </div>
                    
                    <div className="min-h-[260px] max-h-[300px] border border-border/50 rounded bg-background overflow-y-auto p-1.5">
                      <button
                        onClick={addAllTowns}
                        className="w-full text-left px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted/50 rounded transition-colors font-medium mb-0.5"
                      >
                        - Add All Towns ({townsList.length}) -
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
                    </div>
                  </div>

                  {/* Right Column: Selected Towns */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[10px] text-muted-foreground">Selected Towns</Label>
                      {filters.selectedTowns.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 px-1 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => updateFilter("selectedTowns", [])}
                        >
                          Remove All
                        </Button>
                      )}
                    </div>
                    <div className="min-h-[260px] max-h-[300px] border border-border/50 rounded bg-background overflow-y-auto p-1.5">
                      {filters.selectedTowns.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic px-1.5 py-0.5">No towns selected</p>
                      ) : (
                        <div className="space-y-0">
                          {filters.selectedTowns.map(town => (
                            <button
                              key={town}
                              onClick={() => toggleTown(town)}
                              className="w-full text-left px-1.5 py-0.5 text-[11px] rounded transition-colors text-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-between group"
                            >
                              <span>{town}</span>
                              <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LISTING EVENTS + KEYWORDS Section */}
          <div className="space-y-3">
            {/* Listing Events */}
            <div className="bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
              <SectionHeader 
                icon={Calendar} 
                title="Listing Events" 
                isOpen={sectionsOpen.listingEvents}
                onToggle={() => toggleSection("listingEvents")}
                iconColor="text-amber-500"
              />
              {sectionsOpen.listingEvents && (
                <div className="p-2.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={filters.openHouses}
                      onCheckedChange={checked => updateFilter("openHouses", checked as boolean)}
                      className="h-3 w-3"
                    />
                    <span className="text-[11px] text-foreground">🎈 Open Houses</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={filters.brokerTours}
                      onCheckedChange={checked => updateFilter("brokerTours", checked as boolean)}
                      className="h-3 w-3"
                    />
                    <span className="text-[11px] text-foreground">🚗 Broker Tours</span>
                  </label>
                  <div className="pt-0.5">
                    <Label className="text-[10px] text-muted-foreground mb-0.5 block">For:</Label>
                    <Select 
                      value={filters.listingEventsTimeframe} 
                      onValueChange={v => updateFilter("listingEventsTimeframe", v)}
                    >
                      <SelectTrigger className="h-6 text-[11px] bg-background w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="3days">Next 3 Days</SelectItem>
                        <SelectItem value="7days">Next 7 Days</SelectItem>
                        <SelectItem value="14days">Next 14 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Keywords */}
            <div className="bg-card border border-border/50 border-l-[3px] border-l-primary rounded overflow-hidden">
              <SectionHeader 
                icon={FileText} 
                title="Keywords (Public Remarks only)" 
                isOpen={sectionsOpen.keywords}
                onToggle={() => toggleSection("keywords")}
                iconColor="text-purple-500"
              />
              {sectionsOpen.keywords && (
                <div className="p-2.5 space-y-1.5">
                  <div className="flex items-center gap-3 mb-1.5">
                    <RadioGroup 
                      value={filters.keywordMode} 
                      onValueChange={(v) => updateFilter("keywordMode", v as "any" | "all")}
                      className="flex items-center gap-2"
                    >
                      <div className="flex items-center gap-0.5">
                        <RadioGroupItem value="any" id="any" className="h-2.5 w-2.5" />
                        <Label htmlFor="any" className="text-[11px] text-foreground cursor-pointer">Any</Label>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <RadioGroupItem value="all" id="all" className="h-2.5 w-2.5" />
                        <Label htmlFor="all" className="text-[11px] text-foreground cursor-pointer">All</Label>
                      </div>
                    </RadioGroup>
                    <div className="border-l border-border/40 h-3" />
                    <RadioGroup 
                      value={filters.keywordType} 
                      onValueChange={(v) => updateFilter("keywordType", v as "include" | "exclude")}
                      className="flex items-center gap-2"
                    >
                      <div className="flex items-center gap-0.5">
                        <RadioGroupItem value="include" id="include" className="h-2.5 w-2.5" />
                        <Label htmlFor="include" className="text-[11px] text-foreground cursor-pointer">Include</Label>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <RadioGroupItem value="exclude" id="exclude" className="h-2.5 w-2.5" />
                        <Label htmlFor="exclude" className="text-[11px] text-foreground cursor-pointer">Exclude</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Input
                    type="text"
                    placeholder="Enter keywords separated by commas..."
                    value={filters.keywordType === "include" ? filters.keywordsInclude : filters.keywordsExclude}
                    onChange={e => updateFilter(
                      filters.keywordType === "include" ? "keywordsInclude" : "keywordsExclude", 
                      e.target.value
                    )}
                    className="h-6 text-[11px] bg-background"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            {filters.selectedTowns.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {filters.selectedTowns.length} towns
              </Badge>
            )}
            {filters.propertyTypes.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {filters.propertyTypes.length} types
              </Badge>
            )}
            {filters.statuses.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {filters.statuses.length} statuses
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange(initialFilters)}
            className="h-6 text-[11px] px-2"
          >
            Clear All
          </Button>
        </div>
      </div>
  );
};

export default ListingSearchFilters;
