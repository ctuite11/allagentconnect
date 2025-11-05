import { useEffect, useRef } from "react";

interface PropertyMapProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

const PropertyMap = ({ address, latitude, longitude }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        // Load Google Maps script dynamically
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          console.error("Google Maps API key not configured");
          return;
        }

        // Check if script is already loaded
        if (!window.google?.maps) {
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
