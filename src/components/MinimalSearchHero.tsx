import { Button } from "@/components/ui/button";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MinimalSearchHero = () => {
  const navigate = useNavigate();

  const handleBrowse = () => navigate("/browse");
  const handleAgents = () => navigate("/our-agents");

  return (
    <section className="relative bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Find your next home
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Simple search. Real agents. Transparent listings.
          </p>
        </div>

        <div className="max-w-3xl mx-auto bg-card border rounded-2xl shadow-custom-md p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <AddressAutocomplete
                placeholder="City, State, Zip or Neighborhood"
                onPlaceSelect={() => {}}
              />
            </div>
            <Button size="lg" onClick={handleBrowse} className="md:w-auto">
              <Search className="mr-2" /> Search
            </Button>
          </div>
          <div className="mt-4 flex gap-3 justify-center">
            <Button variant="secondary" onClick={handleBrowse}>Browse properties</Button>
            <Button variant="outline" onClick={handleAgents}>Find an agent</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MinimalSearchHero;
