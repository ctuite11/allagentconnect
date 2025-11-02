import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

const BrowseProperties = () => {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priceRange, setPriceRange] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [searchQuery, priceRange, propertyType]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      // Apply search filter
      if (searchQuery) {
        query = query.or(`address.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,zip_code.ilike.%${searchQuery}%`);
      }

      // Apply price filter
      if (priceRange !== "all") {
        const [min, max] = priceRange.split("-").map(Number);
        query = query.gte("price", min);
        if (max) query = query.lte("price", max);
      }

      // Apply property type filter
      if (propertyType !== "all") {
        query = query.eq("property_type", propertyType);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setListings(data || []);
    } catch (error: any) {
      toast.error("Failed to load properties");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
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
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Browse Properties</h1>
            <p className="text-muted-foreground">
              Discover your perfect home from our extensive listings
            </p>
          </div>

          {/* Search and Filters */}
          <div className="bg-card rounded-lg shadow-sm border p-6 mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 z-10" />
                  <AddressAutocomplete
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Search by city, zip code, or address..."
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Search</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>

              {showFilters && (
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price Range</label>
                    <Select value={priceRange} onValueChange={setPriceRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select price range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Prices</SelectItem>
                        <SelectItem value="0-200000">Under $200,000</SelectItem>
                        <SelectItem value="200000-400000">$200,000 - $400,000</SelectItem>
                        <SelectItem value="400000-600000">$400,000 - $600,000</SelectItem>
                        <SelectItem value="600000-800000">$600,000 - $800,000</SelectItem>
                        <SelectItem value="800000-1000000">$800,000 - $1,000,000</SelectItem>
                        <SelectItem value="1000000-9999999999">Over $1,000,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Property Type</label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="condo">Condo</SelectItem>
                        <SelectItem value="townhouse">Townhouse</SelectItem>
                        <SelectItem value="multi_family">Multi Family</SelectItem>
                        <SelectItem value="land">Land</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading properties...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground mb-4">No properties found matching your criteria</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setPriceRange("all");
                  setPropertyType("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Found {listings.length} {listings.length === 1 ? "property" : "properties"}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <PropertyCard key={listing.id} {...listing} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BrowseProperties;