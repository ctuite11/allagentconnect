import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin } from "lucide-react";

const PropertySearchHero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/10 pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm text-muted-foreground mb-4 flex items-center justify-center gap-2">
              <MapPin className="h-4 w-4" />
              Connecting You to Your Perfect Property
            </p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Revolutionizing Real Estate<br />
              <span className="text-primary">Through Complete Transparency</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Forward-thinking and consumer-focused, Agent Connect has redefined the home buying process, 
              connecting buyers directly with qualified agents in their target areas.
            </p>
          </div>

          {/* Search Bar */}
          <div className="bg-card rounded-xl shadow-lg border p-6 max-w-3xl mx-auto">
            <p className="text-lg font-semibold mb-4 text-center">
              Let's help you find your dream home.
            </p>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  type="text"
                  placeholder="City, State, Zip or Neighborhood"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg"
                />
              </div>
              <Button type="submit" size="lg" className="h-14 px-8 text-lg">
                Search
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Browse thousands of properties and connect with local agents
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PropertySearchHero;
