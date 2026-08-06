import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { HOT_SHEET_FILTER_STATUSES } from "@/constants/status";
import {
  DEFAULT_HOT_SHEET_CRITERIA,
  fromCriteriaPayload,
  normalizeStatusSelection,
  toCriteriaPayload,
} from "@/lib/hotSheetCriteriaCore";
import { formatTownSelectionLabel, normalizeTownSelections, toggleTownSelection } from "@/lib/townSelection";

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

interface EditHotsheetCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  initialCriteria: any;
  onUpdate: () => void;
}

export function EditHotsheetCriteriaDialog({
  open,
  onOpenChange,
  hotSheetId,
  initialCriteria,
  onUpdate,
}: EditHotsheetCriteriaDialogProps) {
  // Form state — mirrors CreateHotSheetDialog
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState(true);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_HOT_SHEET_CRITERIA.statuses);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [hasNoMin, setHasNoMin] = useState(false);
  const [hasNoMax, setHasNoMax] = useState(false);
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Collapsible sections
  const [townsOpen, setTownsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Counties for selected state
  const countiesForState = state && COUNTIES_BY_STATE[state]
    ? COUNTIES_BY_STATE[state].map(name => ({ id: name, name, state }))
    : [];

  const locationSummary = useMemo(() => {
    const stateLabel = US_STATES.find((stateItem) => stateItem.code === state)?.name ?? state;
    const countyName = countiesForState.find((county) => county.id === selectedCountyId)?.name;
    const countyLabel = selectedCountyId === "all" ? "All Counties" : `${countyName ?? "Selected"} County`;

    if (selectedCities.length === 0) {
      return `${stateLabel} • ${countyLabel} • 0 towns selected`;
    }

    const preview = selectedCities.slice(0, 2).map((city) => formatTownSelectionLabel(city)).join(", ");
    const townsLabel = selectedCities.length > 2 ? `${preview} +${selectedCities.length - 2}` : preview;
    return `${stateLabel} • ${countyLabel} • ${townsLabel}`;
  }, [countiesForState, selectedCities, selectedCountyId, state]);

  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state,
    county: selectedCountyId,
    showAreas,
  });

  // Preload criteria when dialog opens
  useEffect(() => {
    if (!open || !initialCriteria) return;
    const c = initialCriteria as Record<string, unknown>;
    const coreCriteria = fromCriteriaPayload(c);
    
    // Normalize state
    const loadedState = coreCriteria.state as string | undefined;
    const normalizedState = loadedState && loadedState.length > 2
      ? (US_STATES.find(s => s.name === loadedState)?.code ?? loadedState)
      : (loadedState || "MA");
    setState(normalizedState);

    setSelectedCountyId(coreCriteria.selectedCountyId);
    setSelectedCities(normalizeTownSelections(coreCriteria.cities));
    setShowAreas(coreCriteria.showAreas);
    setPropertyTypes(coreCriteria.propertyTypes);
    setStatuses(normalizeStatusSelection(coreCriteria.statuses));
    setMinPrice(coreCriteria.minPrice);
    setMaxPrice(coreCriteria.maxPrice);
    setHasNoMin(coreCriteria.hasNoMin);
    setHasNoMax(coreCriteria.hasNoMax);
    setBedrooms(coreCriteria.bedrooms);
    setBathrooms(coreCriteria.bathrooms);
    setMinSqft(coreCriteria.minSqft);
    setMaxSqft(coreCriteria.maxSqft);
    setZipCode((c.zipCode as string) || "");

    // Auto-open sections that have data
    setTownsOpen(coreCriteria.cities.length > 0);
    setPropertyTypeOpen(coreCriteria.propertyTypes.length > 0);
    setStatusOpen(coreCriteria.statuses.length > 0);
  }, [open, initialCriteria]);

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  const toggleStatus = (value: string) => {
    setStatuses(prev =>
      normalizeStatusSelection(prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => toggleTownSelection(prev, city));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const hotsheetCriteria = {
        ...toCriteriaPayload({
          ...DEFAULT_HOT_SHEET_CRITERIA,
          state,
          selectedCountyId,
          cities: selectedCities,
          showAreas,
          propertyTypes,
          statuses,
          minPrice,
          maxPrice,
          hasNoMin,
          hasNoMax,
          bedrooms,
          bathrooms,
          minSqft,
          maxSqft,
          hasParking: "any",
        }),
        zipCode: zipCode || null,
      };

      const { error } = await supabase
        .from("hot_sheets")
        .update({ criteria: hotsheetCriteria })
        .eq("id", hotSheetId);

      if (error) throw error;

      toast.success("Search criteria updated");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update criteria:", error);
      toast.error("Failed to update search criteria");
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = HOT_SHEET_FILTER_STATUSES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100%-1.25rem)] max-w-4xl gap-0 overflow-y-auto border border-neutral-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.07)] sm:w-full sm:max-h-[90vh] sm:rounded-xl sm:p-5 sm:gap-4">
        <DialogHeader className="space-y-2 pb-2 text-left sm:pb-3">
          <DialogTitle className="text-lg font-semibold tracking-tight text-neutral-900">
            Edit search criteria
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-snug text-neutral-500">
            Update location, property type, status, and numeric filters. Changes apply when you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:space-y-6 sm:p-5">
          {/* Unified Location section */}
          <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
            <CollapsibleTrigger className="w-full">
              <div className={`flex items-center justify-between cursor-pointer hover:bg-neutral-50/80 p-3 rounded-md border ${townsOpen ? 'border-neutral-200' : 'border-neutral-200'}`}>
                <div className="space-y-1 text-left">
                  <Label className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    Location
                  </Label>
                  <p className="text-xs text-neutral-500">{locationSummary}</p>
                </div>
                {townsOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-state" className="text-sm font-semibold">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger
                        id="edit-state"
                        className="h-9 bg-white text-sm border-neutral-200 focus:ring-neutral-300/35 focus-visible:ring-2 focus-visible:ring-neutral-300/35 focus-visible:ring-offset-2"
                      >
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
                    <Label htmlFor="edit-county" className="text-sm font-semibold">County</Label>
                    <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                      <SelectTrigger
                        id="edit-county"
                        className="h-9 bg-white text-sm border-neutral-200 focus:ring-neutral-300/35 focus-visible:ring-2 focus-visible:ring-neutral-300/35 focus-visible:ring-offset-2"
                      >
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
                      <input type="radio" id="edit-show-yes" name="edit-show-areas" checked={showAreas === true} onChange={() => setShowAreas(true)} className="w-4 h-4 accent-emerald-600" />
                      <Label htmlFor="edit-show-yes" className="text-sm">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="radio" id="edit-show-no" name="edit-show-areas" checked={showAreas === false} onChange={() => setShowAreas(false)} className="w-4 h-4 accent-emerald-600" />
                      <Label htmlFor="edit-show-no" className="text-sm">No</Label>
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
                      <TownsPicker
                        towns={townsList}
                        selectedTowns={selectedCities}
                        onToggleTown={toggleCity}
                        expandedCities={expandedCities}
                        onToggleCityExpansion={toggleCityExpansion}
                        state={state}
                        searchQuery={citySearch}
                        variant="button"
                        showAreas={showAreas}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Selected Towns
                        {selectedCities.length > 0 && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">({selectedCities.length})</span>
                        )}
                      </Label>
                      {selectedCities.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCities([])}
                          className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                        >
                          Remove All
                        </Button>
                      )}
                    </div>
                    <div className="border border-neutral-200 rounded-md p-3 bg-white min-h-[200px] max-h-60 overflow-y-auto">
                      {selectedCities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No towns selected</p>
                      ) : (
                        selectedCities.map((city) => (
                          <div
                            key={city}
                            className="group flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-sm shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-colors hover:bg-neutral-100/70"
                          >
                            <span className="truncate font-medium text-neutral-700">{formatTownSelectionLabel(city)}</span>
                            <button
                              type="button"
                              onClick={() => toggleCity(city)}
                              aria-label={`Remove ${formatTownSelectionLabel(city)}`}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Property Type */}
          <Collapsible open={propertyTypeOpen} onOpenChange={setPropertyTypeOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:bg-neutral-50/80 p-3 rounded-md border border-neutral-200">
                <Label className="text-sm font-semibold uppercase cursor-pointer">
                  Property Type
                  {propertyTypes.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-neutral-500">({propertyTypes.length} selected)</span>
                  )}
                </Label>
                {propertyTypeOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-pt-select-all"
                    checked={propertyTypes.length === propertyTypeOptions.length}
                    onCheckedChange={(checked) => {
                      if (checked) setPropertyTypes(propertyTypeOptions.map(opt => opt.value));
                      else setPropertyTypes([]);
                    }}
                  />
                  <Label htmlFor="edit-pt-select-all" className="cursor-pointer font-medium">Select All</Label>
                </div>
                {propertyTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-pt-${option.value}`}
                      checked={propertyTypes.includes(option.value)}
                      onCheckedChange={() => togglePropertyType(option.value)}
                    />
                    <Label htmlFor={`edit-pt-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Status */}
          <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:bg-neutral-50/80 p-3 rounded-md border border-neutral-200">
                <Label className="text-sm font-semibold uppercase cursor-pointer">
                  Status
                  {statuses.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-neutral-500">({statuses.length} selected)</span>
                  )}
                </Label>
                {statusOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-st-select-all"
                    checked={statuses.length === statusOptions.length}
                    onCheckedChange={(checked) => {
                      if (checked) setStatuses(normalizeStatusSelection(statusOptions.map(opt => opt.value)));
                      else setStatuses([]);
                    }}
                  />
                  <Label htmlFor="edit-st-select-all" className="cursor-pointer font-medium">Select All</Label>
                </div>
                {statusOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-st-${option.value}`}
                      checked={statuses.includes(option.value)}
                      onCheckedChange={() => toggleStatus(option.value)}
                    />
                    <Label htmlFor={`edit-st-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Price Range */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-semibold">Price Range</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-min-price">Min Price</Label>
                <FormattedInput id="edit-min-price" format="currency" placeholder="500000" disabled={hasNoMin} value={minPrice} onChange={setMinPrice} />
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-no-min" checked={hasNoMin} onCheckedChange={(checked) => {
                    setHasNoMin(checked === true);
                    if (checked === true) setMinPrice("");
                  }} />
                  <Label htmlFor="edit-no-min" className="cursor-pointer text-xs font-normal">No Minimum</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-price">Max Price</Label>
                <FormattedInput id="edit-max-price" format="currency" placeholder="1000000" disabled={hasNoMax} value={maxPrice} onChange={setMaxPrice} />
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-no-max" checked={hasNoMax} onCheckedChange={(checked) => {
                    setHasNoMax(checked === true);
                    if (checked === true) setMaxPrice("");
                  }} />
                  <Label htmlFor="edit-no-max" className="cursor-pointer text-xs font-normal">No Maximum</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Beds / Baths / SqFt */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-semibold uppercase">Standard Search Criteria</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                <Input id="edit-bedrooms" type="number" placeholder="Any" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bathrooms">Total Bathrooms</Label>
                <Input id="edit-bathrooms" type="number" step="0.5" placeholder="Any" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-min-sqft">Min SqFt</Label>
                <FormattedInput id="edit-min-sqft" format="number" placeholder="0" value={minSqft} onChange={setMinSqft} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-sqft">Max SqFt</Label>
                <FormattedInput id="edit-max-sqft" format="number" placeholder="Any" value={maxSqft} onChange={setMaxSqft} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-zipcode">Zip Code</Label>
              <Input id="edit-zipcode" placeholder="e.g. 02101" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="max-w-[200px]" />
            </div>
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mt-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            type="button"
            className="h-9 flex-1 rounded-md border-neutral-200 bg-white text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300 hover:bg-neutral-50/90"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 flex-1 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
