import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const useQuery = () => new URLSearchParams(useLocation().search);

const SearchResults = () => {
  const navigate = useNavigate();
  const search = useLocation().search;
  const [listings, setListings] = useState<any[]>([]);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());

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
        let q = supabase
          .from("listings")
          .select("*")
          .order("created_at", { ascending: false });

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
        
        // Handle city/neighborhood filtering
        if (filters.towns && filters.towns.length > 0) {
          const cityFilters = filters.towns.map((townStr: string) => {
            // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
            if (townStr.includes('-')) {
              const [city, neighborhood] = townStr.split('-').map((s: string) => s.trim());
              return { city, neighborhood };
            }
            return { city: townStr, neighborhood: null };
          });
          
          // Group by cities that have neighborhoods vs just cities
          const citiesWithNeighborhoods = cityFilters.filter((f: {city: string, neighborhood: string | null}) => f.neighborhood);
          const citiesOnly = cityFilters.filter((f: {city: string, neighborhood: string | null}) => !f.neighborhood).map((f: {city: string, neighborhood: string | null}) => f.city);
          
          // Build complex filter
          if (citiesWithNeighborhoods.length > 0 && citiesOnly.length > 0) {
            q = q.or(
              `city.in.(${citiesOnly.join(',')}),` +
              citiesWithNeighborhoods.map((f: {city: string, neighborhood: string | null}) => `and(city.eq.${f.city},neighborhood.eq.${f.neighborhood})`).join(',')
            );
          } else if (citiesWithNeighborhoods.length > 0) {
            q = q.or(
              citiesWithNeighborhoods.map((f: {city: string, neighborhood: string | null}) => `and(city.eq.${f.city},neighborhood.eq.${f.neighborhood})`).join(',')
            );
          } else if (citiesOnly.length > 0) {
            q = q.in("city", citiesOnly);
          }
        }

        const { data, error } = await q.limit(100);
        if (error) throw error;

        // Fetch agent profiles in batch and attach to listings
        let finalListings = data || [];
        const agentIds = Array.from(new Set((finalListings as any[]).map(l => l.agent_id).filter(Boolean)));
        if (agentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("agent_profiles")
            .select("id, first_name, last_name, company, headshot_url, phone, email")
            .in("id", agentIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p]));
          finalListings = (finalListings as any[]).map(l => ({
            ...l,
            agent_profile: profileMap.get(l.agent_id)
          }));
        }

        setListings(finalListings);
        setAllListings(finalListings);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    document.title = `Search Results${filters.statuses?.length ? ` • ${filters.statuses.join("/")}` : ""}`;
  }, [filters]);

  const handleSelectAll = () => {
    if (selectedListings.size === listings.length) {
      setSelectedListings(new Set());
      // Restore all listings when deselecting all
      setListings(allListings);
    } else {
      setSelectedListings(new Set(listings.map(l => l.id)));
    }
  };

  const handleKeepSelected = () => {
    if (selectedListings.size === 0) {
      toast.error("No properties selected");
      return;
    }
    const filtered = listings.filter(l => selectedListings.has(l.id));
    setListings(filtered);
    toast.success(`Showing ${filtered.length} selected properties`);
  };

  const handleSaveSearch = () => {
    toast.info("Save search feature coming soon!");
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Search link copied to clipboard!");
  };

  const handleSaveToWishList = async () => {
    if (selectedListings.size === 0) {
      toast.error("No properties selected");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save properties");
        return;
      }

      const promises = Array.from(selectedListings).map(listingId =>
        supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId })
      );
      
      await Promise.all(promises);
      toast.success(`Added ${selectedListings.size} properties to favorites`);
      setSelectedListings(new Set());
    } catch (error: any) {
      toast.error("Error saving properties: " + error.message);
    }
  };

  const toggleListingSelection = (listingId: string) => {
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
    } else {
      newSelected.add(listingId);
    }
    setSelectedListings(newSelected);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-4xl font-bold">Search Results</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>Back to Filters</Button>
              <Button onClick={() => navigate("/browse")}>Modify Search</Button>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-lg font-semibold">{loading ? "Loading…" : `${listings.length} Properties Found`}</div>
              {!loading && listings.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    onClick={handleSelectAll}
                    className="text-sm"
                  >
                    {selectedListings.size === listings.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleKeepSelected}
                    disabled={selectedListings.size === 0}
                    className="text-sm"
                  >
                    Keep Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSaveSearch}
                    className="text-sm"
                  >
                    Save Search
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleShare}
                    className="text-sm"
                  >
                    Share
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSaveToWishList}
                    disabled={selectedListings.size === 0}
                    className="text-sm"
                  >
                    Save To Wish Lists
                  </Button>
                </div>
              )}
            </div>
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
                  className="relative"
                >
                  <div 
                    className="absolute top-4 left-4 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-background/90 backdrop-blur-sm p-2 rounded-md shadow-md border border-border">
                      <Checkbox
                        checked={selectedListings.has(listing.id)}
                        onCheckedChange={() => toggleListingSelection(listing.id)}
                        className="h-5 w-5 border-2 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                    </div>
                  </div>
                  <div 
                    onClick={() => navigate(`/property/${listing.id}`)}
                    className="cursor-pointer"
                  >
                    <PropertyCard
                      image={listing.photos?.[0]?.url || "/placeholder.svg"}
                      title={listing.property_type}
                      price={`$${listing.price?.toLocaleString()}`}
                      address={listing.address}
                      beds={listing.bedrooms}
                      baths={listing.bathrooms}
                      sqft={listing.square_feet?.toLocaleString() || "N/A"}
                      listingId={listing.id}
                      agentId={listing.agent_profile?.id}
                      agentName={listing.agent_profile ? `${listing.agent_profile.first_name} ${listing.agent_profile.last_name}` : undefined}
                      agentCompany={listing.agent_profile?.company}
                      agentPhoto={listing.agent_profile?.headshot_url}
                      agentPhone={listing.agent_profile?.phone}
                      agentEmail={listing.agent_profile?.email}
                    />
                  </div>
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
