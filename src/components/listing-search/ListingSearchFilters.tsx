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
  statuses: ["active", "new", "price_changed", "back_on_market", "coming_soon"],
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
  { value: "under_agreement", label: "Under Agreement" },
  { value: "rented", label: "Rented" },
  { value: "contingent", label: "Contingent" },
  { value: "temporarily_withdrawn", label: "Temporarily Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
  { value: "reactivated", label: "Reactivated" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "sold", label: "Sold" },
];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
  onSearch: () => void;
}

// Section accent colors - straight 4px vertical bars, no curves
const ACCENT_COLORS = {
  propertyType: "#0E90FF",
  status: "#33C48F",
  priceRange: "#0FBF5B",
  dateTimeframe: "#FFA31A",
  standardCriteria: "#BB32FF",
  address: "#0FBF5B",
  towns: "#0E90FF",
  listingEvents: "#FFA31A",
  keywords: "#BB32FF",
};

// Section Header Component with straight 4px left accent bar
const SectionHeader = ({ 
  icon: Icon, 
  title, 
  isOpen, 
  onToggle,
  accentColor
}: { 
  icon: React.ElementType; 
  title: string; 
  isOpen: boolean; 
  onToggle: () => void;
  accentColor: string;
}) => {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-2.5 bg-card hover:bg-muted/50 transition-colors"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
};

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
  onSearch,
}: ListingSearchFiltersProps) => {
  const [townSearch, setTownSearch] = useState("");
  const [addressType, setAddressType] = useState<"street" | "location">("street");
  
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
    const allTowns = getAvailableTowns();
    updateFilter("selectedTowns", [...new Set([...filters.selectedTowns, ...allTowns])]);
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

  return (
    <div className="bg-muted/30 border-b border-border">
      <div className="container mx-auto px-4 py-4">
        {/* ROW 1: 3-Column Grid - Property Type (narrow) | Status+Date+Price (wide) | Standard Criteria */}
        <div className="flex gap-4 mb-4">
          
          {/* PROPERTY TYPE Section (narrow) */}
          <div 
            className="w-[160px] shrink-0 bg-card border border-border shadow-sm overflow-hidden"
            style={{ borderLeft: `4px solid ${ACCENT_COLORS.propertyType}` }}
          >
            <div className="px-5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Property Type</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors">
                <Checkbox
                  checked={filters.propertyTypes.length === PROPERTY_TYPES.length}
                  onCheckedChange={toggleAllPropertyTypes}
                  className="h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Select All</span>
              </label>
              <div className="border-t border-border my-2" />
              {PROPERTY_TYPES.map(type => (
                <label
                  key={type.value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors"
                >
                  <Checkbox
                    checked={filters.propertyTypes.includes(type.value)}
                    onCheckedChange={() => togglePropertyType(type.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-foreground">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* MIDDLE SECTION: Status + Date/Timeframe + Price Range (wide, combined card) */}
          <div className="flex-1 bg-card border border-border shadow-sm overflow-hidden">
            {/* STATUS Section */}
            <div 
              className="px-5 py-2.5 border-b border-border"
              style={{ borderLeft: `4px solid ${ACCENT_COLORS.status}` }}
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Status</span>
              </div>
            </div>
            
            {/* Top row: Status (left) + Date/Timeframe (right) */}
            <div className="p-4 flex gap-6">
              {/* STATUS Section - 2 columns, no scroll */}
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors mb-2">
                  <Checkbox
                    checked={filters.statuses.length === STATUSES.length}
                    onCheckedChange={toggleAllStatuses}
                    className="h-4 w-4"
                  />
                  <span className="text-xs font-medium text-foreground">Select All</span>
                </label>
                <div className="border-t border-border my-2" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {STATUSES.map(status => (
                    <label
                      key={status.value}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors"
                    >
                      <Checkbox
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-foreground whitespace-nowrap">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* DATE/TIMEFRAME Section (right side) */}
              <div 
                className="w-[200px] shrink-0 pl-5"
                style={{ borderLeft: `4px solid ${ACCENT_COLORS.dateTimeframe}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4" style={{ color: ACCENT_COLORS.dateTimeframe }} />
                  <span className="text-sm font-semibold text-foreground">Date / Timeframe</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">List Date</Label>
                    <Input
                      type="date"
                      value={filters.listDateFrom}
                      onChange={e => updateFilter("listDateFrom", e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Off-Market Timeframe</Label>
                    <Select 
                      value={filters.offMarketTimeframe} 
                      onValueChange={v => updateFilter("offMarketTimeframe", v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
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
            <div 
              className="border-t border-border px-5 py-4"
              style={{ borderLeft: `4px solid ${ACCENT_COLORS.priceRange}` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4" style={{ color: ACCENT_COLORS.priceRange }} />
                <span className="text-sm font-semibold text-foreground">Price Range</span>
              </div>
              <div className="flex items-end gap-6">
                {/* Min Price */}
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="100,000"
                        value={filters.hasNoMin ? "" : formatNumberWithCommas(filters.priceMin)}
                        onChange={e => updateFilter("priceMin", parseFormattedNumber(e.target.value))}
                        disabled={filters.hasNoMin}
                        className="h-8 text-xs bg-background pl-6 disabled:opacity-50"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                      <Checkbox
                        checked={filters.hasNoMin}
                        onCheckedChange={(checked) => {
                          onFiltersChange({ 
                            ...filters, 
                            hasNoMin: !!checked,
                            priceMin: checked ? "" : filters.priceMin
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-muted-foreground">No Minimum</span>
                    </label>
                  </div>
                </div>
                {/* Max Price */}
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="500,000"
                        value={filters.hasNoMax ? "" : formatNumberWithCommas(filters.priceMax)}
                        onChange={e => updateFilter("priceMax", parseFormattedNumber(e.target.value))}
                        disabled={filters.hasNoMax}
                        className="h-8 text-xs bg-background pl-6 disabled:opacity-50"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                      <Checkbox
                        checked={filters.hasNoMax}
                        onCheckedChange={(checked) => {
                          onFiltersChange({ 
                            ...filters, 
                            hasNoMax: !!checked,
                            priceMax: checked ? "" : filters.priceMax
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-muted-foreground">No Maximum</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STANDARD SEARCH CRITERIA Section (right) */}
          <div 
            className="w-[280px] shrink-0 bg-card border border-border shadow-sm overflow-hidden"
            style={{ borderLeft: `4px solid ${ACCENT_COLORS.standardCriteria}` }}
          >
            <div className="px-5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Standard Search Criteria</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Bedrooms</Label>
                  <Input
                    type="text"
                    placeholder="Min"
                    value={filters.bedsMin}
                    onChange={e => updateFilter("bedsMin", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Total Baths</Label>
                  <Input
                    type="text"
                    placeholder="Min"
                    value={filters.bathsMin}
                    onChange={e => updateFilter("bathsMin", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Rooms</Label>
                  <Input
                    type="text"
                    placeholder="Min"
                    value={filters.rooms}
                    onChange={e => updateFilter("rooms", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Acres</Label>
                  <Input
                    type="text"
                    placeholder="Min"
                    value={filters.acres}
                    onChange={e => updateFilter("acres", e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Living Area</Label>
                  <Input
                    type="text"
                    placeholder="Min SqFt"
                    value={filters.sqftMin}
                    onChange={e => updateFilter("sqftMin", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Price/SqFt</Label>
                  <Input
                    type="text"
                    placeholder="Max"
                    value={filters.pricePerSqFt}
                    onChange={e => updateFilter("pricePerSqFt", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Year Built</Label>
                  <Input
                    type="text"
                    placeholder="From"
                    value={filters.yearBuiltMin}
                    onChange={e => updateFilter("yearBuiltMin", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Parking</Label>
                  <Input
                    type="text"
                    placeholder="Min"
                    value={filters.parkingSpaces}
                    onChange={e => updateFilter("parkingSpaces", e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: ADDRESS Section (Full Width) */}
        <div 
          className="bg-card border border-border shadow-sm overflow-hidden mb-4"
          style={{ borderLeft: `4px solid ${ACCENT_COLORS.address}` }}
        >
          <div className="px-5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Address</span>
            </div>
          </div>
          <div className="p-4">
            <RadioGroup 
              value={addressType} 
              onValueChange={(v) => setAddressType(v as "street" | "location")}
              className="flex items-center gap-4 mb-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="street" id="street" className="h-4 w-4" />
                <Label htmlFor="street" className="text-xs text-foreground cursor-pointer">Street Address</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="location" id="location" className="h-4 w-4" />
                <Label htmlFor="location" className="text-xs text-foreground cursor-pointer">My Location</Label>
              </div>
            </RadioGroup>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Street #</Label>
                <Input
                  type="text"
                  placeholder=""
                  value={filters.streetNumber}
                  onChange={e => updateFilter("streetNumber", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Street Name</Label>
                <Input
                  type="text"
                  placeholder=""
                  value={filters.streetName}
                  onChange={e => updateFilter("streetName", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Zip Code</Label>
                <Input
                  type="text"
                  placeholder=""
                  value={filters.zipCode}
                  onChange={e => updateFilter("zipCode", e.target.value.replace(/\D/g, ""))}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Radius</Label>
                <Input
                  type="text"
                  placeholder=""
                  value={filters.radius}
                  onChange={e => updateFilter("radius", e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Miles</Label>
                <Select defaultValue="miles">
                  <SelectTrigger className="h-8 text-xs bg-background">
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
        </div>

        {/* ROW 3: 2-Column Grid for Towns + Events/Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
          {/* TOWNS Section */}
          <div 
            className="bg-card border border-border shadow-sm overflow-hidden"
            style={{ borderLeft: `4px solid ${ACCENT_COLORS.towns}` }}
          >
            <div className="px-5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Towns</span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">State</Label>
                  <Select value={filters.state} onValueChange={v => updateFilter("state", v)}>
                    <SelectTrigger className="h-8 text-xs bg-background">
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
                  <Label className="text-xs text-muted-foreground mb-1 block">County</Label>
                  <Select 
                    value={filters.county || "all"} 
                    onValueChange={v => updateFilter("county", v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
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
                  <Label className="text-xs text-muted-foreground mb-1 block">Areas</Label>
                  <div className="flex items-center gap-3 h-8">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="radio" name="areas" defaultChecked className="h-4 w-4" />
                      Yes
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="radio" name="areas" className="h-4 w-4" />
                      No
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search towns..."
                  value={townSearch}
                  onChange={e => setTownSearch(e.target.value)}
                  className="h-8 text-xs bg-background pl-8"
                />
                {townSearch && (
                  <button 
                    onClick={() => setTownSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              
              <ScrollArea className="h-[150px] border border-border bg-background">
                <div className="p-2 space-y-0.5">
                  <button
                    onClick={addAllTowns}
                    className="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-muted transition-colors font-medium"
                  >
                    - Add All Towns -
                  </button>
                  {filteredTowns.map(town => (
                    <button
                      key={town}
                      onClick={() => toggleTown(town)}
                      className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                        filters.selectedTowns.includes(town) 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {town}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {/* Selected Towns Display */}
              {filters.selectedTowns.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Selected Towns</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => updateFilter("selectedTowns", [])}
                    >
                      Remove All
                    </Button>
                  </div>
                  <div className="border border-border bg-background p-2 max-h-[80px] overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {filters.selectedTowns.map(town => (
                        <Badge
                          key={town}
                          variant="secondary"
                          className="h-6 px-2 gap-1 text-xs font-normal cursor-pointer hover:bg-destructive/10"
                          onClick={() => toggleTown(town)}
                        >
                          {town}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LISTING EVENTS + KEYWORDS Section */}
          <div className="space-y-4">
            {/* Listing Events */}
            <div 
              className="bg-card border border-border shadow-sm overflow-hidden"
              style={{ borderLeft: `4px solid ${ACCENT_COLORS.listingEvents}` }}
            >
              <div className="px-5 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Listing Events</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors">
                  <Checkbox
                    checked={filters.openHouses}
                    onCheckedChange={checked => updateFilter("openHouses", checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-foreground">🎈 Open Houses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-1 rounded transition-colors">
                  <Checkbox
                    checked={filters.brokerTours}
                    onCheckedChange={checked => updateFilter("brokerTours", checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-foreground">🚗 Broker Tours</span>
                </label>
                <div className="pt-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">For:</Label>
                  <Select 
                    value={filters.listingEventsTimeframe} 
                    onValueChange={v => updateFilter("listingEventsTimeframe", v)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background w-40">
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
            </div>

            {/* Keywords */}
            <div 
              className="bg-card border border-border shadow-sm overflow-hidden"
              style={{ borderLeft: `4px solid ${ACCENT_COLORS.keywords}` }}
            >
              <div className="px-5 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Keywords (Public Remarks only)</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <RadioGroup 
                    value={filters.keywordMode} 
                    onValueChange={(v) => updateFilter("keywordMode", v as "any" | "all")}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="any" id="any" className="h-4 w-4" />
                      <Label htmlFor="any" className="text-xs text-foreground cursor-pointer">Any</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="all" id="all" className="h-4 w-4" />
                      <Label htmlFor="all" className="text-xs text-foreground cursor-pointer">All</Label>
                    </div>
                  </RadioGroup>
                  <div className="border-l border-border h-4" />
                  <RadioGroup 
                    value={filters.keywordType} 
                    onValueChange={(v) => updateFilter("keywordType", v as "include" | "exclude")}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="include" id="include" className="h-4 w-4" />
                      <Label htmlFor="include" className="text-xs text-foreground cursor-pointer">Include</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="exclude" id="exclude" className="h-4 w-4" />
                      <Label htmlFor="exclude" className="text-xs text-foreground cursor-pointer">Exclude</Label>
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
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            {filters.selectedTowns.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.selectedTowns.length} towns selected
              </Badge>
            )}
            {filters.propertyTypes.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.propertyTypes.length} property types
              </Badge>
            )}
            {filters.statuses.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.statuses.length} statuses
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange(initialFilters)}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
            <Button 
              onClick={onSearch}
              className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingSearchFilters;
