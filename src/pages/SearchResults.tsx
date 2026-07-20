import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useLocation, useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { compareListingsByRecency } from "@/lib/listingRecencySort";
import PropertyMap from "@/components/PropertyMap";
import { Seo } from "@/components/Seo";

const useQuery = () => new URLSearchParams(useLocation().search);

function SearchResultsViewToggle({ value, onChange }: { value: "map" | "list"; onChange: (v: "map" | "list") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-[3px]">
      {(["map", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`h-7 rounded-md px-3 text-[13px] font-medium transition-colors ${value === v ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`}
        >
          {v === "map" ? "Map" : "List"}
        </button>
      ))}
    </div>
  );
}

interface SearchResultsProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

const SearchResults = ({
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: SearchResultsProps) => {
  const navigate = useNavigate();
  const search = useLocation().search;
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /** Session-only: mark listings to "keep" for this search (not persisted) */
  const [sessionKeptIds, setSessionKeptIds] = useState<Set<string>>(new Set());
  const [showKeptOnly, setShowKeptOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [resultsView, setResultsView] = useState<"map" | "list">("map");
  const publicMode = isPublicMode;
  const buyerMode = isBuyerMode;
  const agentMode = isAgentMode;
  const showInternalSelectionTools = agentMode;

  const filters = useMemo(() => {
    const params = new URLSearchParams(search);
    const get = (k: string) => params.get(k) || undefined;
    const getList = (k: string, sep = ",") => (params.get(k)?.split(sep).filter(Boolean) || undefined);
    const getBool = (k: string) => params.get(k) === "true";

    return {
      listingType: get("lt") || "for_sale",
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
          listingType: filters.listingType,
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
            .select("id, first_name, last_name, company, office_name, headshot_url")
            .in("id", agentIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p]));
          finalListings = (finalListings as any[]).map(l => ({
            ...l,
            agent_profile: profileMap.get(l.agent_id)
          }));
        }

        setListings(finalListings);
        setSessionKeptIds(new Set());
        setShowKeptOnly(false);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
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
        return sorted.sort((a, b) => compareListingsByRecency(a, b, "desc"));
      case "oldest":
        return sorted.sort((a, b) => compareListingsByRecency(a, b, "asc"));
      default:
        return sorted;
    }
  }, [listings, sortBy]);

  const displayListings = useMemo(() => {
    if (!showKeptOnly) return sortedListings;
    return sortedListings.filter((l) => sessionKeptIds.has(l.id));
  }, [sortedListings, showKeptOnly, sessionKeptIds]);

  const handleSelectAll = () => {
    const allIds = listings.map((l) => l.id);
    if (allIds.length === 0) return;
    if (sessionKeptIds.size === allIds.length) {
      setSessionKeptIds(new Set());
    } else {
      setSessionKeptIds(new Set(allIds));
    }
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
    if (sessionKeptIds.size === 0) {
      toast.error("No properties selected");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save properties");
        return;
      }

      const promises = Array.from(sessionKeptIds).map((listingId) =>
        supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId })
      );
      
      await Promise.all(promises);
      toast.success(`Added ${sessionKeptIds.size} properties to favorites`);
    } catch (error: any) {
      toast.error("Error saving properties: " + error.message);
    }
  };

  const toggleSessionKeep = (listingId: string) => {
    setSessionKeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  };

  return (
    <>
      <Seo title={publicMode || buyerMode ? "Homes" : "Search Results"} />
      <div className="min-h-screen flex flex-col pt-20">
      <main className="flex-1 bg-white">
        <div className="max-w-[1800px] mx-auto w-full px-4 md:px-7 py-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <PageTitle>{publicMode || buyerMode ? "Homes Matching Your Search" : "Search Results"}</PageTitle>
              <Button onClick={() => navigate(`/browse${search}`)}>{publicMode || buyerMode ? "Edit Search" : "Modify Search"}</Button>
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled>
              {loading ? "Loading..." : `${listings.length} ${publicMode || buyerMode ? "Homes" : "Properties"} Found`}
            </Button>
            {!loading && listings.length > 0 && (
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{sessionKeptIds.size}</span> kept
              </span>
            )}
          </div>

          {!loading && listings.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">View:</span>
              <Button
                type="button"
                variant={!showKeptOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowKeptOnly(false)}
              >
                Show all
              </Button>
              <Button
                type="button"
                variant={showKeptOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowKeptOnly(true)}
                disabled={sessionKeptIds.size === 0}
              >
                Show kept only
              </Button>
            </div>
          )}

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
                {showInternalSelectionTools && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {sessionKeptIds.size === listings.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
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
                  Share Search
                </Button>
                {showInternalSelectionTools && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSaveToWishList}
                    disabled={sessionKeptIds.size === 0}
                  >
                    Add to Favorites
                  </Button>
                )}
              </div>

              <SearchResultsViewToggle value={resultsView} onChange={setResultsView} />
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground">Loading homes...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground mb-4">No homes matched your search</p>
              <Button variant="outline" onClick={() => navigate("/browse")}>Adjust Filters</Button>
            </div>
          ) : showKeptOnly && displayListings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <p className="text-muted-foreground mb-2">No kept listings match this view.</p>
              <p className="text-sm text-muted-foreground mb-4">Check homes to keep them, or show all results.</p>
              <Button variant="outline" onClick={() => setShowKeptOnly(false)}>
                Show all
              </Button>
            </div>
          ) : resultsView === "map" ? (
            <div className="flex flex-col-reverse gap-4 h-auto min-h-0 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:flex-none lg:h-[calc(100dvh-7.8rem)] lg:min-h-0">
              <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-[50dvh] min-h-0 sm:h-[54dvh] lg:h-full lg:min-h-0 lg:sticky lg:top-[6.05rem]">
                <div className="h-full">
                  <PropertyMap
                    listings={displayListings}
                    onListingClick={(listingId) => navigate(`/property/${listingId}`)}
                  />
                </div>
              </section>
              <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden h-auto min-h-0 max-lg:min-h-[50vh] lg:min-h-0 lg:h-full flex flex-col">
                <div className="px-6 py-4 min-h-0 flex-1 lg:overflow-y-auto">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {displayListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        viewMode="compact"
                        showActions={false}
                        hideMlsMeta={publicMode || buyerMode}
                        onSelect={toggleSessionKeep}
                        isSelected={sessionKeptIds.has(listing.id)}
                        agentInfo={
                          publicMode || buyerMode
                            ? null
                            : (listing as any).agent_profile
                            ? {
                                name: `${(listing as any).agent_profile.first_name} ${(listing as any).agent_profile.last_name}`.trim(),
                                company: (listing as any).agent_profile.company
                              }
                            : null
                        }
                      />
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.07)] overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode="compact"
                      showActions={false}
                      hideMlsMeta={publicMode || buyerMode}
                      onSelect={toggleSessionKeep}
                      isSelected={sessionKeptIds.has(listing.id)}
                      agentInfo={
                        publicMode || buyerMode
                          ? null
                          : (listing as any).agent_profile
                          ? {
                              name: `${(listing as any).agent_profile.first_name} ${(listing as any).agent_profile.last_name}`.trim(),
                              company: (listing as any).agent_profile.company
                            }
                          : null
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
};

export default SearchResults;
