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

// --- Constants ---
const GOOGLE_SCRIPT_ID = "google-maps-places-script";
const GMAPS_KEY_STORAGE = "aac_gmaps_key";
const DEBUG_PLACES =
  String(import.meta.env.VITE_DEBUG_PLACES ?? "").toLowerCase() === "true";

const debugLog = (...args: any[]) => {
  if (DEBUG_PLACES) console.log(...args);
};

// --- Module-level loader state (allows reset on bad loads) ---
let loaderPromise: Promise<void> | null = null;
let loaderKeyUsed: string | null = null;

// --- 1. Single key resolver ---
function resolveGmapsKey(): string | null {
  let urlKey: string | undefined;
  let storedKey: string | undefined;

  if (typeof window !== "undefined") {
    urlKey = new URLSearchParams(window.location.search).get("gmaps_key")?.trim() || undefined;
    storedKey = window.localStorage.getItem(GMAPS_KEY_STORAGE)?.trim() || undefined;

    // Persist URL key to localStorage for future visits
    if (urlKey) {
      try { window.localStorage.setItem(GMAPS_KEY_STORAGE, urlKey); } catch {}
    }
  }

  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || undefined;

  // Priority: URL > localStorage > env
  const key = urlKey || storedKey || envKey;
  const source = urlKey ? "url" : storedKey ? "storage" : envKey ? "env" : "missing";
  debugLog("[AddressAutocomplete] gmaps key source:", source, "key present:", key ? "[yes]" : "[no]");

  return key || null;
}

// --- 2. Places-usable helper ---
function isGooglePlacesUsable(): boolean {
  return !!(
    (window as any).google?.maps?.places &&
    typeof (window as any).google.maps.places.Autocomplete === "function"
  );
}

// --- 4. Reset helper for stale/bad script state ---
function resetGooglePlacesScriptState() {
  const existing = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existing) {
    existing.remove();
    debugLog("[AddressAutocomplete] Removed stale Google script");
  }
  loaderPromise = null;
  loaderKeyUsed = null;
}

// --- 3. Key-aware, retry-safe loader ---
function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  // If we already loaded with this exact key and Places is usable, reuse
  if (loaderPromise && loaderKeyUsed === apiKey && isGooglePlacesUsable()) {
    return loaderPromise;
  }

  // If loader exists but key changed or Places is broken, reset
  if (loaderPromise && (loaderKeyUsed !== apiKey || !isGooglePlacesUsable())) {
    debugLog("[AddressAutocomplete] Stale/mismatched loader detected, resetting");
    resetGooglePlacesScriptState();
  }

  // Check for existing script tag from a prior load
  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    const scriptKey = existingScript.dataset.gmapsKey;
    if (scriptKey !== apiKey) {
      debugLog("[AddressAutocomplete] Script key mismatch, removing old script");
      resetGooglePlacesScriptState();
    } else if (existingScript.dataset.loaded === "true" && !isGooglePlacesUsable()) {
      debugLog("[AddressAutocomplete] Script loaded but Places unusable, resetting");
      resetGooglePlacesScriptState();
    } else if (existingScript.dataset.loaded === "true" && isGooglePlacesUsable()) {
      loaderPromise = Promise.resolve();
      loaderKeyUsed = apiKey;
      return loaderPromise;
    }
  }

  loaderKeyUsed = apiKey;

  loaderPromise = new Promise<void>((resolve, reject) => {
    // Double-check after reset: maybe already usable (rare)
    if (isGooglePlacesUsable()) return resolve();

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.dataset.gmapsKey = apiKey;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;

    script.onload = () => {
      script.dataset.loaded = "true";
      if (isGooglePlacesUsable()) return resolve();

      const google = (window as any).google;
      if (google?.maps?.importLibrary) {
        google.maps.importLibrary("places")
          .then(() => {
            if (isGooglePlacesUsable()) resolve();
            else {
              loaderPromise = null;
              reject(new Error("Google Maps script loaded but Places unavailable after importLibrary."));
            }
          })
          .catch(() => {
            loaderPromise = null;
            reject(new Error("importLibrary('places') failed."));
          });
      } else {
        loaderPromise = null;
        reject(new Error("Google Maps script loaded but Places unavailable."));
      }
    };

    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Google Maps script failed to load (referrer/key/billing issue)."));
    };

    document.head.appendChild(script);
  });

  // If the promise rejects, clear loader state so retry is possible
  loaderPromise.catch(() => {
    loaderPromise = null;
    loaderKeyUsed = null;
  });

  return loaderPromise;
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
  const legacyAutocompleteRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const placesReadyRef = useRef(false);
  const initializedRef = useRef(false);
  const [useNewElement, setUseNewElement] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const userTypingRef = useRef(false);
  const hasFallenBackRef = useRef(false);
  const legacyAttachedRef = useRef(false);

  // Stable callback refs
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
    onChangeRef.current = onChange;
    onErrorRef.current = onError;
  }, [onPlaceSelect, onChange, onError]);

  const typesKey = JSON.stringify(types ?? []);

  // --- 8. Legacy autocomplete initializer (re-initializable) ---
  const initLegacyAutocomplete = useCallback(() => {
    if (!inputRef.current) return false;
    if (!isGooglePlacesUsable()) return false;

    // Clean up any prior legacy instance
    if (legacyAutocompleteRef.current) {
      try {
        (window as any).google?.maps?.event?.clearInstanceListeners(legacyAutocompleteRef.current);
      } catch {}
      legacyAutocompleteRef.current = null;
    }
    legacyAttachedRef.current = false;

    const google = (window as any).google;
    const parsedTypes = JSON.parse(typesKey) as string[];

    try {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: parsedTypes,
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "address_components", "geometry", "name", "place_id"],
      });

      const listener = ac.addListener("place_changed", () => {
        if (!placesReadyRef.current) return;
        userTypingRef.current = false;
        const currentRequestId = ++requestIdRef.current;
        const place = ac.getPlace();
        debugLog("[AddressAutocomplete] Legacy place_changed:", place);
        if (!place) return;

        const hasComponents = Array.isArray(place.address_components) && place.address_components.length > 0;

        const emitPlace = (finalPlace: any) => {
          if (currentRequestId !== requestIdRef.current) return;
          if (!Array.isArray(finalPlace?.address_components) || !finalPlace.address_components.length) return;
          debugLog("[AddressAutocomplete] onPlaceSelect (legacy):", finalPlace.formatted_address);
          if (onPlaceSelectRef.current) {
            onPlaceSelectRef.current(finalPlace);
          } else {
            onChangeRef.current?.(finalPlace.formatted_address || finalPlace.name || "");
          }
        };

        if (hasComponents) {
          emitPlace(place);
          return;
        }

        // Fallback: fetch details by place_id
        const placeId = place.place_id;
        if (!placeId) return;
        const svc = new google.maps.places.PlacesService(document.createElement("div"));
        svc.getDetails(
          { placeId, fields: ["formatted_address", "address_components", "geometry", "name", "place_id"] },
          (details: any, status: any) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && details) {
              emitPlace(details);
            } else {
              if (currentRequestId === requestIdRef.current) {
                onChangeRef.current?.(place.formatted_address || place.name || inputRef.current?.value || "");
              }
            }
          }
        );
      });

      if (!listener) return false;

      legacyAutocompleteRef.current = ac;
      legacyAttachedRef.current = true;
      placesReadyRef.current = true;
      setPlacesReady(true);
      debugLog("[AddressAutocomplete] Legacy Autocomplete attached successfully");
      return true;
    } catch (e) {
      console.warn("[AddressAutocomplete] Failed to init legacy autocomplete:", e);
      return false;
    }
  }, [typesKey]);

  // --- 5. Unified guarded recovery path ---
  const attemptRecovery = useCallback((reason: string) => {
    if (hasFallenBackRef.current) return;
    hasFallenBackRef.current = true;

    console.warn(`[AddressAutocomplete] Recovery triggered: ${reason}`);

    // Disable new element
    setUseNewElement(false);

    // Clean up the new element
    if (autocompleteRef.current?.__cleanup) {
      try { autocompleteRef.current.__cleanup(); } catch {}
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
    autocompleteRef.current = null;

    // Try legacy autocomplete first (step 7)
    // Need a small delay so the plain <Input> is rendered first
    setTimeout(() => {
      if (isGooglePlacesUsable()) {
        const ok = initLegacyAutocomplete();
        if (ok) {
          setLoadError(null);
          debugLog("[AddressAutocomplete] Recovered to legacy autocomplete with suggestions");
          return;
        }
      }
      // Legacy also failed — plain input only
      setLoadError("Address suggestions unavailable");
      onErrorRef.current?.();
    }, 50);
  }, [initLegacyAutocomplete]);

  // --- Retry handler ---
  const handleRetry = useCallback(async () => {
    setLoadError(null);
    hasFallenBackRef.current = false;
    initializedRef.current = false;
    setUseNewElement(false);
    setPlacesReady(false);

    resetGooglePlacesScriptState();

    const apiKey = resolveGmapsKey();
    if (!apiKey) {
      setLoadError("Autocomplete disabled (missing key)");
      return;
    }

    try {
      await loadGoogleMapsPlaces(apiKey);
      if (isGooglePlacesUsable()) {
        const ok = initLegacyAutocomplete();
        if (ok) {
          setLoadError(null);
          debugLog("[AddressAutocomplete] Retry succeeded with legacy autocomplete");
        } else {
          setLoadError("Address suggestions unavailable");
        }
      } else {
        setLoadError("Address suggestions unavailable");
      }
    } catch (err: any) {
      setLoadError(err?.message || "Autocomplete disabled");
    }
  }, [initLegacyAutocomplete]);

  // --- Init effect ---
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    const hasTarget = Boolean(inputRef.current || containerRef.current);
    if (!hasTarget) return;

    const apiKey = resolveGmapsKey();

    if (!apiKey) {
      console.warn("[AddressAutocomplete] Google Maps key missing.");
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
          await google.maps.importLibrary("places");
        }
      } catch (e) {
        console.warn("[AddressAutocomplete] importLibrary failed, continuing", e);
      }

      const places = google.maps.places as any;
      const parsedTypes = JSON.parse(typesKey) as string[];

      // --- Try new PlaceAutocompleteElement first ---
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        debugLog("[AddressAutocomplete] Trying PlaceAutocompleteElement");
        try {
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          try { (el as any).componentRestrictions = { country: ["us"] }; } catch {}
          try { (el as any).types = parsedTypes; } catch {}
          if (placeholder) {
            try { (el as any).placeholder = placeholder; } catch {
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

          // --- Place selection handler ---
          const handleSelect = async (event: any) => {
            if (!placesReadyRef.current) return;
            userTypingRef.current = false;
            const currentRequestId = ++requestIdRef.current;
            debugLog("[AddressAutocomplete] gmp-placeselect fired");
            try {
              const prediction = event?.placePrediction;
              if (!prediction) return;

              const place = await prediction.toPlace();
              if (!place) return;

              await place.fetchFields({
                fields: ["formattedAddress", "addressComponents", "location", "viewport", "id", "displayName"],
              });

              if (currentRequestId !== requestIdRef.current) return;

              const hasAddressComponents = Array.isArray(place.addressComponents) && place.addressComponents.length > 0;

              // Legacy fallback for empty components
              if (!hasAddressComponents) {
                const placeId = place.id;
                if (placeId && google.maps.places.PlacesService) {
                  const svc = new google.maps.places.PlacesService(document.createElement("div"));
                  svc.getDetails(
                    { placeId, fields: ["formatted_address", "address_components", "geometry", "name", "place_id"] },
                    (details: any, status: any) => {
                      if (currentRequestId !== requestIdRef.current) return;
                      if (status === google.maps.places.PlacesServiceStatus.OK && details) {
                        onPlaceSelectRef.current?.(details);
                      }
                    }
                  );
                }
                return;
              }

              const mapComp = (c: any) => ({
                long_name: c?.longText || c?.long_name || c?.shortText || c?.short_name || "",
                short_name: c?.shortText || c?.short_name || c?.longText || "",
                types: Array.isArray(c?.types) ? c.types : [],
              });

              const mapped = {
                formatted_address: place.formattedAddress || "",
                address_components: (place.addressComponents || []).map(mapComp),
                geometry: place.location ? {
                  location: { lat: () => place.location.lat(), lng: () => place.location.lng() },
                  viewport: place.viewport,
                } : undefined,
                name: place.displayName?.text || "",
                place_id: place.id || "",
              };

              debugLog("[AddressAutocomplete] Mapped place (new API):", mapped);
              if (onPlaceSelectRef.current) {
                onPlaceSelectRef.current(mapped);
              } else {
                onChangeRef.current?.(mapped.formatted_address || mapped.name || "");
              }
            } catch (err) {
              console.error("[AddressAutocomplete] handleSelect error:", err);
            }
          };

          el.addEventListener("gmp-placeselect", handleSelect);
          el.addEventListener("gmp-select", handleSelect);

          // --- 6. Error listeners funneling into unified recovery ---
          hasFallenBackRef.current = false;

          const handleGmpError = () => {
            if (!isMounted) return;
            // Also reset script state so a future valid key can recover
            resetGooglePlacesScriptState();
            attemptRecovery("gmp-error event");
          };
          el.addEventListener("gmp-error", handleGmpError);

          // Delayed silent-failure detector
          const errorCheckTimeout = window.setTimeout(() => {
            if (!isMounted || hasFallenBackRef.current) return;
            const checkDom = (root: ParentNode | null | undefined): boolean => {
              if (!root) return false;
              if (root.querySelector(".gm-err-message")) return true;
              return Array.from(root.querySelectorAll("*")).some((node) =>
                node.textContent?.includes("Oops! Something went wrong") ||
                node.textContent?.includes("This page can't load Google Maps correctly")
              );
            };
            const shadowRoot = (el as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot;
            if (checkDom(el) || checkDom(shadowRoot)) {
              resetGooglePlacesScriptState();
              attemptRecovery("silent broken element detected");
            }
          }, 3000);

          // --- Wire up input listener for manual typing ---
          let innerInput: HTMLInputElement | null = null;
          const handleInput = (e: Event) => {
            const target = e.target as HTMLInputElement;
            userTypingRef.current = true;
            onChangeRef.current?.(target.value);
          };

          const attachInputListener = () => {
            innerInput = el.querySelector("input") || el.shadowRoot?.querySelector("input") || null;
            if (innerInput) {
              innerInput.addEventListener("input", handleInput);
            }
          };
          attachInputListener();
          if (!innerInput) setTimeout(attachInputListener, 200);

          // Cleanup
          (el as any).__cleanup = () => {
            el.removeEventListener("gmp-placeselect", handleSelect);
            el.removeEventListener("gmp-select", handleSelect);
            el.removeEventListener("gmp-error", handleGmpError);
            clearTimeout(errorCheckTimeout);
            if (innerInput) innerInput.removeEventListener("input", handleInput);
          };

          if (value) {
            try { (el as any).value = value; } catch {}
          }

          setUseNewElement(true);
          markPlacesReady();
          debugLog("[AddressAutocomplete] PlaceAutocompleteElement setup complete");
          return;
        } catch (e) {
          console.error("[AddressAutocomplete] PlaceAutocompleteElement setup failed, trying legacy:", e);
          setUseNewElement(false);
        }
      }

      // --- Legacy Autocomplete path ---
      debugLog("[AddressAutocomplete] Using legacy Autocomplete");
      const ok = initLegacyAutocomplete();
      if (!ok) {
        console.error("[AddressAutocomplete] Legacy autocomplete also failed");
      }
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
        console.error("[AddressAutocomplete] Autocomplete disabled:", err?.message || err);
        setLoadError(err?.message || "Autocomplete disabled");
        onErrorRef.current?.();
      });

    return () => {
      isMounted = false;
      placesReadyRef.current = false;

      if (autocompleteRef.current) {
        if ((autocompleteRef.current as any).__cleanup) {
          try { (autocompleteRef.current as any).__cleanup(); } catch {}
        }
        if ((window as any).google?.maps?.event) {
          try { (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current); } catch {}
        }
      }
      autocompleteRef.current = null;

      if (legacyAutocompleteRef.current) {
        try { (window as any).google?.maps?.event?.clearInstanceListeners(legacyAutocompleteRef.current); } catch {}
        legacyAutocompleteRef.current = null;
      }
      legacyAttachedRef.current = false;

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Prop updater (types/placeholder) ---
  useEffect(() => {
    if (!autocompleteRef.current) return;
    const parsedTypes = JSON.parse(typesKey) as string[];

    if (autocompleteRef.current.setOptions) {
      try { autocompleteRef.current.setOptions({ types: parsedTypes }); } catch {}
    }
    try { (autocompleteRef.current as any).types = parsedTypes; } catch {}

    if (placeholder) {
      try { (autocompleteRef.current as any).placeholder = placeholder; } catch {}
      try { autocompleteRef.current.setAttribute?.("placeholder", placeholder); } catch {}
    }
  }, [typesKey, placeholder]);

  // --- Sync controlled value to new element (guarded by userTypingRef) ---
  useEffect(() => {
    if (useNewElement && autocompleteRef.current && value !== undefined && !userTypingRef.current) {
      try { (autocompleteRef.current as any).value = value; } catch {}
    }
  }, [useNewElement, value]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className={className}
        style={{ display: useNewElement ? undefined : "none" }}
      />
      {!useNewElement && (
        <Input
          ref={inputRef}
          placeholder={placeholder || "City, State, Zip or Neighborhood"}
          className={className}
          value={value}
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
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-primary underline hover:text-primary/80"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
