import { useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface AddressAutocompleteProps {
  onPlaceSelect?: (place: any) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  types?: string[];
  onError?: () => void;
}

function getGmapsKey(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const urlKey = urlParams.get("gmaps_key");
  if (urlKey) {
    localStorage.setItem("gmaps_preview_key", urlKey);
    return urlKey;
  }
  const stored = localStorage.getItem("gmaps_preview_key");
  if (stored) return stored;
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.Autocomplete) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places?.Autocomplete) {
        resolve();
      } else {
        reject(new Error("Google Maps loaded but Places not available"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

const AddressAutocomplete = ({
  onPlaceSelect,
  placeholder = "Street Address",
  className,
  value = "",
  onChange,
  types,
  onError,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const isMountedRef = useRef(true);
  const suppressNextChangeRef = useRef(false);

  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current || !isMountedRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place || !place.place_id) return;

    if (!place.address_components && place.place_id) {
      const service = new google.maps.places.PlacesService(document.createElement("div"));
      service.getDetails(
        { placeId: place.place_id, fields: ["address_components", "geometry", "formatted_address"] },
        (result, status) => {
          if (isMountedRef.current && status === google.maps.places.PlacesServiceStatus.OK && result) {
            suppressNextChangeRef.current = true;
            if (result.formatted_address) {
              onChange?.(result.formatted_address.split(",")[0] || "");
            }
            onPlaceSelect?.(result);
          }
        }
      );
    } else {
      suppressNextChangeRef.current = true;
      if (place.formatted_address) {
        onChange?.(place.formatted_address.split(",")[0] || "");
      }
      onPlaceSelect?.(place);
    }
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    isMountedRef.current = true;
    const apiKey = getGmapsKey();
    if (!apiKey || !inputRef.current) return;

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !isMountedRef.current) return;
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }

        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "geometry", "formatted_address", "place_id"],
          types: types || ["address"],
          componentRestrictions: { country: "us" },
        });

        ac.addListener("place_changed", handlePlaceChanged);
        autocompleteRef.current = ac;
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("AddressAutocomplete: Google Maps failed to load:", err.message);
          onError?.();
        }
      });

    return () => { cancelled = true; };
  }, [handlePlaceChanged, types, onError]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (suppressNextChangeRef.current) {
      suppressNextChangeRef.current = false;
      return;
    }
    onChange?.(e.target.value);
  };

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      className={className}
      value={value}
      onChange={handleChange}
      autoComplete="off"
    />
  );
};

export default AddressAutocomplete;
