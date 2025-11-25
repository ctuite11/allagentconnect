import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { ActiveAgentBanner } from "@/components/ActiveAgentBanner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { UnifiedPropertySearch, SearchCriteria } from "@/components/search/UnifiedPropertySearch";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

const BrowsePropertiesNew = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});

  const [criteria, setCriteria] = useState<SearchCriteria>({
    state: "MA",
    county: "all",
    towns: [],
    showAreas: true,
    propertyTypes: [],
    statuses: ["new", "coming_soon", "active", "back_on_market"],
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
  });

  // Initialize filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCriteria: Partial<SearchCriteria> = {};

    if (params.has("status")) urlCriteria.statuses = params.get("status")!.split(",");
    if (params.has("type")) urlCriteria.propertyTypes = params.get("type")!.split(",");
    if (params.has("minPrice")) urlCriteria.minPrice = params.get("minPrice")!;
    if (params.has("maxPrice")) urlCriteria.maxPrice = params.get("maxPrice")!;
    if (params.has("bedrooms")) urlCriteria.bedrooms = params.get("bedrooms")!;
    if (params.has("bathrooms")) urlCriteria.bathrooms = params.get("bathrooms")!;
    if (params.has("zip")) urlCriteria.zipCode = params.get("zip")!;
    if (params.has("state")) urlCriteria.state = params.get("state")!;
    if (params.has("county")) urlCriteria.county = params.get("county")!;
    if (params.has("towns")) urlCriteria.towns = params.get("towns")!.split("|");
    if (params.has("showAreas")) urlCriteria.showAreas = params.get("showAreas") === "yes";

    if (Object.keys(urlCriteria).length > 0) {
      setCriteria({ ...criteria, ...urlCriteria });
    }
  }, []);

  // Fetch listings when criteria changes
  useEffect(() => {
    fetchListings();
  }, [criteria]);

  const fetchListings = async () => {
    try {
      setLoading(true);

      // Convert SearchCriteria to buildListingsQuery format with proper types
      const queryParams: any = {
        statuses: criteria.statuses,
        propertyTypes: criteria.propertyTypes,
        zipCode: criteria.zipCode,
        state: criteria.state,
        cities: criteria.towns,
      };

      // Convert string prices to numbers
      if (criteria.minPrice) queryParams.minPrice = parseFloat(criteria.minPrice);
      if (criteria.maxPrice) queryParams.maxPrice = parseFloat(criteria.maxPrice);
      if (criteria.bedrooms) queryParams.bedrooms = parseInt(criteria.bedrooms);
      if (criteria.bathrooms) queryParams.bathrooms = parseFloat(criteria.bathrooms);
      if (criteria.minLivingArea) queryParams.minSqft = parseFloat(criteria.minLivingArea);
      if (criteria.maxLivingArea) queryParams.maxSqft = parseFloat(criteria.maxLivingArea);

      const query = buildListingsQuery(supabase, queryParams).limit(200);
      const { data, error } = await query;

      if (error) throw error;

      // Fetch agent profiles in batch
      const agentIds = Array.from(new Set(data?.map((listing: any) => listing.agent_id) || []));
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company")
        .in("id", agentIds);

      const agentMapping: Record<string, { fullName: string; company?: string | null }> = {};
      agents?.forEach((agent) => {
        agentMapping[agent.id] = {
          fullName: `${agent.first_name} ${agent.last_name}`,
          company: agent.company,
        };
      });
      setAgentMap(agentMapping);

      setListings(data || []);
    } catch (error: any) {
      toast.error("Failed to load properties");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (criteria.statuses?.length) params.set("status", criteria.statuses.join(","));
    if (criteria.propertyTypes?.length) params.set("type", criteria.propertyTypes.join(","));
    if (criteria.minPrice) params.set("minPrice", criteria.minPrice);
    if (criteria.maxPrice) params.set("maxPrice", criteria.maxPrice);
    if (criteria.bedrooms) params.set("bedrooms", criteria.bedrooms);
    if (criteria.bathrooms) params.set("bathrooms", criteria.bathrooms);
    if (criteria.zipCode) params.set("zip", criteria.zipCode);
    if (criteria.state) params.set("state", criteria.state);
    if (criteria.county) params.set("county", criteria.county);
    if (criteria.towns?.length) params.set("towns", criteria.towns.join("|"));
    if (criteria.showAreas) params.set("showAreas", criteria.showAreas ? "yes" : "no");
    return params;
  };

  const handleViewResults = () => {
    const params = buildQueryParams();
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <ActiveAgentBanner />

      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">Property Search</h1>
            <p className="text-muted-foreground">
              Advanced search with comprehensive filters
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <UnifiedPropertySearch
                  criteria={criteria}
                  onCriteriaChange={setCriteria}
                  resultsCount={listings.length}
                  showResultsCount={true}
                  onSearch={fetchListings}
                />
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <Search className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No properties found</h3>
                  <p className="text-muted-foreground">Try adjusting your search filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode="compact"
                      showActions={false}
                      agentInfo={
                        agentMap[listing.agent_id]
                          ? {
                              name: agentMap[listing.agent_id].fullName,
                              company: agentMap[listing.agent_id].company || undefined,
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BrowsePropertiesNew;
