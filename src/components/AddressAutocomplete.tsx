import { useEffect, useRef, useState } from "react";
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

// --- Google Maps / Places loader (robust + no silent failure) ---

const GMAPS_SCRIPT_ID = "google-maps-js";
const GMAPS_KEY_STORAGE = "aac_gmaps_key";

function getGmapsKey(): {
  apiKey?: string;
  source: "env" | "url" | "storage" | "missing";
} {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const urlKey =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("gmaps_key") ?? undefined
      : undefined;

  const storedKey =
    typeof window !== "undefined"
      ? window.localStorage.getItem(GMAPS_KEY_STORAGE) ?? undefined
      : undefined;

  const apiKey = envKey || urlKey || storedKey;

  // Persist the url key for convenience (preview only)
  if (typeof window !== "undefined" && urlKey) {
    try {
      window.localStorage.setItem(GMAPS_KEY_STORAGE, urlKey);
    } catch {
      // ignore
    }
  }

  const source: "env" | "url" | "storage" | "missing" = envKey
    ? "env"
    : urlKey
    ? "url"
    : storedKey
    ? "storage"
    : "missing";

  return { apiKey: apiKey || undefined, source };
}

function isPlacesReady(): boolean {
  return Boolean(
    (window as any).google?.maps?.places &&
      ((window as any).google?.maps?.places?.Autocomplete ||
        (window as any).google?.maps?.places?.PlaceAutocompleteElement)
  );
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded and ready
    if (isPlacesReady()) return resolve();

    const existing = document.getElementById(GMAPS_SCRIPT_ID) as HTMLScriptElement | null;

    // If script exists but Places isn't ready yet, wait for it
    if (existing) {
      const checkReady = () => {
        if (isPlacesReady()) {
          resolve();
        } else {
          // Script might still be loading, wait a bit
          setTimeout(() => {
            if (isPlacesReady()) resolve();
            else
              reject(
                new Error(
                  "Google Maps script loaded but Places is unavailable. Check: Places API enabled + billing + key restrictions."
                )
              );
          }, 2000);
        }
      };

      if (existing.dataset.loaded === "true") {
        checkReady();
      } else {
        existing.addEventListener("load", checkReady);
        existing.addEventListener("error", () => {
          reject(
            new Error(
              "Google Maps script failed to load. Likely: invalid key, referrer restriction, API not enabled, or billing not enabled."
            )
          );
        });
      }
      return;
    }

    // Inject script
    const script = document.createElement("script");
    script.id = GMAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;

    // IMPORTANT: Places is required for autocomplete
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly`;

    script.onload = () => {
      script.dataset.loaded = "true";
      if (isPlacesReady()) resolve();
      else {
        // Sometimes importLibrary is needed
        const google = (window as any).google;
        if (google?.maps?.importLibrary) {
          google.maps
            .importLibrary("places")
            .then(() => {
              if (isPlacesReady()) resolve();
              else
                reject(
                  new Error(
                    "Google Maps script loaded but Places is unavailable after importLibrary. Check: Places API enabled + billing + key restrictions."
                  )
                );
            })
            .catch(() => {
              reject(
                new Error(
                  "Google Maps importLibrary('places') failed. Check: Places API enabled + billing + key restrictions."
                )
              );
            });
        } else {
          reject(
            new Error(
              "Google Maps script loaded but Places is unavailable. Check: Places API enabled + billing + key restrictions."
            )
          );
        }
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          "Google Maps script failed to load. Likely: referrer not allowed, invalid/disabled key, Places API not enabled, or billing not enabled."
        )
      );
    };

    document.head.appendChild(script);
  });
}

const AddressAutocomplete = ({
  onPlaceSelect,
  placeholder,
  className,
  value,
  onChange,
  types = ["geocode"],
  onError,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [useNewElement, setUseNewElement] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stabilize types dependency to prevent re-init on every render
  const typesKey = JSON.stringify(types ?? []);

  useEffect(() => {
    // Check if we have at least one target element
    const hasTarget = Boolean(inputRef.current || containerRef.current);
    if (!hasTarget) return;

    const { apiKey, source } = getGmapsKey();

    console.log("[AddressAutocomplete] gmaps key source:", source);
    console.log("[AddressAutocomplete] key present:", apiKey ? "[yes]" : "[no]");

    if (!apiKey) {
      console.warn(
        "[AddressAutocomplete] Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY (production) or open the preview URL with ?gmaps_key=YOUR_KEY."
      );
      setLoadError("Autocomplete disabled (missing key)");
      onError?.();
      return;
    }

    // Define initAutocomplete BEFORE it's used (avoid temporal dead zone)
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
          await google.maps.importLibrary("places");
        }
      } catch (e) {
        console.warn(
          "[AddressAutocomplete] importLibrary failed, continuing with loaded script",
          e
        );
      }

      const places = google.maps.places as any;
      console.log(
        "[AddressAutocomplete] Places API loaded, checking for PlaceAutocompleteElement..."
      );

      // Parse types from stabilized key
      const parsedTypes = JSON.parse(typesKey) as string[];

      // Prefer the new Place Autocomplete Element when available
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        console.log("[AddressAutocomplete] PlaceAutocompleteElement available, using new API");
        setUseNewElement(true);
        try {
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          // Try to restrict to US if supported
          try {
            (el as any).componentRestrictions = { country: ["us"] };
          } catch {}
          // Set types if supported
          try {
            (el as any).types = parsedTypes;
          } catch {}
          if (placeholder) {
            try {
              (el as any).placeholder = placeholder;
            } catch {
              el.setAttribute("placeholder", placeholder);
            }
          }
          // Hint to password managers that this is an address field, not credentials
          try {
            el.setAttribute("autocomplete", "street-address");
            el.setAttribute("name", "address_line1");
            el.setAttribute("autocapitalize", "none");
            el.setAttribute("spellcheck", "false");
            el.setAttribute("data-lpignore", "true");
            el.setAttribute("data-1p-ignore", "true");
            el.setAttribute("data-form-type", "other");
          } catch {}
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
              console.log("[AddressAutocomplete] Address components:", mapped.address_components);
              console.log("[AddressAutocomplete] About to call onPlaceSelect callback");
              console.log("[AddressAutocomplete] onPlaceSelect exists?", !!onPlaceSelect);

              if (onPlaceSelect) {
                onPlaceSelect(mapped);
                console.log("[AddressAutocomplete] onPlaceSelect called successfully");
              } else {
                console.error("[AddressAutocomplete] onPlaceSelect callback is missing!");
                onChange?.(mapped.formatted_address || "");
              }
            } catch (err) {
              console.error("[AddressAutocomplete] Error in handleSelect:", err);
            }
          };

          console.log("[AddressAutocomplete] Adding gmp-select event listener");
          el.addEventListener("gmp-select", handleSelect);
          (el as any).__cleanup = () => el.removeEventListener("gmp-select", handleSelect);

          // Initialize value if controlled
          if (value) {
            try {
              (el as any).value = value;
            } catch {}
          }
          console.log("[AddressAutocomplete] PlaceAutocompleteElement setup complete");
          return;
        } catch (e) {
          console.error(
            "[AddressAutocomplete] Error setting up PlaceAutocompleteElement, falling back:",
            e
          );
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
        types: parsedTypes,
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "address_components", "geometry", "name"],
      });

      console.log(
        "[AddressAutocomplete] Legacy Autocomplete created, adding place_changed listener"
      );
      autocompleteRef.current.addListener("place_changed", () => {
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
            const formatted = place.formatted_address || place.name || "";
            onChange?.(formatted);
          }
        } else {
          console.warn("[AddressAutocomplete] No place data received from autocomplete");
        }
      });
      console.log("[AddressAutocomplete] Legacy Autocomplete setup complete");
    };

    // Now call loadGoogleMapsPlaces with initAutocomplete defined above
    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        console.log("[AddressAutocomplete] Google Places ready.");
        setLoadError(null);
        initAutocomplete();
      })
      .catch((err) => {
        console.error("[AddressAutocomplete] Autocomplete disabled:", err?.message || err);
        setLoadError(err?.message || "Autocomplete disabled");
        onError?.();
      });

    return () => {
      if (autocompleteRef.current) {
        // Cleanup for new PlaceAutocompleteElement
        if ((autocompleteRef.current as any).__cleanup) {
          try {
            (autocompleteRef.current as any).__cleanup();
          } catch {}
        }
        // Cleanup for legacy Autocomplete
        if ((window as any).google?.maps?.event) {
          (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      }
    };
  }, [onPlaceSelect, onChange, placeholder, typesKey, value]);

  // Sync controlled value to new element when it changes
  useEffect(() => {
    if (useNewElement && autocompleteRef.current && value !== undefined) {
      try {
        (autocompleteRef.current as any).value = value;
      } catch {}
    }
  }, [useNewElement, value]);

  return (
    <div className="w-full">
      {useNewElement ? (
        <div ref={containerRef} className={className} />
      ) : (
        <Input
          ref={inputRef}
          placeholder={placeholder || "City, State, Zip or Neighborhood"}
          className={className}
          value={value}
          // Prevent password managers from triggering
          name="address_line1"
          autoComplete="street-address"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {loadError && (
        <p className="text-xs text-destructive mt-1">{loadError}</p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
