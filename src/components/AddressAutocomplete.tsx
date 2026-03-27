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
const DEBUG_PLACES =
  String(import.meta.env.VITE_DEBUG_PLACES ?? "").toLowerCase() === "true";

const debugLog = (...args: any[]) => {
  if (DEBUG_PLACES) {
    console.log(...args);
  }
};

function getGmapsKey(): {
  apiKey?: string;
  source: "env" | "url" | "storage" | "missing";
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
      (window as any).google?.maps?.places?.PlaceAutocompleteElement),
  );
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded and ready
    if (isPlacesReady()) return resolve();

    const existing = document.getElementById(
      GMAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    // If script exists but Places isn't ready yet, wait for it
    if (existing) {
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
        checkReady();
      } else {
        existing.addEventListener("load", checkReady);
        existing.addEventListener("error", () => {
          reject(
            new Error(
              "Google Maps script failed to load. Likely: invalid key, referrer restriction, API not enabled, or billing not enabled.",
            ),
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
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const placesReadyRef = useRef(false);
  const initializedRef = useRef(false);
  const [useNewElement, setUseNewElement] = useState(false);
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

    const hasTarget = Boolean(inputRef.current || containerRef.current);
    if (!hasTarget) return;

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

      const places = google.maps.places as any;
      debugLog(
        "[AddressAutocomplete] Places API loaded, checking for PlaceAutocompleteElement...",
      );

      const parsedTypes = JSON.parse(typesKey) as string[];

      // Prefer the new Place Autocomplete Element when available
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        debugLog(
          "[AddressAutocomplete] PlaceAutocompleteElement available, using new API",
        );
        try {
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          try {
            (el as any).componentRestrictions = { country: ["us"] };
          } catch {}
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
            if (!placesReadyRef.current) {
              console.warn(
                "[AddressAutocomplete] Ignoring place selection before ready",
              );
              return;
            }

            const currentRequestId = ++requestIdRef.current;
            debugLog(
              "=== [AddressAutocomplete] gmp-placeselect EVENT FIRED ===",
            );
            try {
              const prediction = event?.placePrediction;
              debugLog("[AddressAutocomplete] Prediction:", prediction);
              if (!prediction) {
                console.warn("[AddressAutocomplete] No prediction in event");
                return;
              }

              const place = await prediction.toPlace();
              if (!place) {
                debugLog(
                  "[AddressAutocomplete] Partial place received from gmp-placeselect (no place after prediction.toPlace)",
                );
                return;
              }

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

              if (currentRequestId !== requestIdRef.current) {
                debugLog(
                  "[AddressAutocomplete] Ignoring stale place result",
                  currentRequestId,
                  requestIdRef.current,
                );
                return;
              }

              const hasAddressComponents =
                Array.isArray(place.addressComponents) &&
                place.addressComponents.length > 0;

              // --- Deterministic legacy fallback when new API returns empty components ---
              if (!hasAddressComponents) {
                const placeId = place.id;
                debugLog(
                  "[AddressAutocomplete] New API returned empty components, attempting legacy fallback for placeId:",
                  placeId,
                );
                if (placeId && google.maps.places.PlacesService) {
                  const svc = new google.maps.places.PlacesService(
                    document.createElement("div"),
                  );
                  svc.getDetails(
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
                      if (currentRequestId !== requestIdRef.current) return;
                      debugLog(
                        "[AddressAutocomplete] Legacy fallback status:",
                        status,
                        "formatted_address:",
                        details?.formatted_address,
                        "source: legacy-fallback",
                      );
                      if (
                        status ===
                          google.maps.places.PlacesServiceStatus.OK &&
                        details
                      ) {
                        onPlaceSelectRef.current?.(details);
                      }
                    },
                  );
                  return;
                }
                // No placeId available, nothing we can do
                return;
              }

              const mapAddressComponent = (component: any) => ({
                long_name:
                  component?.longText ||
                  component?.long_name ||
                  component?.shortText ||
                  component?.short_name ||
                  "",
                short_name:
                  component?.shortText ||
                  component?.short_name ||
                  component?.longText ||
                  "",
                types: Array.isArray(component?.types) ? component.types : [],
              });

              const mapped = {
                formatted_address: place.formattedAddress || "",
                address_components: (place.addressComponents || []).map(
                  mapAddressComponent,
                ),
                geometry: place.location
                  ? {
                      location: {
                        lat: () => place.location.lat(),
                        lng: () => place.location.lng(),
                      },
                      viewport: place.viewport,
                    }
                  : undefined,
                name: place.displayName?.text || "",
                place_id: place.id || "",
              };

              debugLog(
                "[AddressAutocomplete] Mapped place:",
                mapped,
                "source: new-api",
              );

              if (onPlaceSelectRef.current) {
                onPlaceSelectRef.current(mapped);
                debugLog(
                  "[AddressAutocomplete] onPlaceSelect called successfully",
                );
              } else {
                console.error(
                  "[AddressAutocomplete] onPlaceSelect callback is missing!",
                );
                onChangeRef.current?.(mapped.formatted_address || mapped.name || "");
              }
            } catch (err) {
              console.error(
                "[AddressAutocomplete] Error in handleSelect:",
                err,
              );
            }
          };

          debugLog(
            "[AddressAutocomplete] Adding gmp-placeselect event listener",
          );
          el.addEventListener("gmp-placeselect", handleSelect);
          el.addEventListener("gmp-select", handleSelect);
          (el as any).__cleanup = () => {
            el.removeEventListener("gmp-placeselect", handleSelect);
            el.removeEventListener("gmp-select", handleSelect);
          };

          if (value) {
            try {
              (el as any).value = value;
            } catch {}
          }

          setUseNewElement(true);
          markPlacesReady();
          debugLog(
            "[AddressAutocomplete] PlaceAutocompleteElement setup complete",
          );
          return;
        } catch (e) {
          console.error(
            "[AddressAutocomplete] Error setting up PlaceAutocompleteElement, falling back:",
            e,
          );
          setUseNewElement(false);
        }
      }

      // Legacy Autocomplete
      debugLog("[AddressAutocomplete] Using legacy Autocomplete");
      if (!inputRef.current) {
        console.error("[AddressAutocomplete] inputRef.current is null");
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

      // Cleanup listeners but do NOT reset initializedRef (avoids double-init in StrictMode)
      if (autocompleteRef.current) {
        if ((autocompleteRef.current as any).__cleanup) {
          try {
            (autocompleteRef.current as any).__cleanup();
          } catch {}
        }
        if ((window as any).google?.maps?.event) {
          (window as any).google.maps.event.clearInstanceListeners(
            autocompleteRef.current,
          );
        }
      }

      autocompleteRef.current = null;

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Lightweight prop updater: push placeholder/types changes without re-init ---
  useEffect(() => {
    if (!autocompleteRef.current) return;
    const parsedTypes = JSON.parse(typesKey) as string[];

    // Legacy Autocomplete
    if (autocompleteRef.current.setOptions) {
      try {
        autocompleteRef.current.setOptions({ types: parsedTypes });
      } catch {}
    }
    // New PlaceAutocompleteElement
    try {
      (autocompleteRef.current as any).types = parsedTypes;
    } catch {}

    if (placeholder) {
      try {
        (autocompleteRef.current as any).placeholder = placeholder;
      } catch {}
      try {
        autocompleteRef.current.setAttribute?.("placeholder", placeholder);
      } catch {}
    }
  }, [typesKey, placeholder]);

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
          placeholder={
            placesReady
              ? placeholder || "City, State, Zip or Neighborhood"
              : "Loading address search..."
          }
          className={className}
          value={value}
          disabled={!placesReady}
          name="address_line1"
          autoComplete="street-address"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          onChange={(e) => onChangeRef.current?.(e.target.value)}
        />
      )}
      {loadError && (
        <p className="text-xs text-destructive mt-1">{loadError}</p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
