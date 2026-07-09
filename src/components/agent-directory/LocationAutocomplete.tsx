import { useState, useCallback } from "react";
import { X, MapPin } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";

export interface SelectedLocation {
  formatted: string;
  city?: string;
  state?: string;
  stateShort?: string;
  county?: string;
  neighborhood?: string;
}

interface LocationAutocompleteProps {
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation | null) => void;
  placeholder?: string;
  className?: string;
}

function parsePlace(place: any): SelectedLocation | null {
  if (!place) return null;
  const components: any[] = Array.isArray(place.address_components) ? place.address_components : [];
  const find = (type: string) => components.find((c) => Array.isArray(c.types) && c.types.includes(type));

  const cityComp =
    find("locality") || find("postal_town") || find("sublocality") || find("sublocality_level_1");
  const stateComp = find("administrative_area_level_1");
  const countyComp = find("administrative_area_level_2");
  const neighborhoodComp = find("neighborhood");

  const formatted: string =
    place.formatted_address || place.name || cityComp?.long_name || stateComp?.long_name || "";

  if (!formatted) return null;

  return {
    formatted,
    city: cityComp?.long_name,
    state: stateComp?.long_name,
    stateShort: stateComp?.short_name,
    county: countyComp?.long_name?.replace(/\s+County$/i, ""),
    neighborhood: neighborhoodComp?.long_name,
  };
}

const LocationAutocomplete = ({
  value,
  onChange,
  placeholder = "Search city, state, or area",
  className,
}: LocationAutocompleteProps) => {
  const [text, setText] = useState<string>(value?.formatted ?? "");

  // Keep local text in sync with external clear.
  if (value === null && text && text !== "") {
    // no-op guard: only reset if diverged externally after clearing
  }

  const handlePlace = useCallback(
    (place: any) => {
      const parsed = parsePlace(place);
      if (parsed) {
        setText(parsed.formatted);
        onChange(parsed);
      }
    },
    [onChange],
  );

  const handleClear = () => {
    setText("");
    onChange(null);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
      <AddressAutocomplete
        value={text}
        onChange={(v) => {
          setText(v);
          if (!v) onChange(null);
        }}
        onPlaceSelect={handlePlace}
        placeholder={placeholder}
        types={["(regions)"]}
        className="h-10 rounded-lg border-neutral-200 bg-white pl-10 pr-9 text-sm shadow-none focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-300/80 md:h-11 md:text-[15px]"
      />
      {text ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 text-neutral-400 hover:text-neutral-700"
          aria-label="Clear location"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
};

export default LocationAutocomplete;