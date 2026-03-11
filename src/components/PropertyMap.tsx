/// <reference types="@types/google.maps" />
import { useEffect, useRef } from "react";

interface PropertyMapProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

const g = () => (window as unknown as { google: typeof google }).google;

const PropertyMap = ({ address, latitude, longitude }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          console.error("Google Maps API key not configured");
          return;
        }

        if (!g()?.maps) {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const gmaps = g().maps;

        if (latitude && longitude) {
          const position = { lat: Number(latitude), lng: Number(longitude) };
          const map = new gmaps.Map(mapRef.current, {
            center: position,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: true,
          });
          new gmaps.Marker({ position, map, title: address });
        } else {
          const geocoder = new gmaps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === "OK" && results?.[0] && mapRef.current) {
              const position = results[0].geometry.location;
              const map = new gmaps.Map(mapRef.current, {
                center: position,
                zoom: 15,
                mapTypeControl: false,
                streetViewControl: true,
              });
              new gmaps.Marker({ position, map, title: address });
            }
          });
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    };

    initMap();
  }, [address, latitude, longitude]);

  return <div ref={mapRef} className="w-full h-[400px] rounded-lg" />;
};

export default PropertyMap;
