import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X, Search, Minus, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
}

export const initialFilters: FilterState = {
  propertyTypes: [],
  statuses: ["new", "active", "price_changed", "back_on_market", "extended", "reactivated"],
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
};

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family", code: "SF" },
  { value: "condo", label: "Condominium", code: "CC" },
  { value: "multi_family", label: "Multi Family", code: "MF" },
  { value: "land", label: "Land", code: "LD" },
  { value: "commercial", label: "Commercial", code: "CI" },
  { value: "business", label: "Business Opp.", code: "BU" },
  { value: "residential_rental", label: "Residential Rental", code: "RN" },
  { value: "mobile_home", label: "Mobile Home", code: "MH" },
];

const STATUSES_LEFT = [
  { value: "new", label: "New", code: "NEW" },
  { value: "active", label: "Active", code: "ACT" },
  { value: "price_changed", label: "Price Changed", code: "PCG" },
  { value: "back_on_market", label: "Back on Market", code: "BOM" },
  { value: "extended", label: "Extended", code: "EXT" },
  { value: "reactivated", label: "Reactivated", code: "RAC" },
  { value: "contingent", label: "Contingent", code: "CTG" },
];

const STATUSES_RIGHT = [
  { value: "under_agreement", label: "Under Agreement", code: "UAG" },
  { value: "sold", label: "Sold", code: "SLD" },
  { value: "rented", label: "Rented", code: "RNT" },
  { value: "withdrawn", label: "Temporarily Withdrawn", code: "WDN" },
  { value: "expired", label: "Expired", code: "EXP" },
  { value: "cancelled", label: "Canceled", code: "CAN" },
  { value: "coming_soon", label: "Coming Soon", code: "CSO" },
];

const ALL_STATUSES = [...STATUSES_LEFT, ...STATUSES_RIGHT];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
}

// MLS-style section header component
const SectionHeader = ({ 
  title, 
  isOpen, 
  onToggle,
  className = ""
}: { 
  title: string; 
  isOpen?: boolean; 
  onToggle?: () => void;
  className?: string;
}) => (
  <div 
    className={`bg-amber-400 px-2 py-1 flex items-center justify-between cursor-pointer select-none ${className}`}
    onClick={onToggle}
  >
    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{title}</span>
    {onToggle && (
      isOpen ? <Minus className="h-3 w-3 text-slate-700" /> : <Plus className="h-3 w-3 text-slate-700" />
    )}
  </div>
);

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
}: ListingSearchFiltersProps) => {
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [townsOpen, setTownsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [townSearch, setTownSearch] = useState("");
  const [showAreas, setShowAreas] = useState(false);

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

  const toggleAllPropertyTypes = (checked: boolean) => {
    updateFilter("propertyTypes", checked ? PROPERTY_TYPES.map(p => p.value) : []);
  };

  const toggleAllStatuses = (checked: boolean) => {
    updateFilter("statuses", checked ? ALL_STATUSES.map(s => s.value) : []);
  };

  const toggleTown = (town: string) => {
    const current = filters.selectedTowns;
    const updated = current.includes(town)
      ? current.filter(t => t !== town)
      : [...current, town];
    updateFilter("selectedTowns", updated);
  };

  const addAllTowns = () => {
    updateFilter("selectedTowns", availableTowns);
  };

  const removeAllTowns = () => {
    updateFilter("selectedTowns", []);
  };

  // Get towns based on selected county
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
    <div className="bg-slate-100 border-b border-slate-300">
      <div className="container mx-auto px-2 py-2">
        
        {/* LIST NUMBER(S) Section */}
        <div className="border border-slate-400 bg-white mb-2">
          <SectionHeader title="LIST NUMBER(S)" />
          <div className="p-2">
            <Input
              placeholder=""
              value={filters.listingNumber}
              onChange={e => updateFilter("listingNumber", e.target.value)}
              className="h-7 text-sm bg-white border-slate-300 rounded-none"
            />
          </div>
        </div>

        {/* Main 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 border border-slate-400 bg-white mb-2">
          
          {/* PROPERTY TYPE Column */}
          <div className="border-r border-slate-400">
            <SectionHeader 
              title="PROPERTY TYPE" 
              isOpen={propertyTypeOpen} 
              onToggle={() => setPropertyTypeOpen(!propertyTypeOpen)} 
            />
            {propertyTypeOpen && (
              <div className="p-2">
                <label className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-slate-50">
                  <Checkbox
                    checked={filters.propertyTypes.length === PROPERTY_TYPES.length}
                    onCheckedChange={(checked) => toggleAllPropertyTypes(!!checked)}
                    className="h-3.5 w-3.5 rounded-none"
                  />
                  <span className="text-xs font-medium">Select All</span>
                </label>
                <div className="border-t border-slate-200 my-1" />
                {PROPERTY_TYPES.map(type => (
                  <label 
                    key={type.value} 
                    className={`flex items-center gap-2 py-0.5 cursor-pointer hover:bg-slate-50 ${
                      filters.propertyTypes.includes(type.value) ? "bg-blue-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={filters.propertyTypes.includes(type.value)}
                      onCheckedChange={() => togglePropertyType(type.value)}
                      className="h-3.5 w-3.5 rounded-none"
                    />
                    <span className="text-xs">{type.label} ({type.code})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* STATUS Column */}
          <div className="border-r border-slate-400">
            <SectionHeader 
              title="STATUS" 
              isOpen={statusOpen} 
              onToggle={() => setStatusOpen(!statusOpen)} 
            />
            {statusOpen && (
              <div className="p-2">
                <label className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-slate-50">
                  <Checkbox
                    checked={filters.statuses.length === ALL_STATUSES.length}
                    onCheckedChange={(checked) => toggleAllStatuses(!!checked)}
                    className="h-3.5 w-3.5 rounded-none"
                  />
                  <span className="text-xs font-medium">Select All</span>
                </label>
                <div className="border-t border-slate-200 my-1" />
                <div className="grid grid-cols-2 gap-x-2">
                  {/* Left column statuses */}
                  <div>
                    {STATUSES_LEFT.map(status => (
                      <label 
                        key={status.value} 
                        className={`flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-50 ${
                          filters.statuses.includes(status.value) ? "bg-blue-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={filters.statuses.includes(status.value)}
                          onCheckedChange={() => toggleStatus(status.value)}
                          className="h-3 w-3 rounded-none"
                        />
                        <span className="text-[10px] leading-tight">{status.label} ({status.code})</span>
                      </label>
                    ))}
                  </div>
                  {/* Right column statuses */}
                  <div>
                    {STATUSES_RIGHT.map(status => (
                      <label 
                        key={status.value} 
                        className={`flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-50 ${
                          filters.statuses.includes(status.value) ? "bg-blue-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={filters.statuses.includes(status.value)}
                          onCheckedChange={() => toggleStatus(status.value)}
                          className="h-3 w-3 rounded-none"
                        />
                        <span className="text-[10px] leading-tight">{status.label} ({status.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Off-Market Timeframe */}
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-slate-600 whitespace-nowrap">Off-Market Timeframe:</Label>
                    <Select defaultValue="6months">
                      <SelectTrigger className="h-6 text-[10px] bg-white border-slate-300 rounded-none flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1month">TODAY - 1 MONTH</SelectItem>
                        <SelectItem value="3months">TODAY - 3 MONTHS</SelectItem>
                        <SelectItem value="6months">TODAY - 6 MONTHS</SelectItem>
                        <SelectItem value="12months">TODAY - 12 MONTHS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STANDARD SEARCH CRITERIA Column */}
          <div>
            <SectionHeader 
              title="STANDARD SEARCH CRITERIA" 
              isOpen={criteriaOpen} 
              onToggle={() => setCriteriaOpen(!criteriaOpen)} 
            />
            {criteriaOpen && (
              <div className="p-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-16 shrink-0">Bedrooms</Label>
                    <Input
                      type="text"
                      value={filters.bedsMin}
                      onChange={e => updateFilter("bedsMin", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-20 shrink-0">Total Baths</Label>
                    <Input
                      type="text"
                      value={filters.bathsMin}
                      onChange={e => updateFilter("bathsMin", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-16 shrink-0">Rooms</Label>
                    <Input
                      type="text"
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-20 shrink-0">Acres</Label>
                    <Input
                      type="text"
                      value={filters.lotSizeMin}
                      onChange={e => updateFilter("lotSizeMin", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-16 shrink-0">SqFt</Label>
                    <Input
                      type="text"
                      value={filters.sqftMin}
                      onChange={e => updateFilter("sqftMin", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-20 shrink-0">Price/SqFt</Label>
                    <Input
                      type="text"
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-16 shrink-0">Year Built</Label>
                    <Input
                      type="text"
                      value={filters.yearBuiltMin}
                      onChange={e => updateFilter("yearBuiltMin", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-20 shrink-0">Total Parking</Label>
                    <Input
                      type="text"
                      value={filters.parkingSpaces}
                      onChange={e => updateFilter("parkingSpaces", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-slate-600 w-16 shrink-0">Garage</Label>
                    <Input
                      type="text"
                      value={filters.garageSpaces}
                      onChange={e => updateFilter("garageSpaces", e.target.value)}
                      className="h-5 text-[10px] bg-white border-slate-300 rounded-none px-1"
                    />
                  </div>
                </div>
                <button className="text-[10px] text-blue-600 underline mt-2 hover:text-blue-800">
                  ADDITIONAL CRITERIA
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PRICE Section */}
        <div className="border border-slate-400 bg-white mb-2 max-w-md">
          <SectionHeader 
            title="PRICE" 
            isOpen={priceOpen} 
            onToggle={() => setPriceOpen(!priceOpen)} 
          />
          {priceOpen && (
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600">Low</Label>
                  <Input
                    type="text"
                    value={filters.priceMin}
                    onChange={e => updateFilter("priceMin", e.target.value)}
                    className="h-6 w-24 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600">High</Label>
                  <Input
                    type="text"
                    value={filters.priceMax}
                    onChange={e => updateFilter("priceMax", e.target.value)}
                    className="h-6 w-24 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ADDRESS Section - Collapsible */}
        <div className="border border-slate-400 bg-white mb-2">
          <SectionHeader 
            title="ADDRESS" 
            isOpen={addressOpen} 
            onToggle={() => setAddressOpen(!addressOpen)} 
          />
          {addressOpen && (
            <div className="p-2">
              <div className="flex items-center gap-4 mb-2">
                <RadioGroup
                  value="street"
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="street" id="addr-street" className="h-3 w-3" />
                    <Label htmlFor="addr-street" className="text-[10px] cursor-pointer">Street Address</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="location" id="addr-location" className="h-3 w-3" />
                    <Label htmlFor="addr-location" className="text-[10px] cursor-pointer">My Location</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600 whitespace-nowrap">Street #</Label>
                  <Input
                    value={filters.streetNumber}
                    onChange={e => updateFilter("streetNumber", e.target.value)}
                    className="h-6 w-16 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <Label className="text-[10px] text-slate-600 whitespace-nowrap">Street Name</Label>
                  <Input
                    value={filters.streetName}
                    onChange={e => updateFilter("streetName", e.target.value)}
                    className="h-6 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600 whitespace-nowrap">Zip Code</Label>
                  <Input
                    value={filters.zipCode}
                    onChange={e => updateFilter("zipCode", e.target.value)}
                    className="h-6 w-20 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600 whitespace-nowrap">Radius (Miles)</Label>
                  <Input
                    value={filters.radius}
                    onChange={e => updateFilter("radius", e.target.value)}
                    className="h-6 w-12 text-xs bg-white border-slate-300 rounded-none px-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOWNS Section - Collapsible */}
        <div className="border border-slate-400 bg-white mb-2">
          <SectionHeader 
            title="TOWNS" 
            isOpen={townsOpen} 
            onToggle={() => setTownsOpen(!townsOpen)} 
          />
          {townsOpen && (
            <div className="p-2">
              {/* State, County, Show Areas row */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600">State</Label>
                  <Select value={filters.state} onValueChange={v => updateFilter("state", v)}>
                    <SelectTrigger className="h-6 w-16 text-[10px] bg-white border-slate-300 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MA">MA</SelectItem>
                      <SelectItem value="CT">CT</SelectItem>
                      <SelectItem value="NH">NH</SelectItem>
                      <SelectItem value="RI">RI</SelectItem>
                      <SelectItem value="VT">VT</SelectItem>
                      <SelectItem value="ME">ME</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600">Coverage Areas</Label>
                  <Select value={filters.county} onValueChange={v => updateFilter("county", v)}>
                    <SelectTrigger className="h-6 w-32 text-[10px] bg-white border-slate-300 rounded-none">
                      <SelectValue placeholder="All Counties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Counties</SelectItem>
                      {filteredCounties.map(county => (
                        <SelectItem key={county.id} value={county.id}>{county.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-slate-600">Show Areas:</Label>
                  <RadioGroup
                    value={showAreas ? "yes" : "no"}
                    onValueChange={v => setShowAreas(v === "yes")}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="yes" id="areas-yes" className="h-3 w-3" />
                      <Label htmlFor="areas-yes" className="text-[10px] cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="no" id="areas-no" className="h-3 w-3" />
                      <Label htmlFor="areas-no" className="text-[10px] cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Two-column layout: Town list | Selected towns */}
              <div className="grid grid-cols-2 gap-2">
                {/* Left: Town search and list */}
                <div>
                  <div className="relative mb-1">
                    <Input
                      placeholder="Type Full or Partial Name"
                      value={townSearch}
                      onChange={e => setTownSearch(e.target.value)}
                      className="h-6 text-[10px] bg-white border-slate-300 rounded-none pr-6"
                    />
                    {townSearch && (
                      <button
                        onClick={() => setTownSearch("")}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-300 bg-white h-40 overflow-y-auto">
                    <button
                      onClick={addAllTowns}
                      className="w-full text-left px-1 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 border-b border-slate-200"
                    >
                      - Add All Towns -
                    </button>
                    {filteredTowns.slice(0, 100).map(town => (
                      <button
                        key={town}
                        onClick={() => toggleTown(town)}
                        className={`w-full text-left px-1 py-0.5 text-[10px] hover:bg-slate-100 ${
                          filters.selectedTowns.includes(town) ? "bg-blue-100 text-blue-800" : ""
                        }`}
                      >
                        {town}, {filters.state}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Selected towns */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] text-slate-600">Selected Towns</Label>
                    {filters.selectedTowns.length > 0 && (
                      <button
                        onClick={removeAllTowns}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-300 bg-white h-40 overflow-y-auto p-1">
                    {filters.selectedTowns.length === 0 ? (
                      <p className="text-[10px] text-slate-400 p-1">No towns selected</p>
                    ) : (
                      <div className="space-y-0.5">
                        {filters.selectedTowns.map(town => (
                          <div
                            key={town}
                            onClick={() => toggleTown(town)}
                            className="flex items-center justify-between px-1 py-0.5 text-[10px] bg-slate-100 hover:bg-red-100 cursor-pointer group"
                          >
                            <span>{town}, {filters.state}</span>
                            <X className="h-3 w-3 text-slate-400 group-hover:text-red-600" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LISTING EVENTS Section - Collapsible */}
        <div className="border border-slate-400 bg-white mb-2">
          <SectionHeader 
            title="LISTING EVENTS" 
            isOpen={eventsOpen} 
            onToggle={() => setEventsOpen(!eventsOpen)} 
          />
          {eventsOpen && (
            <div className="p-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={filters.openHouses}
                    onCheckedChange={(checked) => updateFilter("openHouses", !!checked)}
                    className="h-3 w-3 rounded-none"
                  />
                  <span className="text-[10px]">🟢 Open Houses</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={filters.brokerTours}
                    onCheckedChange={(checked) => updateFilter("brokerTours", !!checked)}
                    className="h-3 w-3 rounded-none"
                  />
                  <span className="text-[10px]">🔴 Broker Tours</span>
                </label>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-slate-600">For:</Label>
                  <Select value={filters.listingEventsTimeframe} onValueChange={v => updateFilter("listingEventsTimeframe", v)}>
                    <SelectTrigger className="h-6 w-28 text-[10px] bg-white border-slate-300 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3days">Next 3 Days</SelectItem>
                      <SelectItem value="7days">Next 7 Days</SelectItem>
                      <SelectItem value="14days">Next 14 Days</SelectItem>
                      <SelectItem value="30days">Next 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KEYWORDS Section - Collapsible */}
        <div className="border border-slate-400 bg-white mb-2">
          <SectionHeader 
            title="KEYWORDS (Public Remarks only)" 
            isOpen={keywordsOpen} 
            onToggle={() => setKeywordsOpen(!keywordsOpen)} 
          />
          {keywordsOpen && (
            <div className="p-2">
              <div className="flex items-center gap-4 mb-2">
                <RadioGroup
                  value={filters.keywordMode}
                  onValueChange={v => updateFilter("keywordMode", v as "any" | "all")}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="any" id="kw-any" className="h-3 w-3" />
                    <Label htmlFor="kw-any" className="text-[10px] cursor-pointer">Any</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="all" id="kw-all" className="h-3 w-3" />
                    <Label htmlFor="kw-all" className="text-[10px] cursor-pointer">All</Label>
                  </div>
                </RadioGroup>
                <div className="h-3 border-l border-slate-300" />
                <RadioGroup
                  value={filters.keywordType}
                  onValueChange={v => updateFilter("keywordType", v as "include" | "exclude")}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="include" id="kw-include" className="h-3 w-3" />
                    <Label htmlFor="kw-include" className="text-[10px] cursor-pointer">Include</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="exclude" id="kw-exclude" className="h-3 w-3" />
                    <Label htmlFor="kw-exclude" className="text-[10px] cursor-pointer">Exclude</Label>
                  </div>
                </RadioGroup>
              </div>
              <textarea
                placeholder="Enter keywords separated by commas"
                value={filters.keywordType === "include" ? filters.keywordsInclude : filters.keywordsExclude}
                onChange={e => updateFilter(
                  filters.keywordType === "include" ? "keywordsInclude" : "keywordsExclude", 
                  e.target.value
                )}
                className="w-full h-16 px-2 py-1 text-[10px] border border-slate-300 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ListingSearchFilters;
