import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

const Hero = () => {
  const navigate = useNavigate();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [geoSelection, setGeoSelection] = useState<GeographicSelection>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
  });

  const handleSearch = () => {
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
    <section id="home" className="relative min-h-screen flex items-center pt-20">
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="Luxury real estate neighborhood" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/80" />
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
          
          <div className="bg-card rounded-xl shadow-md p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Let's help you find your dream home.</h2>
            <div className="space-y-3">
              <GeographicSelector
                value={geoSelection}
                onChange={setGeoSelection}
                defaultCollapsed={false}
                label=""
                showWrapper={false}
                compact
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
