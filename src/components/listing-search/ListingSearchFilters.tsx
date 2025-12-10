import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  { value: "single_family", label: "Single Family (SF)" },
  { value: "condo", label: "Condominium (CC)" },
  { value: "multi_family", label: "Multi Family (MF)" },
  { value: "land", label: "Land (LD)" },
  { value: "commercial", label: "Commercial (CI)" },
  { value: "business", label: "Business Opp. (BU)" },
  { value: "residential_rental", label: "Residential Rental (RN)" },
  { value: "mobile_home", label: "Mobile Home (MH)" },
];

const STATUSES = [
  { value: "new", label: "New (NEW)", highlight: true },
  { value: "active", label: "Active (ACT)", highlight: true },
  { value: "price_changed", label: "Price Changed (PCG)", highlight: true },
  { value: "back_on_market", label: "Back on Market (BOM)", highlight: true },
  { value: "extended", label: "Extended (EXT)", highlight: true },
  { value: "reactivated", label: "Reactivated (RAC)", highlight: true },
  { value: "contingent", label: "Contingent (CTG)", highlight: false },
  { value: "under_agreement", label: "Under Agreement (UAG)", highlight: false },
  { value: "sold", label: "Sold (SLD)", highlight: false },
  { value: "rented", label: "Rented (RNT)", highlight: false },
  { value: "withdrawn", label: "Temporarily Withdrawn (WDN)", highlight: false },
  { value: "expired", label: "Expired (EXP)", highlight: false },
  { value: "cancelled", label: "Canceled (CAN)", highlight: false },
  { value: "coming_soon", label: "Coming Soon (CSO)", highlight: false },
  { value: "off_market", label: "Off-Market (Private)", highlight: false, special: true },
];

interface ListingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  counties: { id: string; name: string; state: string }[];
}

const ListingSearchFilters = ({
  filters,
  onFiltersChange,
  counties,
}: ListingSearchFiltersProps) => {
  const [townsOpen, setTownsOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [townSearch, setTownSearch] = useState("");
  
  // Import MA county towns data
  const { MA_COUNTY_TOWNS } = require("@/data/maCountyTowns");

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
    updateFilter("statuses", checked ? STATUSES.map(s => s.value) : []);
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

  const filteredCounties = counties.filter(c => c.state === "MA");

  return (
    <div className="bg-slate-50">
      <div className="container mx-auto px-4 py-4 space-y-4">
        
        {/* LIST NUMBER(S) Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">List Number(s)</h3>
          </div>
          <Input
            placeholder="Enter MLS list number(s)"
            value={filters.listingNumber}
            onChange={e => updateFilter("listingNumber", e.target.value)}
            className="h-9 bg-white"
          />
        </div>

        {/* Main 3-Column Filter Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* PROPERTY TYPE Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Property Type</h3>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 cursor-pointer">
                <Checkbox
                  checked={filters.propertyTypes.length === PROPERTY_TYPES.length}
                  onCheckedChange={(checked) => toggleAllPropertyTypes(!!checked)}
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
              <div className="border-t border-slate-100 my-1" />
              {PROPERTY_TYPES.map(type => (
                <label 
                  key={type.value} 
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors ${
                    filters.propertyTypes.includes(type.value) 
                      ? "bg-blue-50 text-blue-900" 
                      : "hover:bg-slate-50"
                  }`}
                >
                  <Checkbox
                    checked={filters.propertyTypes.includes(type.value)}
                    onCheckedChange={() => togglePropertyType(type.value)}
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* STATUS Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Status</h3>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 cursor-pointer">
                <Checkbox
                  checked={filters.statuses.length === STATUSES.length}
                  onCheckedChange={(checked) => toggleAllStatuses(!!checked)}
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
              <div className="border-t border-slate-100 my-1" />
              {STATUSES.map(status => (
                <label 
                  key={status.value} 
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors ${
                    filters.statuses.includes(status.value)
                      ? status.highlight
                        ? "bg-blue-100 text-blue-900"
                        : "bg-slate-100"
                      : "hover:bg-slate-50"
                  } ${status.special ? "text-amber-700" : ""}`}
                >
                  <Checkbox
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* STANDARD SEARCH CRITERIA Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Standard Search Criteria</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <Label className="text-xs text-slate-600">Bedrooms</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.bedsMin}
                  onChange={e => updateFilter("bedsMin", e.target.value)}
                  className="h-8 mt-1 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Total Bathrooms</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.bathsMin}
                  onChange={e => updateFilter("bathsMin", e.target.value)}
                  className="h-8 mt-1 bg-white"
                  step="0.5"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Living Area Total (SqFt)</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.sqftMin}
                  onChange={e => updateFilter("sqftMin", e.target.value)}
                  className="h-8 mt-1 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Acres</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.lotSizeMin}
                  onChange={e => updateFilter("lotSizeMin", e.target.value)}
                  className="h-8 mt-1 bg-white"
                  step="0.1"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Year Built</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.yearBuiltMin}
                  onChange={e => updateFilter("yearBuiltMin", e.target.value)}
                  className="h-8 mt-1 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Total Parking Spaces</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.parkingSpaces}
                  onChange={e => updateFilter("parkingSpaces", e.target.value)}
                  className="h-8 mt-1 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Garage Spaces</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={filters.garageSpaces}
                  onChange={e => updateFilter("garageSpaces", e.target.value)}
                  className="h-8 mt-1 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PRICE Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Price</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label className="text-xs text-slate-600">Low</Label>
              <Input
                type="number"
                placeholder="No Min"
                value={filters.priceMin}
                onChange={e => updateFilter("priceMin", e.target.value)}
                className="h-9 mt-1 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">High</Label>
              <Input
                type="number"
                placeholder="No Max"
                value={filters.priceMax}
                onChange={e => updateFilter("priceMax", e.target.value)}
                className="h-9 mt-1 bg-white"
              />
            </div>
          </div>
        </div>

        {/* ADDRESS Section - Collapsible */}
        <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
          <div className="bg-white rounded-lg border border-slate-200">
            <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Address</h3>
              {addressOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                <div className="flex items-center gap-4">
                  <RadioGroup
                    value="street"
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="street" id="addr-street" />
                      <Label htmlFor="addr-street" className="text-sm cursor-pointer">Street Address</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="location" id="addr-location" />
                      <Label htmlFor="addr-location" className="text-sm cursor-pointer">My Location</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-600">Street #</Label>
                    <Input
                      placeholder=""
                      value={filters.streetNumber}
                      onChange={e => updateFilter("streetNumber", e.target.value)}
                      className="h-9 mt-1 bg-white"
                    />
                  </div>
                  <div className="col-span-5">
                    <Label className="text-xs text-slate-600">Street Name</Label>
                    <Input
                      placeholder=""
                      value={filters.streetName}
                      onChange={e => updateFilter("streetName", e.target.value)}
                      className="h-9 mt-1 bg-white"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-slate-600">Zip Code</Label>
                    <Input
                      placeholder=""
                      value={filters.zipCode}
                      onChange={e => updateFilter("zipCode", e.target.value)}
                      className="h-9 mt-1 bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-600">Radius</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder=""
                        value={filters.radius}
                        onChange={e => updateFilter("radius", e.target.value)}
                        className="h-9 mt-1 bg-white"
                      />
                      <span className="text-xs text-slate-500 mt-1">Miles</span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* TOWNS Section - Collapsible */}
        <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
          <div className="bg-white rounded-lg border border-slate-200">
            <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Towns</h3>
                {filters.selectedTowns.length > 0 && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    {filters.selectedTowns.length} selected
                  </span>
                )}
              </div>
              {townsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-12 gap-4">
                  {/* Left side - State/County/Town selector */}
                  <div className="col-span-12 lg:col-span-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-600">State</Label>
                        <Select 
                          value={filters.state} 
                          onValueChange={v => updateFilter("state", v)}
                        >
                          <SelectTrigger className="h-9 mt-1 bg-white">
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
                      <div>
                        <Label className="text-xs text-slate-600">Coverage Areas</Label>
                        <Select 
                          value={filters.county} 
                          onValueChange={v => updateFilter("county", v)}
                        >
                          <SelectTrigger className="h-9 mt-1 bg-white">
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
                    </div>

                    {/* Town search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Type Full or Partial Name"
                        value={townSearch}
                        onChange={e => setTownSearch(e.target.value)}
                        className="h-9 pl-9 bg-white"
                      />
                      {townSearch && (
                        <button
                          onClick={() => setTownSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                        </button>
                      )}
                    </div>

                    {/* Town list */}
                    <div className="border border-slate-200 rounded-md bg-white max-h-48 overflow-y-auto">
                      <button
                        onClick={addAllTowns}
                        className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-slate-100"
                      >
                        - Add All Towns -
                      </button>
                      {filteredTowns.slice(0, 100).map(town => (
                        <button
                          key={town}
                          onClick={() => toggleTown(town)}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors ${
                            filters.selectedTowns.includes(town) ? "bg-blue-50 text-blue-700" : ""
                          }`}
                        >
                          {town}, {filters.state}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right side - Selected Towns */}
                  <div className="col-span-12 lg:col-span-7">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-slate-600">Selected Towns</Label>
                      {filters.selectedTowns.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={removeAllTowns}
                          className="h-7 text-xs"
                        >
                          Remove All
                        </Button>
                      )}
                    </div>
                    <div className="border border-slate-200 rounded-md bg-white min-h-[200px] p-2">
                      {filters.selectedTowns.length === 0 ? (
                        <p className="text-sm text-slate-400 p-2">No towns selected</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {filters.selectedTowns.map(town => (
                            <span
                              key={town}
                              className="inline-flex items-center px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                              onClick={() => toggleTown(town)}
                            >
                              {town} <X className="h-3 w-3 ml-1" />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Bottom Row - Listing Events + Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LISTING EVENTS Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Listing Events</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={filters.openHouses}
                    onCheckedChange={(checked) => updateFilter("openHouses", !!checked)}
                  />
                  <span className="text-sm">🟢 Open Houses</span>
                </label>
                <label className="flex items-center gap-2 py-1 cursor-pointer">
                  <Checkbox
                    checked={filters.brokerTours}
                    onCheckedChange={(checked) => updateFilter("brokerTours", !!checked)}
                  />
                  <span className="text-sm">🔴 Broker Tours</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600">For:</Label>
                <Select 
                  value={filters.listingEventsTimeframe}
                  onValueChange={v => updateFilter("listingEventsTimeframe", v)}
                >
                  <SelectTrigger className="h-8 w-40 bg-white">
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

          {/* KEYWORDS Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Keywords</h3>
              <span className="text-xs text-slate-500">(Public Remarks only)</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <RadioGroup
                  value={filters.keywordMode}
                  onValueChange={v => updateFilter("keywordMode", v as "any" | "all")}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="any" id="kw-any" />
                    <Label htmlFor="kw-any" className="text-sm cursor-pointer">Any</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="kw-all" />
                    <Label htmlFor="kw-all" className="text-sm cursor-pointer">All</Label>
                  </div>
                </RadioGroup>
                <div className="border-l border-slate-200 h-4" />
                <RadioGroup
                  value={filters.keywordType}
                  onValueChange={v => updateFilter("keywordType", v as "include" | "exclude")}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="include" id="kw-include" />
                    <Label htmlFor="kw-include" className="text-sm cursor-pointer">Include</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="exclude" id="kw-exclude" />
                    <Label htmlFor="kw-exclude" className="text-sm cursor-pointer">Exclude</Label>
                  </div>
                </RadioGroup>
              </div>
              <textarea
                placeholder="Enter keywords separated by commas (e.g., pool, waterfront, renovated)"
                value={filters.keywordType === "include" ? filters.keywordsInclude : filters.keywordsExclude}
                onChange={e => updateFilter(
                  filters.keywordType === "include" ? "keywordsInclude" : "keywordsExclude", 
                  e.target.value
                )}
                className="w-full h-20 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ListingSearchFilters;
