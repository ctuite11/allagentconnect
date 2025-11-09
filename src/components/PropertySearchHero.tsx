import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin } from "lucide-react";

const PropertySearchHero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery);
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
    
    // Build search query from selected location
    const parts = [city, state, zip].filter(Boolean);
    const query = parts.join(", ");
    
    if (query) {
      setSearchQuery(query);
    }
  };

  return (
    <section className="relative bg-gradient-hero pt-32 pb-20 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl animate-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Content */}
          <div className="text-center mb-16 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 text-sm font-medium text-primary mb-6 animate-fade-in">
              <MapPin className="h-4 w-4" />
              <span>Connecting You to Your Perfect Property</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 leading-[1.1] tracking-tight animate-fade-in-up">
              Revolutionizing<br />
              Real Estate Through
              <span className="block mt-2 bg-gradient-primary bg-clip-text text-transparent">
                Complete Transparency
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Forward-thinking and consumer-focused, Agent Connect has redefined the home buying process, 
              connecting buyers directly with qualified agents in their target areas.
            </p>
          </div>

          {/* Modern Search Card */}
          <div className="max-w-4xl mx-auto animate-scale-in" style={{ animationDelay: '0.4s' }}>
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
              
              {/* Main card */}
              <div className="relative bg-gradient-card backdrop-blur-xl rounded-3xl shadow-custom-xl border border-white/20 p-8 md:p-10">
                <h2 className="text-2xl md:text-3xl font-display font-semibold mb-8 text-center bg-gradient-primary bg-clip-text text-transparent">
                  Let's find your dream home
                </h2>
                
                <form onSubmit={handleSearch} className="space-y-5">
                  {/* Search input */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300" />
                    <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 z-10 group-hover:text-primary transition-colors" />
                    <AddressAutocomplete
                      onPlaceSelect={handlePlaceSelect}
                      placeholder="City, State, Zip or Neighborhood"
                      className="pl-14 h-16 text-lg w-full rounded-2xl border-2 border-border hover:border-primary/50 focus:border-primary transition-colors bg-white/50 backdrop-blur-sm"
                      value={searchQuery}
                      onChange={setSearchQuery}
                    />
                  </div>
                  
                  {/* Price range */}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Min Price"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-16 text-lg rounded-2xl border-2 border-border hover:border-primary/50 focus:border-primary transition-colors bg-white/50 backdrop-blur-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Max Price"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-16 text-lg rounded-2xl border-2 border-border hover:border-primary/50 focus:border-primary transition-colors bg-white/50 backdrop-blur-sm"
                    />
                  </div>
                  
                  {/* CTA Button */}
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="h-16 px-10 text-lg w-full rounded-2xl bg-gradient-primary hover:shadow-custom-glow transition-all duration-300 font-semibold group"
                  >
                    <span>Search Properties</span>
                    <Search className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </form>
                
                <p className="text-sm text-muted-foreground text-center mt-6">
                  Browse <span className="font-semibold text-foreground">thousands of properties</span> and connect with local agents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PropertySearchHero;
