import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const useQuery = () => new URLSearchParams(useLocation().search);

const SearchResults = () => {
  const navigate = useNavigate();
  const search = useLocation().search;
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const filters = useMemo(() => {
    const params = new URLSearchParams(search);
    const get = (k: string) => params.get(k) || undefined;
    const getList = (k: string, sep = ",") => (params.get(k)?.split(sep).filter(Boolean) || undefined);

    return {
      statuses: getList("status"),
      types: getList("type"),
      minPrice: get("minPrice"),
      maxPrice: get("maxPrice"),
      bedrooms: get("bedrooms"),
      bathrooms: get("bathrooms"),
      rooms: get("rooms"),
      acres: get("acres"),
      livingArea: get("livingArea"),
      pricePerSqFt: get("pricePerSqFt"),
      yearBuilt: get("yearBuilt"),
      zip: get("zip"),
      listingNumber: get("listingNumber"),
      towns: getList("towns", "|"),
      state: get("state"),
      county: get("county"),
      keywords: get("keywords"),
      keywordMatch: get("keywordMatch"),
      keywordType: get("keywordType"),
    };
  }, [search]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        let q = supabase.from("listings").select("*").order("created_at", { ascending: false });

        // Default to only showing active and coming_soon if no status filter specified
        if (filters.statuses && filters.statuses.length) {
          q = q.in("status", filters.statuses);
        } else {
          q = q.in("status", ["active", "coming_soon"]);
        }
        if (filters.types && filters.types.length) q = q.in("property_type", filters.types);
        if (filters.minPrice) q = q.gte("price", parseFloat(filters.minPrice));
        if (filters.maxPrice) q = q.lte("price", parseFloat(filters.maxPrice));
        if (filters.bedrooms) q = q.gte("bedrooms", parseInt(filters.bedrooms));
        if (filters.bathrooms) q = q.gte("bathrooms", parseFloat(filters.bathrooms));
        if (filters.zip) q = q.ilike("zip_code", `%${filters.zip}%`);
        if (filters.listingNumber) q = q.ilike("listing_number", `%${filters.listingNumber}%`);
        // Note: towns/state/county/keywords are placeholders until backend columns exist

        const { data, error } = await q.limit(100);
        if (error) throw error;
        setListings(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    document.title = `Search Results${filters.statuses?.length ? ` • ${filters.statuses.join("/")}` : ""}`;
  }, [filters]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 bg-muted/30 pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-4xl font-bold">Search Results</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>Back to Filters</Button>
              <Button onClick={() => navigate("/browse")}>Modify Search</Button>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm border p-6 mb-6 flex items-center justify-between">
            <div className="text-lg font-semibold">{loading ? "Loading…" : `${listings.length} Properties Found`}</div>
          </div>

          {loading ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground">Loading properties...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground mb-4">No properties found matching your criteria</p>
              <Button variant="outline" onClick={() => navigate("/browse")}>Adjust Filters</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <div 
                  key={listing.id} 
                  onClick={() => navigate(`/property/${listing.id}`)}
                  className="cursor-pointer"
                >
                  <PropertyCard
                    image={listing.photos?.[0]?.url || "/placeholder.svg"}
                    title={listing.property_type}
                    price={`$${listing.price?.toLocaleString()}`}
                    savings="N/A"
                    address={listing.address}
                    beds={listing.bedrooms}
                    baths={listing.bathrooms}
                    sqft={listing.square_feet?.toLocaleString() || "N/A"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchResults;
