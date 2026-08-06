import { useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedInput } from "@/components/ui/formatted-input";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { HOT_SHEET_FILTER_STATUSES } from "@/constants/status";
import {
  type HotSheetCriteriaCore,
  normalizeStatusSelection,
} from "@/lib/hotSheetCriteriaCore";
import { formatTownSelectionLabel, normalizeTownSelections, toggleTownSelection } from "@/lib/townSelection";

export type HotSheetCriteriaFormValue = HotSheetCriteriaCore;

interface HotSheetCriteriaBuilderProps {
  value: HotSheetCriteriaFormValue;
  onChange: (value: HotSheetCriteriaFormValue) => void;
}

const propertyTypeOptions = [
  { value: "single_family", label: "Single Family (SF)" },
  { value: "condo", label: "Condominium (CC)" },
  { value: "multi_family", label: "Multi Family (MF)" },
  { value: "townhouse", label: "Townhouse (TH)" },
  { value: "land", label: "Land (LD)" },
  { value: "commercial", label: "Commercial (CI)" },
  { value: "business_opp", label: "Business Opp. (BU)" },
  { value: "residential_rental", label: "Residential Rental (RR)" },
];

export function HotSheetCriteriaBuilder({ value, onChange }: HotSheetCriteriaBuilderProps) {
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [townsOpen, setTownsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [multiTownInput, setMultiTownInput] = useState("");

  const countiesForState = useMemo(
    () =>
      value.state && COUNTIES_BY_STATE[value.state]
        ? COUNTIES_BY_STATE[value.state].map((name) => ({ id: name, name, state: value.state }))
        : [],
    [value.state]
  );

  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: value.state,
    county: value.selectedCountyId,
    showAreas: value.showAreas,
  });

  const locationSummary = useMemo(() => {
    const stateLabel = US_STATES.find((stateItem) => stateItem.code === value.state)?.name ?? value.state;
    const countyName = countiesForState.find((county) => county.id === value.selectedCountyId)?.name;
    const countyLabel = value.selectedCountyId === "all" ? "All Counties" : `${countyName ?? "Selected"} County`;

    if (value.cities.length === 0) {
      return `${stateLabel} • ${countyLabel} • 0 towns selected`;
    }

    const preview = value.cities.slice(0, 2).map((city) => formatTownSelectionLabel(city)).join(", ");
    const townsLabel = value.cities.length > 2 ? `${preview} +${value.cities.length - 2}` : preview;
    return `${stateLabel} • ${countyLabel} • ${townsLabel}`;
  }, [countiesForState, value.cities, value.selectedCountyId, value.state]);

  const patch = (partial: Partial<HotSheetCriteriaFormValue>) => {
    onChange({ ...value, ...partial });
  };

  const togglePropertyType = (type: string) => {
    const next = value.propertyTypes.includes(type)
      ? value.propertyTypes.filter((t) => t !== type)
      : [...value.propertyTypes, type];
    patch({ propertyTypes: next });
  };

  const toggleStatus = (status: string) => {
    const next = value.statuses.includes(status)
      ? value.statuses.filter((s) => s !== status)
      : [...value.statuses, status];
    patch({ statuses: normalizeStatusSelection(next) });
  };

  const toggleCity = (city: string) => {
    const next = toggleTownSelection(value.cities, city);
    patch({ cities: next });
  };

  const selectAllTowns = () => {
    const unique = normalizeTownSelections([...(value.cities || []), ...townsList]);
    patch({ cities: unique });
    toast.success(`Added ${unique.length} towns/areas`);
  };

  const handleAddMultipleTowns = () => {
    if (!multiTownInput.trim()) {
      toast.error("Please enter at least one town name");
      return;
    }

    const inputTowns = multiTownInput
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const addedTowns: string[] = [];
    const notFoundTowns: string[] = [];

    inputTowns.forEach((inputTown) => {
      const matchedTown = townsList.find((town) => town.toLowerCase().includes(inputTown.toLowerCase()));
      if (matchedTown) {
        if (!value.cities.includes(matchedTown)) {
          addedTowns.push(matchedTown);
        }
      } else {
        notFoundTowns.push(inputTown);
      }
    });

    if (addedTowns.length > 0) {
      patch({ cities: normalizeTownSelections([...value.cities, ...addedTowns]) });
      setMultiTownInput("");
    }

    if (addedTowns.length > 0 && notFoundTowns.length === 0) {
      toast.success(`Added ${addedTowns.length} town(s)`);
      return;
    }

    if (addedTowns.length > 0 && notFoundTowns.length > 0) {
      toast.success(`Added ${addedTowns.length} town(s). Not found: ${notFoundTowns.join(", ")}`);
      return;
    }

    toast.error(`No matching towns found for: ${notFoundTowns.join(", ")}`);
  };

  return (
    <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
      <div className={`rounded-xl border ${criteriaOpen ? "border-neutral-300" : "border-border"}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 px-4 py-3">
            <h3 className="text-base font-semibold">Search Criteria</h3>
            {criteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-6 border-t p-4">
            {/* Unified Location section */}
            <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className={`flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border ${townsOpen ? "border-neutral-300" : "border-border"}`}>
                  <div className="space-y-1 text-left">
                    <Label className="text-sm font-semibold uppercase cursor-pointer">Location</Label>
                    <p className="text-xs text-zinc-500">{locationSummary}</p>
                  </div>
                  {townsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">State</Label>
                      <Select value={value.state} onValueChange={(nextState) => patch({ state: nextState, selectedCountyId: "all", cities: [] })}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          {US_STATES.map((stateItem) => (
                            <SelectItem key={stateItem.code} value={stateItem.code}>
                              {stateItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">County</Label>
                      <Select value={value.selectedCountyId} onValueChange={(county) => patch({ selectedCountyId: county })}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="All Counties" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          <SelectItem value="all">All Counties</SelectItem>
                          {countiesForState.map((county) => (
                            <SelectItem key={county.id} value={county.id}>
                              {county.name} County
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Label className="text-sm">Show Areas</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="cc-show-yes"
                          name="cc-show-areas"
                          checked={value.showAreas === true}
                          onChange={() => patch({ showAreas: true })}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <Label htmlFor="cc-show-yes" className="text-sm">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="cc-show-no"
                          name="cc-show-areas"
                          checked={value.showAreas === false}
                          onChange={() => patch({ showAreas: false })}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <Label htmlFor="cc-show-no" className="text-sm">No</Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Input
                        placeholder="Type Full or Partial Name"
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="text-sm"
                      />
                      <div className="border border-neutral-200 rounded-md bg-white max-h-60 overflow-y-auto p-2 relative z-10">
                        {value.selectedCountyId && townsList.length > 0 && (
                          <button
                            type="button"
                            onClick={selectAllTowns}
                            className="w-full text-left px-2 py-1.5 text-sm font-semibold hover:bg-muted rounded mb-1 border-b pb-2"
                          >
                            {value.selectedCountyId === "all"
                              ? "✓ Add All Towns from All Counties"
                              : `✓ Add All Towns in County (${townsList.length})`}
                          </button>
                        )}
                        <TownsPicker
                          towns={townsList}
                          selectedTowns={value.cities}
                          onToggleTown={toggleCity}
                          expandedCities={expandedCities}
                          onToggleCityExpansion={toggleCityExpansion}
                          state={value.state}
                          searchQuery={citySearch}
                          variant="button"
                          showAreas={value.showAreas}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Selected Towns
                          {value.cities.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({value.cities.length})</span>
                          )}
                        </Label>
                        {value.cities.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => patch({ cities: [] })}
                            className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                          >
                            Remove All
                          </Button>
                        )}
                      </div>
                      <div className="border border-neutral-200 rounded-md p-3 bg-white min-h-[200px] max-h-60 overflow-y-auto">
                        {value.cities.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No towns selected</p>
                        ) : (
                          value.cities.map((city) => (
                            <div
                              key={city}
                              className="group flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-sm shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors hover:bg-zinc-100/70"
                            >
                              <span className="truncate font-medium text-zinc-700">{formatTownSelectionLabel(city)}</span>
                              <button
                                type="button"
                                onClick={() => toggleCity(city)}
                                aria-label={`Remove ${formatTownSelectionLabel(city)}`}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Type Multiple Towns/Areas</Label>
                    <p className="text-xs text-muted-foreground">Separate multiple towns with commas</p>
                    <div className="flex gap-2">
                      <Input
                        value={multiTownInput}
                        onChange={(e) => setMultiTownInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddMultipleTowns();
                          }
                        }}
                        placeholder="e.g. Northborough, Worcester, Boston"
                        className="text-sm flex-1"
                      />
                      <Button type="button" onClick={handleAddMultipleTowns} className="px-4 text-sm">
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={propertyTypeOpen} onOpenChange={setPropertyTypeOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border border-zinc-200">
                  <Label className="text-sm font-semibold uppercase cursor-pointer">
                    Property Type
                    {value.propertyTypes.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-zinc-500">({value.propertyTypes.length} selected)</span>
                    )}
                  </Label>
                  {propertyTypeOpen ? <ChevronUp className="h-4 w-4 text-[#0E56F5]" /> : <ChevronDown className="h-4 w-4 text-[#0E56F5]" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cc-pt-select-all"
                      checked={value.propertyTypes.length === propertyTypeOptions.length}
                      onCheckedChange={(checked) => patch({ propertyTypes: checked ? propertyTypeOptions.map((opt) => opt.value) : [] })}
                    />
                    <Label htmlFor="cc-pt-select-all" className="cursor-pointer font-medium">Select All</Label>
                  </div>
                  {propertyTypeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cc-pt-${option.value}`}
                        checked={value.propertyTypes.includes(option.value)}
                        onCheckedChange={() => togglePropertyType(option.value)}
                      />
                      <Label htmlFor={`cc-pt-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border border-zinc-200">
                  <Label className="text-sm font-semibold uppercase cursor-pointer">
                    Status
                    {value.statuses.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-zinc-500">({value.statuses.length} selected)</span>
                    )}
                  </Label>
                  {statusOpen ? <ChevronUp className="h-4 w-4 text-[#0E56F5]" /> : <ChevronDown className="h-4 w-4 text-[#0E56F5]" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cc-st-select-all"
                      checked={value.statuses.length === HOT_SHEET_FILTER_STATUSES.length}
                      onCheckedChange={(checked) =>
                        patch({ statuses: checked ? normalizeStatusSelection(HOT_SHEET_FILTER_STATUSES.map((opt) => opt.value)) : [] })
                      }
                    />
                    <Label htmlFor="cc-st-select-all" className="cursor-pointer font-medium">Select All</Label>
                  </div>
                  {HOT_SHEET_FILTER_STATUSES.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cc-st-${option.value}`}
                        checked={value.statuses.includes(option.value)}
                        onCheckedChange={() => toggleStatus(option.value)}
                      />
                      <Label htmlFor={`cc-st-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-semibold">Price Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-min-price">Min Price</Label>
                  <FormattedInput
                    id="cc-min-price"
                    format="currency"
                    placeholder="500000"
                    value={value.minPrice}
                    onChange={(nextValue) => patch({ minPrice: nextValue })}
                    disabled={value.hasNoMin}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cc-no-min"
                      checked={value.hasNoMin}
                      onCheckedChange={(checked) => {
                        const active = checked === true;
                        patch({ hasNoMin: active, minPrice: active ? "" : value.minPrice });
                      }}
                    />
                    <Label htmlFor="cc-no-min" className="text-sm font-normal cursor-pointer">No Minimum</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cc-max-price">Max Price</Label>
                  <FormattedInput
                    id="cc-max-price"
                    format="currency"
                    placeholder="1000000"
                    value={value.maxPrice}
                    onChange={(nextValue) => patch({ maxPrice: nextValue })}
                    disabled={value.hasNoMax}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cc-no-max"
                      checked={value.hasNoMax}
                      onCheckedChange={(checked) => {
                        const active = checked === true;
                        patch({ hasNoMax: active, maxPrice: active ? "" : value.maxPrice });
                      }}
                    />
                    <Label htmlFor="cc-no-max" className="text-sm font-normal cursor-pointer">No Maximum</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-semibold uppercase">Standard Search Criteria</Label>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-bedrooms">Bedrooms</Label>
                  <Input id="cc-bedrooms" type="number" placeholder="Any" value={value.bedrooms} onChange={(e) => patch({ bedrooms: e.target.value })} min="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-bathrooms">Total Bathrooms</Label>
                  <Input id="cc-bathrooms" type="number" step="0.5" placeholder="Any" value={value.bathrooms} onChange={(e) => patch({ bathrooms: e.target.value })} min="0" />
                </div>
                {/* Rooms is intentionally not offered: there is no listings.rooms
                    column, so the Hot Sheet matcher cannot enforce it. Existing
                    saved Rooms criteria fail closed (zero matches) server-side. */}
                <div className="space-y-2">
                  <Label htmlFor="cc-acres">Acres</Label>
                  <Input id="cc-acres" type="number" step="0.01" placeholder="Any" value={value.acres} onChange={(e) => patch({ acres: e.target.value })} min="0" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Living Area Total (SqFt)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cc-min-sqft">Min</Label>
                    <FormattedInput id="cc-min-sqft" format="number" placeholder="0" value={value.minSqft} onChange={(nextValue) => patch({ minSqft: nextValue })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cc-max-sqft">Max</Label>
                    <FormattedInput id="cc-max-sqft" format="number" placeholder="Any" value={value.maxSqft} onChange={(nextValue) => patch({ maxSqft: nextValue })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-price-per-sqft">Price per SqFt</Label>
                  <FormattedInput id="cc-price-per-sqft" format="currency" placeholder="Any" value={value.pricePerSqft} onChange={(nextValue) => patch({ pricePerSqft: nextValue })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Parking (includes garage)</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="cc-parking-yes" name="cc-parking" checked={value.hasParking === "yes"} onChange={() => patch({ hasParking: "yes" })} className="w-4 h-4" />
                      <Label htmlFor="cc-parking-yes" className="text-sm">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="cc-parking-no" name="cc-parking" checked={value.hasParking === "no"} onChange={() => patch({ hasParking: "no" })} className="w-4 h-4" />
                      <Label htmlFor="cc-parking-no" className="text-sm">No</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="cc-parking-any" name="cc-parking" checked={value.hasParking === "any"} onChange={() => patch({ hasParking: "any" })} className="w-4 h-4" />
                      <Label htmlFor="cc-parking-any" className="text-sm">Any</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
