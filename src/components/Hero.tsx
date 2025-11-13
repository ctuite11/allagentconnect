import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import AddressAutocomplete from "./AddressAutocomplete";

const Hero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    navigate(`/browse?${params.toString()}`);
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    const addressComponents = place.address_components || [];
    const getComponent = (type: string) => {
      const component = addressComponents.find((c) => c.types.includes(type));
      return component?.long_name || "";
    };

    const city = getComponent("locality") || getComponent("sublocality");
    const state = getComponent("administrative_area_level_1");
    const zip = getComponent("postal_code");
    
    const parts = [city, state, zip].filter(Boolean);
    const query = parts.join(", ");
    
    if (query) {
      setSearchQuery(query);
    }
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center pt-20">
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="Luxury real estate neighborhood" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
      </div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Hello. Bonjour. Hola. 你好. Ciao
          </p>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-primary">Revolutionizing</span> Real Estate<br />
            Through Complete Transparency
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Forward-thinking and consumer-focused, All Agent Connect has redefined the home buying and home selling process, saving consumers billions along the way.
          </p>
          
          <div className="bg-card rounded-xl shadow-custom-lg p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Let's help you find your dream home.</h2>
            <div className="space-y-3">
              <AddressAutocomplete 
                placeholder="City, State, Zip or Neighborhood"
                className="w-full"
                onPlaceSelect={handlePlaceSelect}
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button size="lg" className="gap-2 w-full" onClick={handleSearch}>
                <Search className="w-5 h-5" />
                Search Properties
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
