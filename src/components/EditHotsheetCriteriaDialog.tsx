import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Search Criteria</DialogTitle>
          <DialogDescription>
            Update the search filters for this hotsheet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
          {/* Unified Location section */}
          <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
            <CollapsibleTrigger className="w-full">
              <div className={`flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border ${townsOpen ? 'border-zinc-200/80' : 'border-zinc-200/80'}`}>
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
                    <Label htmlFor="edit-state" className="text-sm font-semibold">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="edit-state" className="bg-white">
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
                      <SelectTrigger id="edit-county" className="bg-white">
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
                    <div className="border border-zinc-200/80 rounded-md bg-white max-h-60 overflow-y-auto p-2 relative z-10">
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
                    <div className="border border-zinc-200/80 rounded-md p-3 bg-white min-h-[200px] max-h-60 overflow-y-auto">
                      {selectedCities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No towns selected</p>
                      ) : (
                        selectedCities.map((city) => (
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
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Property Type */}
          <Collapsible open={propertyTypeOpen} onOpenChange={setPropertyTypeOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border border-zinc-200/80">
                <Label className="text-sm font-semibold uppercase cursor-pointer">
                  Property Type
                  {propertyTypes.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">({propertyTypes.length} selected)</span>
                  )}
                </Label>
                {propertyTypeOpen ? <ChevronUp className="h-4 w-4 text-[#0E56F5]" /> : <ChevronDown className="h-4 w-4 text-[#0E56F5]" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="space-y-2 border border-zinc-200/80 rounded-md p-3 max-h-64 overflow-y-auto mt-2">
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
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border border-zinc-200/80">
                <Label className="text-sm font-semibold uppercase cursor-pointer">
                  Status
                  {statuses.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">({statuses.length} selected)</span>
                  )}
                </Label>
                {statusOpen ? <ChevronUp className="h-4 w-4 text-[#0E56F5]" /> : <ChevronDown className="h-4 w-4 text-[#0E56F5]" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="space-y-2 border border-zinc-200/80 rounded-md p-3 max-h-64 overflow-y-auto mt-2">
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

        <div className="flex gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
