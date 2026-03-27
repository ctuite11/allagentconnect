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

// --- Key resolution: URL > localStorage > env ---
function getGmapsKey(): {
  apiKey?: string;
  source: "env" | "url" | "storage" | "missing";
} {
  const urlKey =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("gmaps_key") ?? undefined)
      : undefined;

  const storedKey =
    typeof window !== "undefined"
      ? (window.localStorage.getItem(GMAPS_KEY_STORAGE) ?? undefined)
      : undefined;

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Priority: URL key > stored key > env key
  const apiKey = urlKey || storedKey || envKey;

  // Persist the url key for convenience (preview only)
  if (typeof window !== "undefined" && urlKey) {
    try {
      window.localStorage.setItem(GMAPS_KEY_STORAGE, urlKey);
    } catch {
      // ignore
    }
  }

  const source: "env" | "url" | "storage" | "missing" = urlKey
    ? "url"
    : storedKey
      ? "storage"
      : envKey
        ? "env"
        : "missing";

  return { apiKey: apiKey || undefined, source };
}

// --- Strict runtime health check ---
function isPlacesHealthy(): boolean {
  const g = (window as any).google;
  return Boolean(
    g?.maps?.places &&
    (typeof g.maps.places.Autocomplete === "function" ||
      typeof g.maps.places.PlaceAutocompleteElement === "function"),
  );
}

// --- Cached loader state (module-level) ---
let loaderPromise: Promise<void> | null = null;
let loadedWithKey: string | null = null;

function removeGoogleScript() {
  const existing = document.getElementById(GMAPS_SCRIPT_ID);
  if (existing) existing.remove();
  // Also remove any Google-injected scripts
  document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(s => s.remove());
  // Clear window.google to allow clean re-init
  try { delete (window as any).google; } catch { (window as any).google = undefined; }
  loaderPromise = null;
  loadedWithKey = null;
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  // If already loaded with the SAME key and healthy, reuse
  if (loadedWithKey === apiKey && isPlacesHealthy()) {
    return Promise.resolve();
  }

  // If loaded with a DIFFERENT key, or loaded but broken — remove and retry
  if (loadedWithKey && loadedWithKey !== apiKey) {
    debugLog("[AddressAutocomplete] Key mismatch, removing old Google script. Old:", loadedWithKey?.slice(-6), "New:", apiKey?.slice(-6));
    removeGoogleScript();
  } else if (loadedWithKey === apiKey && !isPlacesHealthy()) {
    debugLog("[AddressAutocomplete] Same key but Places unhealthy, removing and retrying");
    removeGoogleScript();
  }

  // If there's already a pending promise for this key, reuse it
  if (loaderPromise && loadedWithKey === apiKey) {
    return loaderPromise;
  }

  loadedWithKey = apiKey;

  loaderPromise = new Promise((resolve, reject) => {
    // Remove any lingering script
    const existing = document.getElementById(GMAPS_SCRIPT_ID);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = GMAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.dataset.key = apiKey;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;

    script.onload = () => {
      script.dataset.loaded = "true";
      if (isPlacesHealthy()) {
        resolve();
        return;
      }
      const google = (window as any).google;
      if (google?.maps?.importLibrary) {
        google.maps
          .importLibrary("places")
          .then(() => {
            if (isPlacesHealthy()) resolve();
            else reject(new Error("Google Maps script loaded but Places is unavailable after importLibrary."));
          })
          .catch(() => {
            reject(new Error("Google Maps importLibrary('places') failed."));
          });
      } else {
        reject(new Error("Google Maps script loaded but Places is unavailable."));
      }
    };

    script.onerror = () => {
      loadedWithKey = null;
      loaderPromise = null;
      reject(new Error("Google Maps script failed to load. Likely: referrer not allowed, invalid/disabled key, Places API not enabled, or billing not enabled."));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}

// --- Detect broken Google element in DOM ---
function isGoogleElementBroken(container: HTMLElement | null): boolean {
  if (!container) return false;
  // Check for Google error overlays
  const text = container.textContent || "";
  if (text.includes("Oops! Something went wrong") || text.includes("This page can't load Google Maps")) {
    return true;
  }
  // Check for gmp-internal-error
  if (container.querySelector('[class*="error"]') || container.querySelector('gmp-internal-error')) {
    return true;
  }
  return false;
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
  const resolvedKeyRef = useRef<string | undefined>(undefined);
  const userTypingRef = useRef(false);
  const brokenCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<"new-element" | "legacy" | "plain">("plain");
  const [placesReady, setPlacesReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Stable callback refs ---
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const valueRef = useRef(value);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
    onChangeRef.current = onChange;
    onErrorRef.current = onError;
    valueRef.current = value;
  }, [onPlaceSelect, onChange, onError, value]);

  const typesKey = JSON.stringify(types ?? []);

  // --- Fallback to legacy autocomplete ---
  const initLegacyAutocomplete = useCallback(() => {
    const google = (window as any).google;
    if (!google?.maps?.places?.Autocomplete || !inputRef.current) {
      debugLog("[AddressAutocomplete] Legacy Autocomplete not available, staying on plain input");
      setMode("plain");
      return;
    }

    debugLog("[AddressAutocomplete] Initializing legacy Autocomplete");
    const parsedTypes = JSON.parse(typesKey) as string[];

    try {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: parsedTypes,
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "address_components", "geometry", "name", "place_id"],
      });

      autocompleteRef.current = ac;

      const listener = ac.addListener("place_changed", () => {
        if (!placesReadyRef.current) return;
        const currentRequestId = ++requestIdRef.current;
        const place = ac.getPlace();
        if (!place) return;

        const hasComponents = Array.isArray(place.address_components) && place.address_components.length > 0;

        if (hasComponents) {
          if (currentRequestId !== requestIdRef.current) return;
          onPlaceSelectRef.current?.(place);
          return;
        }

        // Try getDetails fallback
        const placeId = place.place_id;
        if (!placeId) return;

        const svc = new google.maps.places.PlacesService(document.createElement("div"));
        svc.getDetails(
          { placeId, fields: ["formatted_address", "address_components", "geometry", "name", "place_id"] },
          (details: any, status: any) => {
            if (currentRequestId !== requestIdRef.current) return;
            if (status === google.maps.places.PlacesServiceStatus.OK && details) {
              onPlaceSelectRef.current?.(details);
            }
          },
        );
      });

      if (!listener) {
        setMode("plain");
        return;
      }

      // Sync current value
      if (valueRef.current && inputRef.current) {
        inputRef.current.value = valueRef.current;
      }

      setMode("legacy");
      placesReadyRef.current = true;
      setPlacesReady(true);
      setLoadError(null);
      debugLog("[AddressAutocomplete] Legacy Autocomplete setup complete");
    } catch (e) {
      console.error("[AddressAutocomplete] Legacy autocomplete init failed:", e);
      setMode("plain");
    }
  }, [typesKey]);

  // --- Init effect ---
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    const { apiKey, source } = getGmapsKey();
    resolvedKeyRef.current = apiKey;

    debugLog("[AddressAutocomplete] gmaps key source:", source);
    debugLog("[AddressAutocomplete] key present:", apiKey ? "[yes]" : "[no]");

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

    const fallbackToLegacy = () => {
      if (!isMounted) return;
      debugLog("[AddressAutocomplete] Falling back to legacy autocomplete");
      // Clean up new element
      if (containerRef.current) containerRef.current.innerHTML = "";
      autocompleteRef.current = null;
      initLegacyAutocomplete();
    };

    const initAutocomplete = async () => {
      if (!isMounted) return;
      const google = (window as any).google;
      if (!google?.maps?.places) {
        console.error("[AddressAutocomplete] Google Maps Places not available");
        setMode("plain");
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

      // Prefer the new PlaceAutocompleteElement
      if (places?.PlaceAutocompleteElement && containerRef.current) {
        debugLog("[AddressAutocomplete] Trying PlaceAutocompleteElement");
        try {
          containerRef.current.innerHTML = "";
          const el = new places.PlaceAutocompleteElement({});
          try { (el as any).componentRestrictions = { country: ["us"] }; } catch {}
          try { (el as any).types = parsedTypes; } catch {}
          if (placeholder) {
            try { (el as any).placeholder = placeholder; } catch { el.setAttribute("placeholder", placeholder); }
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

          // --- gmp-error listener: fall back on error ---
          const handleGmpError = (evt: any) => {
            console.error("[AddressAutocomplete] gmp-error detected:", evt);
            if (!isMounted) return;
            fallbackToLegacy();
          };
          el.addEventListener("gmp-error", handleGmpError);

          // --- Broken element detection (timeout) ---
          brokenCheckTimerRef.current = setTimeout(() => {
            if (!isMounted) return;
            if (isGoogleElementBroken(containerRef.current)) {
              debugLog("[AddressAutocomplete] Broken Google element detected after timeout");
              fallbackToLegacy();
            }
          }, 2500);

          // --- Place select handler ---
          const handleSelect = async (event: any) => {
            if (!placesReadyRef.current) return;
            const currentRequestId = ++requestIdRef.current;
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
                    },
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
                geometry: place.location
                  ? {
                      location: { lat: () => place.location.lat(), lng: () => place.location.lng() },
                      viewport: place.viewport,
                    }
                  : undefined,
                name: place.displayName?.text || "",
                place_id: place.id || "",
              };

              if (onPlaceSelectRef.current) {
                onPlaceSelectRef.current(mapped);
              } else {
                onChangeRef.current?.(mapped.formatted_address || mapped.name || "");
              }
            } catch (err) {
              console.error("[AddressAutocomplete] Error in handleSelect:", err);
            }
          };

          el.addEventListener("gmp-placeselect", handleSelect);
          el.addEventListener("gmp-select", handleSelect);

          // Store cleanup
          (el as any).__cleanup = () => {
            el.removeEventListener("gmp-placeselect", handleSelect);
            el.removeEventListener("gmp-select", handleSelect);
            el.removeEventListener("gmp-error", handleGmpError);
          };

          // Sync value
          if (value) {
            try { (el as any).value = value; } catch {}
          }

          // --- Listen for user typing inside the shadow DOM input ---
          const syncUserTyping = () => {
            try {
              const shadowInput = el.shadowRoot?.querySelector("input");
              if (shadowInput) {
                shadowInput.addEventListener("input", (e: Event) => {
                  userTypingRef.current = true;
                  const val = (e.target as HTMLInputElement).value;
                  onChangeRef.current?.(val);
                  setTimeout(() => { userTypingRef.current = false; }, 50);
                });
              }
            } catch {}
          };
          // Try immediately, and also after a short delay (shadow DOM may not be ready)
          syncUserTyping();
          setTimeout(syncUserTyping, 500);

          setMode("new-element");
          markPlacesReady();
          setLoadError(null);
          debugLog("[AddressAutocomplete] PlaceAutocompleteElement setup complete");
          return;
        } catch (e) {
          console.error("[AddressAutocomplete] PlaceAutocompleteElement setup failed:", e);
        }
      }

      // Fall through to legacy
      if (!isMounted) return;
      initLegacyAutocomplete();
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
        setMode("plain");
        onErrorRef.current?.();
      });

    return () => {
      isMounted = false;
      placesReadyRef.current = false;

      if (brokenCheckTimerRef.current) {
        clearTimeout(brokenCheckTimerRef.current);
        brokenCheckTimerRef.current = null;
      }

      if (autocompleteRef.current) {
        if ((autocompleteRef.current as any).__cleanup) {
          try { (autocompleteRef.current as any).__cleanup(); } catch {}
        }
        if ((window as any).google?.maps?.event) {
          try {
            (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
          } catch {}
        }
      }

      autocompleteRef.current = null;

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Lightweight prop updater ---
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

  // Sync controlled value to new element
  useEffect(() => {
    if (mode === "new-element" && autocompleteRef.current && value !== undefined && !userTypingRef.current) {
      try { (autocompleteRef.current as any).value = value; } catch {}
    }
  }, [mode, value]);

  return (
    <div className="w-full">
      {/* Always render the container for new element (hidden when not in use) */}
      <div
        ref={containerRef}
        className={className}
        style={{ display: mode === "new-element" ? undefined : "none" }}
      />
      {/* Plain/legacy input — always rendered when not using new element */}
      {mode !== "new-element" && (
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
        <p className="text-xs text-destructive mt-1">{loadError}</p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
