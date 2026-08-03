import { useEffect, useMemo, useRef } from "react";
import { formatListingMapPinTruncated, type ListingPriceFields } from "@/lib/formatListingPriceDisplay";
import { getGoogleMapsBrowserKey } from "@/lib/googleMapsConfig";

type GoogleMapsApi = typeof google.maps;
type SearchMarker = (google.maps.Marker | google.maps.marker.AdvancedMarkerElement) & {
  __priceLabel?: string;
  __listingId?: string;
  __contentElement?: HTMLElement;
  setIcon?: (icon: google.maps.Icon) => void;
  setZIndex?: (zIndex: number) => void;
  setMap?: (map: google.maps.Map | null) => void;
  zIndex?: number;
  map?: google.maps.Map | null;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};
type GoogleMapsWindow = Window & typeof globalThis & { google?: typeof google };

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface PropertyMapProps {
  // For single property map
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  // For search results map
  listings?: Listing[];
  onListingClick?: (listingId: string) => void;
  onListingHover?: (listingId: string | null) => void;
  onListingSelect?: (listingId: string) => void;
  highlightedListingId?: string | null;
  selectedListingId?: string | null;
  /** When `listings` is non-empty but none have valid coordinates, center the map here (no listing data is modified). */
  fallbackCenter?: google.maps.LatLngLiteral;
  fallbackZoom?: number;
}

const PropertyMap = ({
  address,
  latitude,
  longitude,
  listings,
  onListingClick,
  onListingHover,
  onListingSelect,
  highlightedListingId,
  selectedListingId,
  fallbackCenter,
  fallbackZoom,
}: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, SearchMarker>>(new Map());
  const lastListingsKeyRef = useRef("");
  const onListingHoverRef = useRef(onListingHover);
  const onListingSelectRef = useRef(onListingSelect);
  const onListingClickRef = useRef(onListingClick);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const waitForMapContainerReady = async (element: HTMLDivElement): Promise<void> => {
    if (element.clientWidth > 0 && element.clientHeight > 0) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve();
      }, 1200);

      const observer = new ResizeObserver(() => {
        if (settled) return;
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          settled = true;
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(element);
    });
  };

  const ensureGoogleMapsLoaded = async (apiKey: string): Promise<GoogleMapsApi> => {
    const browserWindow = window as GoogleMapsWindow;
    if (browserWindow.google?.maps) {
      return browserWindow.google.maps;
    }

    const existing = document.getElementById("google-maps-js") as HTMLScriptElement | null;
    const script = existing || document.createElement("script");

    if (!existing) {
      script.id = "google-maps-js";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,marker`;
      script.async = true;
      script.defer = true;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finishIfReady = () => {
        if (settled) return true;
        if ((window as GoogleMapsWindow).google?.maps) {
          settled = true;
          resolve();
          return true;
        }
        return false;
      };

      if (finishIfReady()) return;

      const handleLoad = () => {
        if (!finishIfReady() && !settled) {
          settled = true;
          reject(new Error("Google Maps API loaded but maps object is unavailable"));
        }
      };

      const handleError = () => {
        if (settled) return;
        settled = true;
        reject(new Error("Failed to load Google Maps script"));
      };

      const timeout = window.setTimeout(() => {
        if (settled) return;
        if (finishIfReady()) return;
        settled = true;
        reject(new Error("Timed out waiting for Google Maps API"));
      }, 10000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };

      const onLoad = () => {
        cleanup();
        handleLoad();
      };

      const onError = () => {
        cleanup();
        handleError();
      };

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });

      if (!existing) {
        document.head.appendChild(script);
      }
    });

    const maps = (window as GoogleMapsWindow).google?.maps;
    if (!maps) {
      throw new Error("Google Maps API unavailable after script load");
    }
    return maps;
  };

  useEffect(() => {
    onListingHoverRef.current = onListingHover;
    onListingSelectRef.current = onListingSelect;
    onListingClickRef.current = onListingClick;
  }, [onListingHover, onListingSelect, onListingClick]);

  /** Must change when coordinates appear/update so we refit bounds (ids alone miss 0→N marker transitions with same set). */
  const listingsKey = useMemo(() => {
    if (!listings?.length) return "";
    return listings
      .map((listing) => {
        const id = String(listing.id);
        const rawLat = listing.latitude;
        const rawLng = listing.longitude;
        if (rawLat == null || rawLng == null) return `${id}:`;
        const la = Number(rawLat);
        const ln = Number(rawLng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return `${id}:`;
        return `${id}:${la.toFixed(5)},${ln.toFixed(5)}`;
      })
      .join("|");
  }, [listings]);

  const resolveGoogleMapsKey = () => {
    const envKey = getGoogleMapsBrowserKey();
    if (envKey) return envKey;

    // Allow temporary key override in preview/debug links.
    const urlKey = new URLSearchParams(window.location.search).get("gmaps_key");
    if (urlKey && urlKey.trim()) return urlKey.trim();

    return "";
  };

  const resolveGoogleMapId = () => {
    const preferred = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim();
    if (preferred) return preferred;
    const legacy = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined)?.trim();
    if (legacy) return legacy;
    return "";
  };

  const applyPriceBadgeStyles = (
    element: HTMLElement,
    highlighted: boolean,
    selected: boolean
  ) => {
    element.style.display = "inline-flex";
    element.style.alignItems = "center";
    element.style.justifyContent = "center";
    element.style.borderRadius = "999px";
    element.style.padding = selected ? "8px 13px" : highlighted ? "7px 12px" : "6px 11px";
    element.style.fontSize = selected ? "13.5px" : highlighted ? "13px" : "12px";
    element.style.fontWeight = "600";
    element.style.lineHeight = "1";
    element.style.letterSpacing = "-0.01em";
    element.style.whiteSpace = "nowrap";
    element.style.userSelect = "none";
    element.style.cursor = "pointer";
    element.style.border = selected ? "2px solid #34C58A" : "1px solid rgba(255,255,255,0.18)";
    // Keep all “blue” fills on the exact AAC brand blue; use size/scale to show emphasis.
    element.style.background = "#0E56F5";
    element.style.color = "#FFFFFF";
    element.style.boxShadow = selected
      ? "0 14px 30px rgba(14, 86, 245, 0.38)"
      : highlighted
        ? "0 12px 24px rgba(14, 86, 245, 0.34)"
        : "0 8px 18px rgba(14, 86, 245, 0.24)";
    element.style.transform = selected ? "translateY(-1px) scale(1.06)" : highlighted ? "translateY(-1px) scale(1.04)" : "translateY(0) scale(1)";
    element.style.transition = "all 140ms ease";
  };

  const buildPriceMarkerIcon = (googleMaps: GoogleMapsApi, label: string, highlighted: boolean, selected: boolean): google.maps.Icon => {
    const fill = "#0E56F5";
    const text = "#FFFFFF";
    const stroke = selected ? "#34C58A" : "rgba(255,255,255,0.22)";
    const strokeWidth = selected ? 2 : 1;
    const fontSize = selected ? 13.5 : highlighted ? 13 : 12;
    const padX = selected ? 12 : highlighted ? 11 : 10;
    const height = selected ? 34 : highlighted ? 32 : 30;
    const estCharWidth = fontSize * 0.62;
    const width = Math.max(56, Math.round(label.length * estCharWidth + padX * 2));
    const radius = 14;
    const shadow = selected
      ? "0 14px 30px rgba(14, 86, 245, 0.38)"
      : highlighted
        ? "0 12px 24px rgba(14, 86, 245, 0.34)"
        : "0 8px 18px rgba(14, 86, 245, 0.24)";
    const shadowColor = "#0E56F5";
    const shadowOpacity = selected ? "0.36" : highlighted ? "0.34" : "0.24";

    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
        <defs>
          <filter id='s' x='-50%' y='-50%' width='200%' height='200%'>
            <feDropShadow dx='0' dy='3' stdDeviation='2.8' flood-color='${shadowColor}' flood-opacity='${shadowOpacity}'/>
          </filter>
        </defs>
        <rect x='1' y='1' width='${width - 2}' height='${height - 2}' rx='${radius}' fill='${fill}' stroke='${stroke}' stroke-width='${strokeWidth}' filter='url(#s)' />
        <text x='${width / 2}' y='${height / 2 + 4}' text-anchor='middle' fill='${text}'
          font-family='ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' font-size='${fontSize}' font-weight='600'>${label}</text>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new googleMaps.Size(width, height),
      anchor: new googleMaps.Point(width / 2, height / 2),
    };
  };

  const applyMarkerStyles = (googleMaps: GoogleMapsApi) => {
    markersRef.current.forEach((marker, listingId) => {
      const highlighted = listingId === highlightedListingId;
      const selected = listingId === selectedListingId;
      const label = marker.__priceLabel as string;
      if (marker.__contentElement) {
        applyPriceBadgeStyles(marker.__contentElement as HTMLElement, highlighted, selected);
      } else if (typeof marker.setIcon === "function") {
        marker.setIcon(buildPriceMarkerIcon(googleMaps, label, highlighted, selected));
      }

      if (typeof marker.setZIndex === "function") {
        marker.setZIndex(selected ? 1000 : highlighted ? 900 : 10);
      } else {
        marker.zIndex = selected ? 1000 : highlighted ? 900 : 10;
      }
    });
  };

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;
      await waitForMapContainerReady(mapRef.current);

      const apiKey = resolveGoogleMapsKey();
      if (!apiKey) {
        console.error("Google Maps API key not configured");
        mapRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full text-muted-foreground">
            <div class="text-center">
              <p class="font-medium mb-2">Map Unavailable</p>
              <p class="text-sm">Google Maps API key not configured</p>
            </div>
          </div>
        `;
        return;
      }

      try {
        const googleMaps = await ensureGoogleMapsLoaded(apiKey);

        if (!mapInstanceRef.current) {
          const mapId = resolveGoogleMapId();
          mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
            zoom: 10,
            mapTypeId: "roadmap",
            mapTypeControl: false,
            streetViewControl: true,
            ...(mapId ? { mapId } : {}),
          });

          googleMaps.event.trigger(mapInstanceRef.current, "resize");

          if (mapRef.current) {
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = new ResizeObserver(() => {
              const map = mapInstanceRef.current;
              if (!map) return;
              googleMaps.event.trigger(map, "resize");
            });
            resizeObserverRef.current.observe(mapRef.current);
          }
        }

        const map = mapInstanceRef.current;

        if (listings && listings.length > 0) {
          markersRef.current.forEach((marker) => {
            if (typeof marker.setMap === "function") {
              marker.setMap(null);
            } else {
              marker.map = null;
            }
          });
          markersRef.current.clear();

          const bounds = new googleMaps.LatLngBounds();
          let markerCount = 0;

          for (const listing of listings) {
            const rawLat = listing.latitude;
            const rawLng = listing.longitude;
            if (rawLat == null || rawLng == null) continue;
            const latN = Number(rawLat);
            const lngN = Number(rawLng);
            if (!Number.isFinite(latN) || !Number.isFinite(lngN)) continue;

            const position = { lat: latN, lng: lngN };
            const priceLabel =
              formatListingMapPinTruncated(listing as ListingPriceFields) ?? "—";
            const highlighted = listing.id === highlightedListingId;
            const selected = listing.id === selectedListingId;

            const markerTitle = `${priceLabel} • ${listing.address}, ${listing.city}`;
            const AdvancedMarker = googleMaps.marker?.AdvancedMarkerElement;
            const canUseAdvancedMarkers = Boolean(resolveGoogleMapId() && AdvancedMarker);
            let marker: SearchMarker;

            if (canUseAdvancedMarkers) {
              const content = document.createElement("div");
              content.textContent = priceLabel;
              applyPriceBadgeStyles(content, highlighted, selected);

              marker = new AdvancedMarker({
                position,
                map,
                title: markerTitle,
                content,
                gmpClickable: true,
                zIndex: selected ? 1000 : highlighted ? 900 : 10,
              }) as SearchMarker;

              content.addEventListener("mouseenter", () => {
                onListingHoverRef.current?.(listing.id);
              });

              content.addEventListener("mouseleave", () => {
                onListingHoverRef.current?.(null);
              });

              content.addEventListener("click", () => {
                onListingSelectRef.current?.(listing.id);
                onListingClickRef.current?.(listing.id);
              });

              if (typeof marker.addEventListener === "function") {
                marker.addEventListener("gmp-click", () => {
                  onListingSelectRef.current?.(listing.id);
                  onListingClickRef.current?.(listing.id);
                });
              }

              marker.__contentElement = content;
            } else {
              marker = new googleMaps.Marker({
                position,
                map,
                title: markerTitle,
                icon: buildPriceMarkerIcon(googleMaps, priceLabel, highlighted, selected),
                zIndex: selected ? 1000 : highlighted ? 900 : 10,
              }) as SearchMarker;

              marker.addListener("mouseover", () => {
                onListingHoverRef.current?.(listing.id);
              });

              marker.addListener("mouseout", () => {
                onListingHoverRef.current?.(null);
              });
            }

            marker.__priceLabel = priceLabel;
            marker.__listingId = listing.id;

            if (typeof marker.addListener === "function") {
              marker.addListener("click", () => {
                onListingSelectRef.current?.(listing.id);
                onListingClickRef.current?.(listing.id);
              });
            }

            markersRef.current.set(listing.id, marker);
            bounds.extend(position);
            markerCount += 1;
          }

          if (markerCount > 0 && lastListingsKeyRef.current !== listingsKey) {
            map.fitBounds(bounds);
            googleMaps.event.addListenerOnce(map, "bounds_changed", () => {
              if (map.getZoom() > 15) {
                map.setZoom(15);
              }
            });
            lastListingsKeyRef.current = listingsKey;
          } else if (
            markerCount === 0 &&
            fallbackCenter &&
            lastListingsKeyRef.current !== listingsKey
          ) {
            map.setCenter(fallbackCenter);
            map.setZoom(fallbackZoom ?? 10);
            lastListingsKeyRef.current = listingsKey;
          } else if (
            markerCount === 0 &&
            !fallbackCenter &&
            lastListingsKeyRef.current !== listingsKey
          ) {
            // Safety net: when no listings have coordinates and no fallback was provided,
            // paint tiles centered on the continental US so the panel never renders blank.
            map.setCenter({ lat: 39.5, lng: -98.35 });
            map.setZoom(4);
            lastListingsKeyRef.current = listingsKey;
          }

          applyMarkerStyles(googleMaps);
        } else if (address || (latitude && longitude)) {
          // Single property map
          let position: { lat: number; lng: number };

          if (latitude && longitude) {
            position = { lat: Number(latitude), lng: Number(longitude) };
          } else {
            // Geocode the address
            const geocoder = new googleMaps.Geocoder();
            const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => {
              geocoder.geocode({ address: address! }, (results, status) => {
                const firstResult = results?.[0];
                if (status === "OK" && firstResult) {
                  resolve(firstResult);
                } else {
                  reject(new Error("Geocoding failed"));
                }
              });
            });
            position = {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng()
            };
          }

          map.setCenter(position);
          map.setZoom(15);

          new googleMaps.Marker({
            position,
            map,
            title: address,
          });
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full text-muted-foreground">
              <div class="text-center">
                <p class="font-medium mb-2">Map Unavailable</p>
                <p class="text-sm">Failed to load map</p>
              </div>
            </div>
          `;
        }
      }
    };

    initMap();
  }, [
    address,
    latitude,
    longitude,
    listings,
    listingsKey,
    fallbackCenter,
    fallbackZoom,
  ]);

  useEffect(() => {
    const googleMaps = (window as GoogleMapsWindow).google?.maps;
    if (!googleMaps || markersRef.current.size === 0) return;
    applyMarkerStyles(googleMaps);
  }, [highlightedListingId, selectedListingId]);

  useEffect(() => {
    const markers = markersRef.current;

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      markers.forEach((marker) => {
        if (typeof marker.setMap === "function") {
          marker.setMap(null);
        } else {
          marker.map = null;
        }
      });
      markers.clear();
      mapInstanceRef.current = null;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-lg" />;
};

export default PropertyMap;
