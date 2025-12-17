import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin } from "lucide-react";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

const PropertySearchHero = () => {
  const navigate = useNavigate();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [geoSelection, setGeoSelection] = useState<GeographicSelection>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (geoSelection.state) params.set("state", geoSelection.state);
    if (geoSelection.county && geoSelection.county !== "all") params.set("county", geoSelection.county);
    if (geoSelection.towns?.length) params.set("towns", geoSelection.towns.join("|"));
    if (geoSelection.showAreas) params.set("showAreas", "yes");
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <section className="relative bg-background pt-32 pb-20 overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Content */}
          <div className="text-center mb-16 space-y-6">
              {/* Badge with neutral styling */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary backdrop-blur-sm border border-border text-sm font-medium text-foreground mb-6 animate-fade-in">
              <MapPin className="h-4 w-4" />
              <span>Connecting You to Your Perfect Property</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 leading-[1.1] tracking-tight animate-fade-in-up">
              Revolutionizing<br />
              Real Estate Through
              <span className="block mt-2 text-primary">
                Complete Transparency
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Forward-thinking and consumer-focused, All Agent Connect has redefined the home buying process, 
              connecting buyers directly with qualified agents in their target areas.
            </p>
          </div>

          {/* Modern Search Card */}
          <div className="max-w-4xl mx-auto animate-scale-in" style={{ animationDelay: '0.4s' }}>
            <div className="relative">
              {/* Main card */}
              <div className="relative bg-card backdrop-blur-xl rounded-3xl shadow-lg border p-8 md:p-10">
                <h2 className="text-2xl md:text-3xl font-display font-semibold mb-8 text-center text-primary">
                  Let's find your dream home
                </h2>
                
                <form onSubmit={handleSearch} className="space-y-5">
                  {/* Geographic Selector */}
                  <GeographicSelector
                    value={geoSelection}
                    onChange={setGeoSelection}
                    defaultCollapsed={false}
                    label=""
                    showWrapper={false}
                    compact
                  />
                  
                  {/* Price range */}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Min Price"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-16 text-lg rounded-2xl border-2 border-border hover:border-neutral-400 focus:border-neutral-400 transition-colors bg-card"
                    />
                    <Input
                      type="number"
                      placeholder="Max Price"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-16 text-lg rounded-2xl border-2 border-border hover:border-neutral-400 focus:border-neutral-400 transition-colors bg-card"
                    />
                  </div>
                  
                  {/* CTA Button */}
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="h-16 px-10 text-lg w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 font-semibold group"
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
