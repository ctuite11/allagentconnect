import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GeographicSelector, GeographicSelection } from "@/components/GeographicSelector";

const MinimalSearchHero = () => {
  const navigate = useNavigate();
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
    navigate(`/browse?${params.toString()}`);
  };

  const handleAgents = () => navigate("/our-agents");

  return (
    <section className="relative bg-background to-muted/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Find your next home
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Simple search. Real agents. Transparent listings.
          </p>
        </div>

        <div className="max-w-3xl mx-auto bg-card border rounded-2xl shadow-md p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <GeographicSelector
              value={geoSelection}
              onChange={setGeoSelection}
              defaultCollapsed={false}
              label=""
              showWrapper={false}
              compact
            />
            <Button size="lg" onClick={handleSearch} className="w-full md:w-auto md:self-end">
              <Search className="mr-2" /> Search
            </Button>
          </div>
          <div className="mt-4 flex gap-3 justify-center">
            <Button variant="secondary" onClick={handleSearch}>Browse properties</Button>
            <Button variant="outline" onClick={handleAgents}>Find an agent</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MinimalSearchHero;
