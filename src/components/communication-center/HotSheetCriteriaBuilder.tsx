import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedInput } from "@/components/ui/formatted-input";
import { CircleDot, DollarSign, Home, ListFilter, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import {
  FilterCheckboxGrid,
  FilterPreferenceCard,
  getPriceRangeSummary,
  NotificationFrequencyCards,
  PriceRangeFields,
  type NotificationFrequencyOption,
} from "@/components/filters";
import {
  HOT_SHEET_FILTER_STATUSES,
  LISTING_STATUS_LABELS,
} from "@/constants/status";
import {
  type HotSheetCriteriaCore,
  normalizeStatusSelection,
} from "@/lib/hotSheetCriteriaCore";
import { formatTownSelectionLabel, normalizeTownSelections, toggleTownSelection } from "@/lib/townSelection";

export type HotSheetCriteriaFormValue = HotSheetCriteriaCore;

/** Agent-friendly labels — values stay identical for matching/persistence. */
export const HOT_SHEET_PROPERTY_TYPE_OPTIONS = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "business_opp", label: "Business Opportunity" },
  { value: "residential_rental", label: "Residential Rental" },
] as const;

/** Same status values as before; display labels omit MLS abbreviations. */
export const HOT_SHEET_STATUS_OPTIONS = HOT_SHEET_FILTER_STATUSES.map((option) => ({
  value: option.value,
  label: LISTING_STATUS_LABELS[option.value] ?? option.label.replace(/\s*\([^)]*\)\s*$/, ""),
}));

export const HOT_SHEET_FREQUENCY_OPTIONS: readonly NotificationFrequencyOption[] = [
  {
    value: "immediately",
    label: "Immediately",
    description: "Email as soon as a matching listing appears.",
  },
  {
    value: "daily",
    label: "Daily",
    description: "One daily digest of new matching listings.",
  },
  {
    value: "weekly",
    label: "Weekly",
    description: "One weekly summary of new matching listings.",
  },
];

interface HotSheetCriteriaBuilderProps {
  value: HotSheetCriteriaFormValue;
  onChange: (value: HotSheetCriteriaFormValue) => void;
  idPrefix?: string;
  /** When provided, email frequency is rendered in the same filter flow. */
  notificationSchedule?: string;
  onNotificationScheduleChange?: (schedule: string) => void;
  notifyAgent?: boolean;
  onNotifyAgentChange?: (notify: boolean) => void;
  showNotificationSettings?: boolean;
}

export function HotSheetCriteriaBuilder({
  value,
  onChange,
  idPrefix = "hs",
  notificationSchedule,
  onNotificationScheduleChange,
  notifyAgent,
  onNotifyAgentChange,
  showNotificationSettings = false,
}: HotSheetCriteriaBuilderProps) {
  const [locationOpen, setLocationOpen] = useState(true);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [multiTownInput, setMultiTownInput] = useState("");

  const countiesForState = useMemo(
    () =>
      value.state && COUNTIES_BY_STATE[value.state]
        ? COUNTIES_BY_STATE[value.state].map((name) => ({ id: name, name, state: value.state }))
        : [],
    [value.state],
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
      return `${stateLabel} · ${countyLabel} · 0 towns`;
    }

    const preview = value.cities.slice(0, 2).map((city) => formatTownSelectionLabel(city)).join(", ");
    const townsLabel = value.cities.length > 2 ? `${preview} +${value.cities.length - 2}` : preview;
    return `${stateLabel} · ${countyLabel} · ${townsLabel}`;
  }, [countiesForState, value.cities, value.selectedCountyId, value.state]);

  const propertyTypeSummary = useMemo(() => {
    if (value.propertyTypes.length === 0) return "";
    const labels = value.propertyTypes
      .map((type) => HOT_SHEET_PROPERTY_TYPE_OPTIONS.find((opt) => opt.value === type)?.label)
      .filter(Boolean);
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [value.propertyTypes]);

  const statusSummary = useMemo(() => {
    if (value.statuses.length === 0) return "";
    const labels = value.statuses
      .map((status) => HOT_SHEET_STATUS_OPTIONS.find((opt) => opt.value === status)?.label)
      .filter(Boolean);
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [value.statuses]);

  const priceSummary = getPriceRangeSummary({
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    hasNoMin: value.hasNoMin,
    hasNoMax: value.hasNoMax,
  });

  const detailsSummary = useMemo(() => {
    const bits: string[] = [];
    if (value.bedrooms) bits.push(`${value.bedrooms}+ beds`);
    if (value.bathrooms) bits.push(`${value.bathrooms}+ baths`);
    if (value.minSqft || value.maxSqft) {
      bits.push(
        `SqFt ${value.minSqft || "any"}–${value.maxSqft || "any"}`,
      );
    }
    if (value.hasParking !== "any") {
      bits.push(value.hasParking === "yes" ? "Parking" : "No parking");
    }
    return bits.join(" · ");
  }, [value.bathrooms, value.bedrooms, value.hasParking, value.maxSqft, value.minSqft]);

  const patch = (partial: Partial<HotSheetCriteriaFormValue>) => {
    onChange({ ...value, ...partial });
  };

  const toggleCity = (city: string) => {
    patch({ cities: toggleTownSelection(value.cities, city) });
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
    <div className="space-y-3">
      <FilterPreferenceCard
        icon={MapPin}
        title="Location"
        description="Choose state, county, and towns for matching listings."
        summary={locationSummary}
        emptySummary="No location selected"
        open={locationOpen}
        onOpenChange={setLocationOpen}
        compact
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Label className="text-sm text-neutral-700">State</Label>
            <Label className="text-sm text-neutral-700">County</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={value.state}
              onValueChange={(nextState) =>
                patch({ state: nextState, selectedCountyId: "all", cities: [] })
              }
            >
              <SelectTrigger className="border-neutral-200 bg-white text-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-[300px] bg-popover">
                {US_STATES.map((stateItem) => (
                  <SelectItem key={stateItem.code} value={stateItem.code}>
                    {stateItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={value.selectedCountyId}
              onValueChange={(county) => patch({ selectedCountyId: county })}
            >
              <SelectTrigger className="border-neutral-200 bg-white text-neutral-900">
                <SelectValue placeholder="All Counties" />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-[300px] bg-popover">
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

        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-sm text-neutral-700">Show Areas</Label>
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id={`${idPrefix}-show-yes`}
                name={`${idPrefix}-show-areas`}
                checked={value.showAreas === true}
                onChange={() => patch({ showAreas: true })}
                className="h-4 w-4 accent-[#0E56F5]"
              />
              <Label htmlFor={`${idPrefix}-show-yes`} className="text-sm">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id={`${idPrefix}-show-no`}
                name={`${idPrefix}-show-areas`}
                checked={value.showAreas === false}
                onChange={() => patch({ showAreas: false })}
                className="h-4 w-4 accent-[#0E56F5]"
              />
              <Label htmlFor={`${idPrefix}-show-no`} className="text-sm">
                No
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Label className="text-sm text-neutral-700">Towns & Neighborhoods</Label>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-neutral-700">Selected Towns</Label>
              {value.cities.length > 0 ? (
                <button
                  type="button"
                  onClick={() => patch({ cities: [] })}
                  className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline"
                >
                  Remove all
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Input
                placeholder="Type Full or Partial Name"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="border-neutral-200 bg-white text-sm text-neutral-900"
              />
              <div className="relative z-10 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
                {townsList.length > 0 ? (
                  <button
                    type="button"
                    onClick={selectAllTowns}
                    className="mb-1 w-full rounded px-2 py-1.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    {value.selectedCountyId === "all"
                      ? `- Add All Towns (${townsList.length}) -`
                      : `- Add All Towns in County (${townsList.length}) -`}
                  </button>
                ) : null}
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

            <div className="min-h-[200px] max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3">
              {value.cities.length === 0 ? (
                <p className="text-sm text-neutral-500">No towns selected</p>
              ) : (
                value.cities.map((city) => (
                  <div
                    key={city}
                    className="group flex items-center justify-between gap-2 border-b border-neutral-100 px-2 py-1.5 text-sm last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCity(city)}
                      className="min-w-0 flex-1 truncate text-left font-medium text-neutral-900 hover:underline"
                    >
                      {formatTownSelectionLabel(city)}
                    </button>
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

        <div className="space-y-2">
          <Label className="text-sm text-neutral-700">Type Multiple Towns/Areas</Label>
          <p className="text-xs text-neutral-500">Separate multiple towns with commas</p>
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
              className="flex-1 border-neutral-200 bg-white text-sm"
            />
            <Button type="button" size="sm" onClick={handleAddMultipleTowns} className="shrink-0 px-4">
              Add
            </Button>
          </div>
        </div>
      </FilterPreferenceCard>

      <FilterPreferenceCard
        icon={Home}
        title="Property Type"
        description="Choose which property types should match."
        summary={
          propertyTypeSummary
            ? `${value.propertyTypes.length} type${value.propertyTypes.length !== 1 ? "s" : ""} · ${propertyTypeSummary}`
            : ""
        }
        emptySummary="No property types selected"
        open={propertyTypeOpen}
        onOpenChange={setPropertyTypeOpen}
        compact
      >
        <FilterCheckboxGrid
          options={HOT_SHEET_PROPERTY_TYPE_OPTIONS}
          selected={value.propertyTypes}
          onChange={(propertyTypes) => patch({ propertyTypes })}
          idPrefix={`${idPrefix}-pt`}
        />
      </FilterPreferenceCard>

      <FilterPreferenceCard
        icon={CircleDot}
        title="Status"
        description="Keep Hot Sheet-specific statuses. Defaults are unchanged."
        summary={
          statusSummary
            ? `${value.statuses.length} status${value.statuses.length !== 1 ? "es" : ""} · ${statusSummary}`
            : ""
        }
        emptySummary="No statuses selected"
        open={statusOpen}
        onOpenChange={setStatusOpen}
        compact
      >
        <FilterCheckboxGrid
          options={HOT_SHEET_STATUS_OPTIONS}
          selected={value.statuses}
          onChange={(statuses) => patch({ statuses: normalizeStatusSelection(statuses) })}
          idPrefix={`${idPrefix}-st`}
        />
      </FilterPreferenceCard>

      <FilterPreferenceCard
        icon={DollarSign}
        title="Price Range"
        description="Match listings in your preferred price band."
        summary={priceSummary}
        emptySummary="No price range set"
        open={priceOpen}
        onOpenChange={setPriceOpen}
        compact
      >
        <PriceRangeFields
          idPrefix={`${idPrefix}-price`}
          value={{
            minPrice: value.minPrice,
            maxPrice: value.maxPrice,
            hasNoMin: value.hasNoMin,
            hasNoMax: value.hasNoMax,
          }}
          onChange={(next) =>
            patch({
              minPrice: next.minPrice,
              maxPrice: next.maxPrice,
              hasNoMin: next.hasNoMin,
              hasNoMax: next.hasNoMax,
            })
          }
        />
      </FilterPreferenceCard>

      <FilterPreferenceCard
        icon={ListFilter}
        title="Beds / Baths / Sq Ft"
        description="Optional Hot Sheet details beyond Communications Center filters."
        summary={detailsSummary}
        emptySummary="No additional criteria"
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        compact
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-bedrooms`} className="text-sm text-neutral-600">
              Bedrooms
            </Label>
            <Input
              id={`${idPrefix}-bedrooms`}
              type="number"
              placeholder="Any"
              value={value.bedrooms}
              onChange={(e) => patch({ bedrooms: e.target.value })}
              min="0"
              className="border-neutral-200 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-bathrooms`} className="text-sm text-neutral-600">
              Total Bathrooms
            </Label>
            <Input
              id={`${idPrefix}-bathrooms`}
              type="number"
              step="0.5"
              placeholder="Any"
              value={value.bathrooms}
              onChange={(e) => patch({ bathrooms: e.target.value })}
              min="0"
              className="border-neutral-200 bg-white"
            />
          </div>
          {/* Rooms intentionally omitted — no listings.rooms column for matching. */}
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-acres`} className="text-sm text-neutral-600">
              Acres
            </Label>
            <Input
              id={`${idPrefix}-acres`}
              type="number"
              step="0.01"
              placeholder="Any"
              value={value.acres}
              onChange={(e) => patch({ acres: e.target.value })}
              min="0"
              className="border-neutral-200 bg-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-neutral-700">Living Area Total (SqFt)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-min-sqft`} className="text-sm text-neutral-600">
                Min
              </Label>
              <FormattedInput
                id={`${idPrefix}-min-sqft`}
                format="number"
                placeholder="0"
                value={value.minSqft}
                onChange={(nextValue) => patch({ minSqft: nextValue })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-max-sqft`} className="text-sm text-neutral-600">
                Max
              </Label>
              <FormattedInput
                id={`${idPrefix}-max-sqft`}
                format="number"
                placeholder="Any"
                value={value.maxSqft}
                onChange={(nextValue) => patch({ maxSqft: nextValue })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-price-per-sqft`} className="text-sm text-neutral-600">
              Price per SqFt
            </Label>
            <FormattedInput
              id={`${idPrefix}-price-per-sqft`}
              format="currency"
              placeholder="Any"
              value={value.pricePerSqft}
              onChange={(nextValue) => patch({ pricePerSqft: nextValue })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-neutral-600">Parking (includes garage)</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {(
                [
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["any", "Any"],
                ] as const
              ).map(([option, label]) => (
                <div key={option} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${idPrefix}-parking-${option}`}
                    name={`${idPrefix}-parking`}
                    checked={value.hasParking === option}
                    onChange={() => patch({ hasParking: option })}
                    className="h-4 w-4 accent-[#0E56F5]"
                  />
                  <Label htmlFor={`${idPrefix}-parking-${option}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FilterPreferenceCard>

      {showNotificationSettings &&
      notificationSchedule != null &&
      onNotificationScheduleChange ? (
        <NotificationFrequencyCards
          value={notificationSchedule}
          onChange={onNotificationScheduleChange}
          options={HOT_SHEET_FREQUENCY_OPTIONS}
          title="Email frequency"
          description="How often matching listings are emailed to the buyer."
          alsoEmailMe={notifyAgent}
          onAlsoEmailMeChange={onNotifyAgentChange}
          alsoEmailMeId={`${idPrefix}-notify-agent`}
        />
      ) : null}
    </div>
  );
}
