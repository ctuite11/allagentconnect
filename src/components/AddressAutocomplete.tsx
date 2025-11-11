import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressAutocompleteProps {
  onPlaceSelect?: (place: any) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  types?: string[];
}

const AddressAutocomplete = ({ onPlaceSelect, placeholder, className, value, onChange, types = ['address'] }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [useNewElement, setUseNewElement] = useState(false);

  useEffect(() => {
    if (!inputRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    // If no API key, keep a plain input (graceful fallback)
    if (!apiKey) {
      console.warn("[AddressAutocomplete] Missing VITE_GOOGLE_MAPS_API_KEY — using plain input fallback");
      return;
    }

    // Load Google Maps script
    const loadGoogleMaps = () => {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
        initAutocomplete();
        return;
      }

      const scriptId = 'google-maps-places-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => initAutocomplete();
        script.onerror = () => console.warn('[AddressAutocomplete] Failed to load Google Maps script — staying in plain input mode');
        document.head.appendChild(script);
      } else {
        // Script already present
        initAutocomplete();
      }
    };

    const initAutocomplete = async () => {
      console.log("=== [AddressAutocomplete] initAutocomplete called ===");
      const google = (window as any).google;
      if (!google?.maps?.places) {
        console.error("[AddressAutocomplete] Google Maps Places not available");
        return;
      }

      try {
        if (google.maps.importLibrary) {
          console.log("[AddressAutocomplete] Awaiting importLibrary('places')...");
          await google.maps.importLibrary('places');
        }
      } catch (e) {
        console.warn("[AddressAutocomplete] importLibrary failed, continuing with loaded script", e);
      }

      const places = (google.maps.places as any);
      console.log("[AddressAutocomplete] Places API loaded, checking for PlaceAutocompleteElement...");

      // Prefer the new Place Autocomplete Element when available
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        console.log("[AddressAutocomplete] PlaceAutocompleteElement available, using new API");
        setUseNewElement(true);
        try {
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          // Try to restrict to US if supported
          try { (el as any).componentRestrictions = { country: ["us"] }; } catch {}
          // Set types if supported
          try { (el as any).types = types; } catch {}
          if (placeholder) {
            try { (el as any).placeholder = placeholder; } catch { el.setAttribute('placeholder', placeholder); }
          }
          containerRef.current.appendChild(el);
          autocompleteRef.current = el;

          const handleSelect = async (event: any) => {
            console.log("=== [AddressAutocomplete] gmp-select EVENT FIRED ===");
            try {
              const prediction = event?.placePrediction;
              console.log("[AddressAutocomplete] Prediction:", prediction);
              if (!prediction) {
                console.warn("[AddressAutocomplete] No prediction in event");
                return;
              }
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
              console.log("[AddressAutocomplete] About to call onPlaceSelect callback");
              console.log("[AddressAutocomplete] onPlaceSelect exists?", !!onPlaceSelect);
              
              if (onPlaceSelect) {
                onPlaceSelect(mapped);
                console.log("[AddressAutocomplete] onPlaceSelect called successfully");
              } else {
                console.error("[AddressAutocomplete] onPlaceSelect callback is missing!");
              }
              
              onChange?.(mapped.formatted_address || "");
            } catch (err) {
              console.error("[AddressAutocomplete] Error in handleSelect:", err);
            }
          };

          console.log("[AddressAutocomplete] Adding gmp-select event listener");
          el.addEventListener("gmp-select", handleSelect);
          (el as any).__cleanup = () => el.removeEventListener("gmp-select", handleSelect);

          // Initialize value if controlled
          if (value) {
            try { (el as any).value = value; } catch {}
          }
          console.log("[AddressAutocomplete] PlaceAutocompleteElement setup complete");
          return;
        } catch (e) {
          console.error("[AddressAutocomplete] Error setting up PlaceAutocompleteElement, falling back:", e);
          // Fallback to legacy Autocomplete below
          setUseNewElement(false);
        }
      }

      // Legacy Autocomplete (deprecated for new customers)
      console.log("[AddressAutocomplete] Using legacy Autocomplete");
      if (!inputRef.current) {
        console.error("[AddressAutocomplete] inputRef.current is null");
        return;
      }
      
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: types,
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components', 'geometry', 'name']
      });

      console.log("[AddressAutocomplete] Legacy Autocomplete created, adding place_changed listener");
      autocompleteRef.current.addListener('place_changed', () => {
        console.log("=== [AddressAutocomplete] place_changed EVENT FIRED ===");
        const place = autocompleteRef.current?.getPlace();
        console.log("[AddressAutocomplete] Place data:", place);
        if (place) {
          console.log("[AddressAutocomplete] Calling onPlaceSelect with place data");
          console.log("[AddressAutocomplete] onPlaceSelect exists?", !!onPlaceSelect);
          
          if (onPlaceSelect) {
            onPlaceSelect(place);
            console.log("[AddressAutocomplete] onPlaceSelect called successfully");
          } else {
            console.error("[AddressAutocomplete] onPlaceSelect callback is missing!");
          }
          
          const formatted = place.formatted_address || place.name || "";
          onChange?.(formatted);
        } else {
          console.warn("[AddressAutocomplete] No place data received from autocomplete");
        }
      });
      console.log("[AddressAutocomplete] Legacy Autocomplete setup complete");
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
  }, [onPlaceSelect, placeholder, types]);

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
