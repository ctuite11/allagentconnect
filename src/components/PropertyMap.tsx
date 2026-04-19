import { useEffect, useRef } from "react";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
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
}

const PropertyMap = ({
  address,
  latitude,
  longitude,
  listings,
  onListingClick
}: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  const resolveGoogleMapsKey = () => {
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (envKey && envKey.trim()) return envKey.trim();

    // Allow temporary key override in preview/debug links.
    const urlKey = new URLSearchParams(window.location.search).get("gmaps_key");
    if (urlKey && urlKey.trim()) return urlKey.trim();

    return "";
  };

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

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
        // Load Google Maps script dynamically if not already loaded
        if (!(window as any).google?.maps) {
          const existing = document.getElementById("google-maps-js") as HTMLScriptElement | null;
          const script = existing || document.createElement("script");
          if (!existing) {
            script.id = "google-maps-js";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
            script.async = true;
            script.defer = true;
          }

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = reject;
            if (!existing) {
              document.head.appendChild(script);
            }
          });
        }

        const google = (window as any).google;

        if (listings && listings.length > 0) {
          // Search results map with multiple listings
          const map = new google.maps.Map(mapRef.current, {
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: true,
          });

          const bounds = new google.maps.LatLngBounds();
          const markers: any[] = [];

          for (const listing of listings) {
            if (listing.latitude && listing.longitude) {
              const position = { lat: Number(listing.latitude), lng: Number(listing.longitude) };
              const marker = new google.maps.Marker({
                position,
                map,
                title: `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code}`,
              });

              if (onListingClick) {
                marker.addListener('click', () => onListingClick(listing.id));
              }

              markers.push(marker);
              bounds.extend(position);
            }
          }

          if (markers.length > 0) {
            map.fitBounds(bounds);
            // Don't zoom in too much if only one marker
            google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
              if (map.getZoom() > 15) {
                map.setZoom(15);
              }
            });
          }
        } else if (address || (latitude && longitude)) {
          // Single property map
          let position: { lat: number; lng: number };

          if (latitude && longitude) {
            position = { lat: Number(latitude), lng: Number(longitude) };
          } else {
            // Geocode the address
            const geocoder = new google.maps.Geocoder();
            const result = await new Promise<any>((resolve, reject) => {
              geocoder.geocode({ address: address! }, (results, status) => {
                if (status === "OK" && results?.[0]) {
                  resolve(results[0]);
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

          const map = new google.maps.Map(mapRef.current, {
            center: position,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: true,
          });

          new google.maps.Marker({
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
  }, [address, latitude, longitude, listings, onListingClick]);

  return <div ref={mapRef} className="w-full h-[400px] rounded-lg" />;
};

export default PropertyMap;
