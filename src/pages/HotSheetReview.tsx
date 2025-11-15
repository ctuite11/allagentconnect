import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, Image as ImageIcon, Bed, Bath, Maximize, Home, MapPin } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import { ShareListingDialog } from "@/components/ShareListingDialog";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  neighborhood?: string | null;
  agent_id: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  photos: any;
  attom_data?: any;
  created_at: string;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
}

const HotSheetReview = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hotSheet, setHotSheet] = useState<HotSheet | null>(null);
const [listings, setListings] = useState<Listing[]>([]);
const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (id) {
      fetchHotSheetAndListings();
    }
  }, [id]);

  const fetchHotSheetAndListings = async () => {
    try {
      setLoading(true);
      
      // Fetch hot sheet
      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", id)
        .single();

      if (hotSheetError) throw hotSheetError;
      setHotSheet(hotSheetData);

      // Build query for matching listings
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active");

      const criteria = hotSheetData.criteria as any;

      // Map criteria property type values to database values
      const propertyTypeMap: Record<string, string> = {
        'single_family': 'Single Family',
        'condo': 'Condominium',
        'multi_family': 'Multi Family',
        'townhouse': 'Townhouse',
        'land': 'Land',
        'commercial': 'Commercial',
        'business_opp': 'Business Opportunity'
      };

      if (criteria.propertyTypes?.length > 0) {
        const mappedTypes = criteria.propertyTypes.map((type: string) => 
          propertyTypeMap[type] || type
        );
        query = query.in("property_type", mappedTypes);
      }
      if (criteria.minPrice) {
        query = query.gte("price", criteria.minPrice);
      }
      if (criteria.maxPrice) {
        query = query.lte("price", criteria.maxPrice);
      }
      if (criteria.bedrooms) {
        query = query.gte("bedrooms", criteria.bedrooms);
      }
      if (criteria.bathrooms) {
        query = query.gte("bathrooms", criteria.bathrooms);
      }
      if (criteria.minSqft) {
        query = query.gte("square_feet", criteria.minSqft);
      }
      if (criteria.maxSqft) {
        query = query.lte("square_feet", criteria.maxSqft);
      }
      if (criteria.cities?.length > 0) {
        // Handle both city-only and city-neighborhood formats
        const cityFilters = criteria.cities.map((cityStr: string) => {
          const parts = cityStr.split(',');
          const cityPart = parts[0].trim();
          
          // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
          if (cityPart.includes('-')) {
            const [city, neighborhood] = cityPart.split('-').map(s => s.trim());
            return { city, neighborhood };
          }
          
          return { city: cityPart, neighborhood: null };
        });
        
        // Group by cities that have neighborhoods vs just cities
        const citiesWithNeighborhoods = cityFilters.filter(f => f.neighborhood);
        const citiesOnly = cityFilters.filter(f => !f.neighborhood).map(f => f.city);
        
// Build complex filter: (city in citiesOnly) OR (city=X AND neighborhood=Y) OR ...
const q = (v: string) => `"${String(v).replace(/"/g, '\\"')}"`;
if (citiesWithNeighborhoods.length > 0 && citiesOnly.length > 0) {
  // Use OR logic with properly quoted string values (handles spaces like "Back Bay")
  query = query.or(
    `city.in.(${citiesOnly.map(q).join(',')}),` +
    citiesWithNeighborhoods
      .map((f) => `and(city.eq.${q(f.city)},neighborhood.eq.${q(f.neighborhood!)} )`)
      .join(',')
  );
} else if (citiesWithNeighborhoods.length > 0) {
  query = query.or(
    citiesWithNeighborhoods
      .map((f) => `and(city.eq.${q(f.city)},neighborhood.eq.${q(f.neighborhood!)} )`)
      .join(',')
  );
} else if (citiesOnly.length > 0) {
  // Only cities specified (no neighborhoods)
  query = query.in("city", citiesOnly);
}
      }
      if (criteria.state) {
        query = query.eq("state", criteria.state);
      }
      if (criteria.zipCode) {
        query = query.eq("zip_code", criteria.zipCode);
      }

const { data: listingsData, error: listingsError } = await query.order("created_at", { ascending: false });

if (listingsError) throw listingsError;
setListings(listingsData || []);

// Load listing agents for display
const agentIds = Array.from(new Set((listingsData || []).map((l: any) => l.agent_id).filter(Boolean)));
if (agentIds.length > 0) {
  const { data: agents } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, company")
    .in("id", agentIds as string[]);
  const map: Record<string, { fullName: string; company?: string | null }> = {};
  (agents || []).forEach((a: any) => {
    map[a.id] = { fullName: `${a.first_name} ${a.last_name}`.trim(), company: a.company };
  });
  setAgentMap(map);
}
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load hot sheet data");
    } finally {
      setLoading(false);
    }
  };

  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "price-high":
        return b.price - a.price;
      case "price-low":
        return a.price - b.price;
      default:
        return 0;
    }
  });

  const toggleListing = (listingId: string) => {
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
    } else {
      newSelected.add(listingId);
    }
    setSelectedListings(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedListings.size === listings.length) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(listings.map((l) => l.id)));
    }
  };

  const handleSendFirstBatch = async () => {
    if (selectedListings.size === 0) {
      toast.error("Please select at least one listing to send");
      return;
    }

    try {
      setSending(true);

      // Send the selected listings via the edge function
      const { error } = await supabase.functions.invoke("process-hot-sheet", {
        body: {
          hotSheetId: id,
          sendInitialBatch: true,
          selectedListingIds: Array.from(selectedListings),
        },
      });

      if (error) throw error;

      toast.success(`Sent ${selectedListings.size} listings to client`);
      navigate("/hot-sheets");
    } catch (error: any) {
      console.error("Error sending listings:", error);
      toast.error("Failed to send listings");
    } finally {
      setSending(false);
    }
  };

  const getCriteriaDisplay = () => {
    if (!hotSheet?.criteria) return [];
    
    const criteria = hotSheet.criteria as any;
    const parts = [];

    if (criteria.propertyTypes?.length > 0) {
      parts.push(`Property: ${criteria.propertyTypes.join(", ")}`);
    }
    if (criteria.minPrice || criteria.maxPrice) {
      const min = criteria.minPrice ? `$${criteria.minPrice.toLocaleString()}` : "Any";
      const max = criteria.maxPrice ? `$${criteria.maxPrice.toLocaleString()}` : "Any";
      parts.push(`Price: ${min} - ${max}`);
    }
    if (criteria.bedrooms) {
      parts.push(`${criteria.bedrooms}+ beds`);
    }
    if (criteria.bathrooms) {
      parts.push(`${criteria.bathrooms}+ baths`);
    }
    if (criteria.cities?.length > 0) {
      const cityList = criteria.cities.length > 5
        ? `${criteria.cities.slice(0, 5).join(", ")} (+${criteria.cities.length - 5} more)`
        : criteria.cities.join(", ");
      parts.push(`Cities: ${cityList}`);
    }
    if (criteria.state) {
      parts.push(`State: ${criteria.state}`);
    }
    if (criteria.zipCode) {
      parts.push(`Zip: ${criteria.zipCode}`);
    }

    return parts;
  };

  const getClientDisplay = () => {
    if (!hotSheet?.criteria) return null;
    
    const criteria = hotSheet.criteria as any;
    if (criteria.clientFirstName || criteria.clientLastName) {
      return `${criteria.clientFirstName || ""} ${criteria.clientLastName || ""}`.trim();
    }
    return criteria.clientEmail || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading hot sheet...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Hot sheet not found</p>
            <Button onClick={() => navigate("/hot-sheets")} className="mt-4">
              Back to Hot Sheets
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/hot-sheets")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hot Sheets
            </Button>
            <h1 className="text-4xl font-bold mb-2">{hotSheet.name}</h1>
            {getClientDisplay() && (
              <p className="text-lg text-muted-foreground">
                Client: {getClientDisplay()}
              </p>
            )}
          </div>

          {/* Search Criteria */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Search Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              {getCriteriaDisplay().length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {getCriteriaDisplay().map((criterion, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">All properties</p>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Checkbox
                id="select-all"
                checked={selectedListings.size === listings.length && listings.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all" className="cursor-pointer font-medium">
                Select All ({listings.length} listings)
              </label>
              {selectedListings.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedListings.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest to Oldest</SelectItem>
                  <SelectItem value="oldest">Oldest to Newest</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleSendFirstBatch}
                disabled={sending || selectedListings.size === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                Send First Batch ({selectedListings.size})
              </Button>
            </div>
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground">
                  No listings match the search criteria
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden">
                  <div className="relative">
                    <div className="absolute top-4 left-4 z-10">
                      <div 
                        onClick={() => toggleListing(listing.id)}
                        className={`w-6 h-6 rounded border-2 cursor-pointer transition-all flex items-center justify-center ${
                          selectedListings.has(listing.id) 
                            ? 'bg-primary border-primary' 
                            : 'bg-background border-border hover:border-primary'
                        }`}
                      >
                        {selectedListings.has(listing.id) && (
                          <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                      <ShareListingDialog 
                        listingId={listing.id}
                        listingAddress={listing.address || `${listing.city}, ${listing.state} ${listing.zip_code}`}
                      />
                      <FavoriteButton listingId={listing.id} size="icon" variant="secondary" />
                    </div>
                    {(listing.neighborhood || (listing as any).attom_data?.neighborhood) && (
                      <div className="absolute bottom-2 right-2 z-10">
                        <span className="inline-flex items-center rounded-full bg-background/80 text-foreground px-2 py-1 text-xs shadow">
                          {listing.neighborhood || (listing as any).attom_data?.neighborhood}
                        </span>
                      </div>
                    )}
                    {listing.photos && listing.photos[0] ? (
                      <img
                        src={listing.photos[0].url || listing.photos[0]}
                        alt={listing.address || `${listing.city}, ${listing.state} ${listing.zip_code}`}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-2xl font-bold text-primary">
                        ${listing.price.toLocaleString()}
                      </p>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          ID# {listing.listing_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.floor((new Date().getTime() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                        </p>
                      </div>
                    </div>
                    {listing.property_type && (
                      <div className="flex items-center gap-2 mb-1">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{listing.property_type}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mb-1">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="font-medium">
                        {listing.address || `${listing.city}, ${listing.state} ${listing.zip_code}`}
                      </p>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex gap-4">
                        {listing.bedrooms && (
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4" />
                            <span>{listing.bedrooms} bed</span>
                          </div>
                        )}
                        {listing.bathrooms && (
                          <div className="flex items-center gap-1">
                            <Bath className="h-4 w-4" />
                            <span>{listing.bathrooms} bath</span>
                          </div>
                        )}
                        {listing.square_feet && (
                          <div className="flex items-center gap-1">
                            <Maximize className="h-4 w-4" />
                            <span>{listing.square_feet.toLocaleString()} sqft</span>
                          </div>
                        )}
                      </div>
                      {agentMap[listing.agent_id] && (
                        <button
                          onClick={() => navigate(`/agent/${listing.agent_id}`)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors text-right shrink-0"
                        >
                          {agentMap[listing.agent_id].fullName}
                          {agentMap[listing.agent_id].company && (
                            <span className="block">{agentMap[listing.agent_id].company}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HotSheetReview;
