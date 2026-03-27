import { useEffect, useRef, useState, useCallback } from "react";
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
const DEBUG_PLACES =
  String(import.meta.env.VITE_DEBUG_PLACES ?? "").toLowerCase() === "true";

const debugLog = (...args: any[]) => {
  if (DEBUG_PLACES) {
    console.log(...args);
  }
};

function getGmapsKey(): {
  apiKey?: string;
  source: "url" | "storage" | "env" | "missing";
} {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const urlKey =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("gmaps_key") ??
        undefined)
      : undefined;

  const storedKey =
    typeof window !== "undefined"
      ? (window.localStorage.getItem(GMAPS_KEY_STORAGE) ?? undefined)
      : undefined;

  // Correct priority: URL > localStorage > env
  const apiKey = urlKey || storedKey || envKey;

  // Persist the url key for convenience (preview only)
  if (typeof window !== "undefined" && urlKey) {
    try {
      window.localStorage.setItem(GMAPS_KEY_STORAGE, urlKey);
    } catch {
      // ignore
    }
  }

  const source: "url" | "storage" | "env" | "missing" = urlKey
    ? "url"
    : storedKey
      ? "storage"
      : envKey
        ? "env"
        : "missing";

  return { apiKey: apiKey || undefined, source };
}

function isPlacesReady(): boolean {
  return Boolean(
    (window as any).google?.maps?.places?.Autocomplete,
  );
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded and ready
    if (isPlacesReady()) {
      // Check if loaded script has a different key — if so, remove and re-inject
      const existing = document.getElementById(GMAPS_SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        const loadedSrc = existing.getAttribute("src") || "";
        const loadedKeyMatch = loadedSrc.match(/[?&]key=([^&]+)/);
        const loadedKey = loadedKeyMatch ? decodeURIComponent(loadedKeyMatch[1]) : "";
        if (loadedKey && loadedKey !== apiKey) {
          debugLog("[AddressAutocomplete] Key mismatch detected, removing stale script");
          existing.remove();
          // Clear cached google maps state
          try { delete (window as any).google.maps; } catch {}
          // Fall through to inject fresh script
        } else {
          return resolve();
        }
      } else {
        return resolve();
      }
    }

    const existing = document.getElementById(GMAPS_SCRIPT_ID) as HTMLScriptElement | null;

    // If script exists but Places isn't ready yet, check for key mismatch first
    if (existing) {
      const loadedSrc = existing.getAttribute("src") || "";
      const loadedKeyMatch = loadedSrc.match(/[?&]key=([^&]+)/);
      const loadedKey = loadedKeyMatch ? decodeURIComponent(loadedKeyMatch[1]) : "";

      if (loadedKey && loadedKey !== apiKey) {
        debugLog("[AddressAutocomplete] Stale script with wrong key, removing");
        existing.remove();
        try { delete (window as any).google.maps; } catch {}
        // Fall through to inject fresh script
      } else {
        const checkReady = () => {
          if (isPlacesReady()) {
            resolve();
          } else {
            setTimeout(() => {
              if (isPlacesReady()) resolve();
              else
                reject(
                  new Error(
                    "Google Maps script loaded but Places is unavailable. Check: Places API enabled + billing + key restrictions.",
                  ),
                );
            }, 2000);
          }
        };

        if (existing.dataset.loaded === "true") {
          const hasGmpError = document.querySelector("gmp-internal-error, .gm-err-container");
          if (hasGmpError && !isPlacesReady()) {
            debugLog("[AddressAutocomplete] Detected broken script (gmp-error), removing and re-injecting");
            existing.remove();
            try { delete (window as any).google.maps; } catch {}
            // Fall through to inject fresh script
          } else {
            checkReady();
            return;
          }
        } else {
          existing.addEventListener("load", checkReady);
          existing.addEventListener("error", () => {
            reject(
              new Error(
                "Google Maps script failed to load. Likely: invalid key, referrer restriction, API not enabled, or billing not enabled.",
              ),
            );
          });
          return;
        }
      }
    }

    // Inject script
    const script = document.createElement("script");
    script.id = GMAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places&v=weekly`;

    script.onload = () => {
      script.dataset.loaded = "true";
      if (isPlacesReady()) resolve();
      else {
        const google = (window as any).google;
        if (google?.maps?.importLibrary) {
          google.maps
            .importLibrary("places")
            .then(() => {
              if (isPlacesReady()) resolve();
              else
                reject(
                  new Error(
                    "Google Maps script loaded but Places is unavailable after importLibrary. Check: Places API enabled + billing + key restrictions.",
                  ),
                );
            })
            .catch(() => {
              reject(
                new Error(
                  "Google Maps importLibrary('places') failed. Check: Places API enabled + billing + key restrictions.",
                ),
              );
            });
        } else {
          reject(
            new Error(
              "Google Maps script loaded but Places is unavailable. Check: Places API enabled + billing + key restrictions.",
            ),
          );
        }
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          "Google Maps script failed to load. Likely: referrer not allowed, invalid/disabled key, Places API not enabled, or billing not enabled.",
        ),
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
  const autocompleteRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const placesReadyRef = useRef(false);
  const initializedRef = useRef(false);
  const userTypingRef = useRef(false);
  const fallbackRef = useRef(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Stable callback refs (synced every time props change, no re-init) ---
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
    onChangeRef.current = onChange;
    onErrorRef.current = onError;
  }, [onPlaceSelect, onChange, onError]);

  // Stabilize types dependency
  const typesKey = JSON.stringify(types ?? []);

  // --- Init effect: runs ONCE on mount ---
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    if (!inputRef.current) return;

    const { apiKey, source } = getGmapsKey();

    debugLog("[AddressAutocomplete] gmaps key source:", source);
    debugLog("[AddressAutocomplete] key present:", apiKey ? "[yes]" : "[no]");

    if (!apiKey) {
      console.warn(
        "[AddressAutocomplete] Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY (production) or open the preview URL with ?gmaps_key=YOUR_KEY.",
      );
      setLoadError("Autocomplete disabled (missing key)");
      onErrorRef.current?.();
      return;
    }

    const markPlacesReady = () => {
      if (!isMounted) return;
      placesReadyRef.current = true;
      setPlacesReady(true);
    };

    const initAutocomplete = async () => {
      debugLog("=== [AddressAutocomplete] initAutocomplete called ===");
      const google = (window as any).google;
      if (!google?.maps?.places) {
        console.error("[AddressAutocomplete] Google Maps Places not available");
        return;
      }

      try {
        if (google.maps.importLibrary) {
          debugLog("[AddressAutocomplete] Awaiting importLibrary('places')...");
          await google.maps.importLibrary("places");
        }
      } catch (e) {
        console.warn(
          "[AddressAutocomplete] importLibrary failed, continuing with loaded script",
          e,
        );
      }

      const parsedTypes = JSON.parse(typesKey) as string[];

      // --- Legacy autocomplete only ---
      debugLog("[AddressAutocomplete] Using legacy Autocomplete");
      if (!inputRef.current) {
        console.error("[AddressAutocomplete] inputRef.current is null");
        return;
      }

      if (!google?.maps?.places?.Autocomplete) {
        debugLog("[AddressAutocomplete] Legacy Autocomplete not available");
        return;
      }

      autocompleteRef.current = new google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: parsedTypes,
          componentRestrictions: { country: "us" },
          fields: [
            "formatted_address",
            "address_components",
            "geometry",
            "name",
            "place_id",
          ],
        },
      );

      debugLog(
        "[AddressAutocomplete] Legacy Autocomplete created, adding place_changed listener",
      );
      const placeChangedListener = autocompleteRef.current.addListener(
        "place_changed",
        () => {
          if (!placesReadyRef.current) {
            console.warn(
              "[AddressAutocomplete] Ignoring place_changed before ready",
            );
            return;
          }

          const currentRequestId = ++requestIdRef.current;
          debugLog("=== [AddressAutocomplete] place_changed EVENT FIRED ===");
          const place = autocompleteRef.current?.getPlace();
          debugLog("[AddressAutocomplete] Place data:", place);
          if (!place) {
            console.warn(
              "[AddressAutocomplete] No place data received from autocomplete",
            );
            return;
          }

          const hasAddressComponents =
            Array.isArray(place.address_components) &&
            place.address_components.length > 0;

          const callOnPlaceSelect = (finalPlace: any) => {
            if (currentRequestId !== requestIdRef.current) {
              debugLog(
                "[AddressAutocomplete] Ignoring stale legacy place result",
                currentRequestId,
                requestIdRef.current,
              );
              return;
            }

            const finalHasAddressComponents =
              Array.isArray(finalPlace?.address_components) &&
              finalPlace.address_components.length > 0;

            if (!finalHasAddressComponents) {
              debugLog(
                "[AddressAutocomplete] Partial legacy place received",
                finalPlace,
              );
              return;
            }

            debugLog(
              "[AddressAutocomplete] Calling onPlaceSelect with place data",
              "formatted_address:", finalPlace.formatted_address,
              "place_id:", finalPlace.place_id,
              "source: legacy",
            );

            if (onPlaceSelectRef.current) {
              onPlaceSelectRef.current(finalPlace);
              debugLog(
                "[AddressAutocomplete] onPlaceSelect called successfully",
              );
            } else {
              console.error(
                "[AddressAutocomplete] onPlaceSelect callback is missing!",
              );
              const formatted =
                finalPlace.formatted_address || finalPlace.name || "";
              onChangeRef.current?.(formatted);
            }
          };

          const emitSafeFallback = () => {
            if (currentRequestId !== requestIdRef.current) {
              return;
            }

            const fallbackAddress =
              place.formatted_address || place.name || inputRef.current?.value;

            if (fallbackAddress) {
              onChangeRef.current?.(fallbackAddress);
            }
          };

          if (hasAddressComponents) {
            callOnPlaceSelect(place);
            return;
          }

          const placeId = place.place_id;
          if (!placeId) {
            debugLog(
              "[AddressAutocomplete] Partial legacy place with no place_id",
              place,
            );
            return;
          }

          const placesService = new google.maps.places.PlacesService(
            document.createElement("div"),
          );

          placesService.getDetails(
            {
              placeId,
              fields: [
                "formatted_address",
                "address_components",
                "geometry",
                "name",
                "place_id",
              ],
            },
            (details: any, status: any) => {
              debugLog(
                "[AddressAutocomplete] PlacesService.getDetails status:",
                status,
                "formatted_address:",
                details?.formatted_address,
                "source: legacy-fallback",
              );

              if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !details
              ) {
                debugLog(
                  "[AddressAutocomplete] Failed to fetch legacy place details",
                  status,
                  place,
                );
                emitSafeFallback();
                return;
              }

              callOnPlaceSelect(details);
            },
          );
        },
      );

      if (!placeChangedListener) {
        throw new Error("Failed to attach place_changed listener");
      }

      markPlacesReady();
      debugLog("[AddressAutocomplete] Legacy Autocomplete setup complete");
    };

    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        if (!isMounted) return;
        debugLog("[AddressAutocomplete] Google Places ready.");
        setLoadError(null);
        initAutocomplete();
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(
          "[AddressAutocomplete] Autocomplete disabled:",
          err?.message || err,
        );
        setLoadError(err?.message || "Autocomplete disabled");
        onErrorRef.current?.();
      });

    return () => {
      isMounted = false;
      placesReadyRef.current = false;
      initializedRef.current = false;
      if (autocompleteRef.current) {
        if ((window as any).google?.maps?.event) {
          (window as any).google.maps.event.clearInstanceListeners(
            autocompleteRef.current,
          );
        }
      }
      autocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Lightweight prop updater: push placeholder/types changes without re-init ---
  useEffect(() => {
    if (!autocompleteRef.current) return;
    const parsedTypes = JSON.parse(typesKey) as string[];

    if (autocompleteRef.current.setOptions) {
      try {
        autocompleteRef.current.setOptions({ types: parsedTypes });
      } catch {}
    }
  }, [typesKey, placeholder]);

  // --- Native input listener for Shadow DOM sync ---
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => { userTypingRef.current = true; };
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, []);

  const handleBlur = useCallback(() => {
    userTypingRef.current = false;
  }, []);

  return (
    <div className="w-full">
      <Input
        ref={inputRef}
        placeholder={placeholder || "Start typing an address..."}
        className={className}
        value={value}
        name="address_line1"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="text"
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        onChange={(e) => onChangeRef.current?.(e.target.value)}
        onBlur={handleBlur}
      />
      {loadError && (
        <p className="text-xs text-destructive mt-1">{loadError}</p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
