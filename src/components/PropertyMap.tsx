import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface PropertyMapProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

const PropertyMap = ({ address, latitude, longitude }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
          version: "weekly",
        });

        // @ts-ignore - Load the Google Maps API
        await loader.loadCallback((e) => {
          if (e) throw e;
        });

        if (!mapRef.current) return;

        // Use provided coordinates or geocode the address
        if (latitude && longitude) {
          const position = { lat: Number(latitude), lng: Number(longitude) };
          
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
        } else {
          // Geocode the address
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === "OK" && results?.[0] && mapRef.current) {
              const position = results[0].geometry.location;
              
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
