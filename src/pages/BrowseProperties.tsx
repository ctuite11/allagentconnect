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
  const [listingType, setListingType] = useState("all");
  const [status, setStatus] = useState("all");
  const [bedrooms, setBedrooms] = useState("all");
  const [bathrooms, setBathrooms] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchListings();
  }, [searchQuery, priceRange, propertyType, listingType, status, bedrooms, bathrooms, minPrice, maxPrice]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply status filter (default to active only if not filtered)
      if (status !== "all") {
        query = query.eq("status", status);
      } else {
        query = query.eq("status", "active");
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(`address.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,zip_code.ilike.%${searchQuery}%`);
      }

      // Apply price filters
      if (minPrice) {
        query = query.gte("price", parseFloat(minPrice));
      }
      if (maxPrice) {
        query = query.lte("price", parseFloat(maxPrice));
      }
      
      // Legacy price range filter (fallback)
      if (priceRange !== "all" && !minPrice && !maxPrice) {
        const [min, max] = priceRange.split("-").map(Number);
        query = query.gte("price", min);
        if (max) query = query.lte("price", max);
      }

      // Apply property type filter
      if (propertyType !== "all") {
        query = query.eq("property_type", propertyType);
      }

      // Apply listing type filter
      if (listingType !== "all") {
        query = query.eq("listing_type", listingType);
      }

      // Apply bedrooms filter
      if (bedrooms !== "all") {
        query = query.gte("bedrooms", parseInt(bedrooms));
      }

      // Apply bathrooms filter
      if (bathrooms !== "all") {
        query = query.gte("bathrooms", parseFloat(bathrooms));
      }

      const { data, error } = await query.limit(100);

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
            <h1 className="text-4xl font-bold mb-2">Search Listings</h1>
            <p className="text-muted-foreground">
              Advanced search with all available filters for agents
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
                    value={searchQuery}
                    onChange={setSearchQuery}
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
                <div className="space-y-4 pt-4 border-t">
                  {/* Row 1: Listing Type and Status */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Listing Type</label>
                      <Select value={listingType} onValueChange={setListingType}>
                        <SelectTrigger>
                          <SelectValue placeholder="All listing types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Listing Types</SelectItem>
                          <SelectItem value="for_sale">For Sale</SelectItem>
                          <SelectItem value="for_rent">For Rent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="active">New</SelectItem>
                          <SelectItem value="coming_soon">Coming Soon</SelectItem>
                          <SelectItem value="off_market">Off Market</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Price Range */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Price</label>
                      <input
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Max Price</label>
                      <input
                        type="number"
                        placeholder="No limit"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      />
                    </div>
                  </div>

                  {/* Row 3: Property Type and Beds/Baths */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Property Type</label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger>
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="Single Family">Single Family</SelectItem>
                          <SelectItem value="Condominium">Condominium</SelectItem>
                          <SelectItem value="Townhouse">Townhouse</SelectItem>
                          <SelectItem value="Multi Family">Multi Family</SelectItem>
                          <SelectItem value="Land">Land</SelectItem>
                          <SelectItem value="Commercial">Commercial</SelectItem>
                          <SelectItem value="Business Opp.">Business Opp.</SelectItem>
                          <SelectItem value="Residential Rental">Residential Rental</SelectItem>
                          <SelectItem value="Mobile Home">Mobile Home</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Bedrooms</label>
                      <Select value={bedrooms} onValueChange={setBedrooms}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                          <SelectItem value="5">5+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Bathrooms</label>
                      <Select value={bathrooms} onValueChange={setBathrooms}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="1.5">1.5+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="2.5">2.5+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                  setListingType("all");
                  setStatus("all");
                  setBedrooms("all");
                  setBathrooms("all");
                  setMinPrice("");
                  setMaxPrice("");
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