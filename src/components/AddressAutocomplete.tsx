import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressAutocompleteProps {
  onPlaceSelect?: (place: any) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const AddressAutocomplete = ({ onPlaceSelect, placeholder, className, value, onChange }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [useNewElement, setUseNewElement] = useState(false);

  useEffect(() => {
    if (!inputRef.current) return;

    // Load Google Maps script
    const loadGoogleMaps = () => {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
        initAutocomplete();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => initAutocomplete();
      document.head.appendChild(script);
    };

    const initAutocomplete = () => {
      const google = (window as any).google;
      if (!google?.maps?.places) return;

      const places = (google.maps.places as any);

      // Prefer the new Place Autocomplete Element when available
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        setUseNewElement(true);
        try {
          console.info("[AddressAutocomplete] Using PlaceAutocompleteElement");
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          // Try to restrict to US if supported
          try { (el as any).componentRestrictions = { country: ["us"] }; } catch {}
          if (placeholder) {
            try { (el as any).placeholder = placeholder; } catch { el.setAttribute('placeholder', placeholder); }
          }
          containerRef.current.appendChild(el);
          autocompleteRef.current = el;

          const handleSelect = async (event: any) => {
            try {
              console.log("[AddressAutocomplete] PlaceAutocompleteElement gmp-select fired");
              const prediction = event?.placePrediction;
              console.log("[AddressAutocomplete] Prediction:", prediction);
              if (!prediction) return;
              const place = await prediction.toPlace();
              await place.fetchFields({
                fields: [
                  "formattedAddress",
                  "addressComponents",
                  "location",
                  "viewport",
                  "id",
                  "displayName",
                ],
              });

              const mapped = {
                formatted_address: place.formattedAddress,
                address_components: (place.addressComponents || []).map((c: any) => ({
                  long_name: c.longText,
                  short_name: c.shortText,
                  types: c.types || [],
                })),
                geometry: {
                  location: place.location,
                  viewport: place.viewport,
                },
                name: place.displayName?.text || "",
              };

              console.log("[AddressAutocomplete] Mapped place data:", mapped);
              onPlaceSelect?.(mapped);
              onChange?.(mapped.formatted_address || "");
            } catch (err) {
              console.error("[AddressAutocomplete] Error in handleSelect:", err);
            }
          };

          el.addEventListener("gmp-select", handleSelect);
          (el as any).__cleanup = () => el.removeEventListener("gmp-select", handleSelect);

          // Initialize value if controlled
          if (value) {
            try { (el as any).value = value; } catch {}
          }
          return;
        } catch (e) {
          // Fallback to legacy Autocomplete below
          setUseNewElement(false);
        }
      }

      // Legacy Autocomplete (deprecated for new customers)
      if (!inputRef.current) return;
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components', 'geometry', 'name']
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        console.log("[AddressAutocomplete] Legacy place_changed fired");
        console.log("[AddressAutocomplete] Place data:", place);
        if (place) {
          console.log("[AddressAutocomplete] Calling onPlaceSelect with place data");
          onPlaceSelect?.(place);
          const formatted = place.formatted_address || place.name || "";
          onChange?.(formatted);
        } else {
          console.warn("[AddressAutocomplete] No place data received");
        }
      });
    };
    loadGoogleMaps();

    return () => {
      if (autocompleteRef.current) {
        // Cleanup for new PlaceAutocompleteElement
        if ((autocompleteRef.current as any).__cleanup) {
          try { (autocompleteRef.current as any).__cleanup(); } catch {}
        }
        // Cleanup for legacy Autocomplete
        if ((window as any).google?.maps?.event) {
          (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      }
    };
  }, [onPlaceSelect, placeholder, value]);

  // Sync controlled value to new element when it changes
  useEffect(() => {
    if (useNewElement && autocompleteRef.current && value !== undefined) {
      try { (autocompleteRef.current as any).value = value; } catch {}
    }
  }, [useNewElement, value]);

  return useNewElement ? (
    <div ref={containerRef} className={className} />
  ) : (
    <Input
      ref={inputRef}
      placeholder={placeholder || "City, State, Zip or Neighborhood"}
      className={className}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

};

export default AddressAutocomplete;
