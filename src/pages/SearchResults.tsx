import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useLocation, useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { ActiveAgentBanner } from "@/components/ActiveAgentBanner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, List, MapPin } from "lucide-react";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

const useQuery = () => new URLSearchParams(useLocation().search);

const SearchResults = () => {
  const navigate = useNavigate();
  const search = useLocation().search;
  const [listings, setListings] = useState<any[]>([]);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewType, setViewType] = useState<"grid" | "list">("grid");

  const filters = useMemo(() => {
    const params = new URLSearchParams(search);
    const get = (k: string) => params.get(k) || undefined;
    const getList = (k: string, sep = ",") => (params.get(k)?.split(sep).filter(Boolean) || undefined);
    const getBool = (k: string) => params.get(k) === "true";

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
      openHouses: getBool("openHouses"),
      brokerTours: getBool("brokerTours"),
      eventTimeframe: get("eventTimeframe") || "next_3_days",
    };
  }, [search]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        
        // Get current user for private listing visibility check
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        
        // Build unified search criteria
        const criteria = {
          statuses: filters.statuses,
          propertyTypes: filters.types,
          cities: filters.towns || [],
          state: filters.state,
          zipCode: filters.zip,
          minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
          maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
          bedrooms: filters.bedrooms ? parseInt(filters.bedrooms) : undefined,
          bathrooms: filters.bathrooms ? parseFloat(filters.bathrooms) : undefined,
          listingNumber: filters.listingNumber
        };
        
        const { data, error } = await buildListingsQuery(supabase, criteria).limit(200);
        if (error) throw error;

        // Filter for open houses or broker tours if selected
        let finalListings = data || [];
        if ((filters.openHouses || filters.brokerTours) && finalListings) {
          const now = new Date();
          let endDate = new Date();
          
          // Calculate end date based on timeframe
          switch (filters.eventTimeframe) {
            case "next_3_days":
              endDate.setDate(now.getDate() + 3);
              break;
            case "next_7_days":
              endDate.setDate(now.getDate() + 7);
              break;
            case "next_14_days":
              endDate.setDate(now.getDate() + 14);
              break;
          }
          
          finalListings = finalListings.filter((listing: any) => {
            if (!listing.open_houses || !Array.isArray(listing.open_houses)) return false;
            
            return listing.open_houses.some((oh: any) => {
              const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}`);
              const isUpcoming = ohEndDateTime > now && ohEndDateTime <= endDate;
              
              if (filters.openHouses && filters.brokerTours) {
                return isUpcoming; // Show both types
              } else if (filters.openHouses) {
                return isUpcoming && oh.type !== 'broker';
              } else if (filters.brokerTours) {
                return isUpcoming && oh.type === 'broker';
              }
              return false;
            });
          });
        }

        // Off-market visibility rule: off_market listings only visible to listing agent
        finalListings = finalListings.filter((listing: any) => {
          if (listing.status !== 'off_market') return true;
          // Off-market listings: only show if current user is the listing agent
          return currentUserId && listing.agent_id === currentUserId;
        });

        // Fetch agent profiles in batch and attach to listings
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

  // Sort listings based on selected option
  const sortedListings = useMemo(() => {
    const sorted = [...listings];
    switch (sortBy) {
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      case "newest":
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "oldest":
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default:
        return sorted;
    }
  }, [listings, sortBy]);

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
    <div className="min-h-screen flex flex-col pt-20">
      <ActiveAgentBanner />
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <PageTitle>Search Results</PageTitle>
              <Button onClick={() => navigate(`/browse${search}`)}>Modify Search</Button>
            </div>
            {filters.state && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Scope:</span>
                {filters.towns && filters.towns.length > 0 ? (
                  <span>{filters.towns.join(", ")}</span>
                ) : (
                  <span>All of {filters.state}</span>
                )}
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="mb-4">
            <Button variant="outline" disabled>
              {loading ? "Loading…" : `${listings.length} Properties Found`}
            </Button>
          </div>

          {/* Controls Bar: Sort | Action Buttons | View Toggle */}
          {!loading && listings.length > 0 && (
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedListings.size === listings.length ? "Deselect All" : "Select All"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleKeepSelected}
                  disabled={selectedListings.size === 0}
                >
                  Keep Selected
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveSearch}
                >
                  Save Search
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleShare}
                >
                  Share
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveToWishList}
                  disabled={selectedListings.size === 0}
                >
                  Add to Favorites
                </Button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewType === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewType("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewType === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewType("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

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
            <div className={viewType === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {sortedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode="compact"
                  showActions={false}
                  onSelect={toggleListingSelection}
                  isSelected={selectedListings.has(listing.id)}
                  agentInfo={
                    (listing as any).agent_profile
                      ? {
                          name: `${(listing as any).agent_profile.first_name} ${(listing as any).agent_profile.last_name}`.trim(),
                          company: (listing as any).agent_profile.company
                        }
                      : null
                  }
                />
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
