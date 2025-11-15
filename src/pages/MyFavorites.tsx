import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Share2, Image as ImageIcon, Bed, Bath, Maximize, Home, MapPin } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";

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
  created_at: string;
  hot_sheet_id: string;
  hot_sheet_name: string;
}

const MyFavorites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view favorites");
        navigate("/auth");
        return;
      }

      // Get all hot sheets for user
      const { data: hotSheets } = await supabase
        .from("hot_sheets")
        .select("id, name")
        .eq("user_id", user.id);

      if (!hotSheets?.length) {
        setLoading(false);
        return;
      }

      const hotSheetIds = hotSheets.map(hs => hs.id);

      // Get all favorited listings across hot sheets
      const { data: statuses, error: statusError } = await supabase
        .from("hot_sheet_listing_status")
        .select("listing_id, hot_sheet_id")
        .in("hot_sheet_id", hotSheetIds)
        .eq("status", "favorited");

      if (statusError) throw statusError;

      if (!statuses?.length) {
        setLoading(false);
        return;
      }

      const listingIds = Array.from(new Set(statuses.map(s => s.listing_id)));

      // Fetch listing details
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .in("id", listingIds);

      if (listingsError) throw listingsError;

      // Combine with hot sheet info
      const listingsWithHotSheet = listingsData?.map(listing => {
        const status = statuses.find(s => s.listing_id === listing.id);
        const hotSheet = hotSheets.find(hs => hs.id === status?.hot_sheet_id);
        return {
          ...listing,
          hot_sheet_id: status?.hot_sheet_id || "",
          hot_sheet_name: hotSheet?.name || ""
        };
      }) || [];

      setListings(listingsWithHotSheet);

      // Load agents
      const agentIds = Array.from(new Set(listingsData?.map((l: any) => l.agent_id).filter(Boolean)));
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
      console.error("Error fetching favorites:", error);
      toast.error("Failed to load favorites");
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

  const handleBulkDelete = async () => {
    if (selectedListings.size === 0) {
      toast.error("Please select listings to delete");
      return;
    }

    try {
      // For each selected listing, update status to deleted in their respective hot sheets
      const updates = Array.from(selectedListings).map(listingId => {
        const listing = listings.find(l => l.id === listingId);
        return {
          hot_sheet_id: listing?.hot_sheet_id,
          listing_id: listingId,
          status: 'deleted'
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from("hot_sheet_listing_status")
          .upsert({
            hot_sheet_id: update.hot_sheet_id,
            listing_id: update.listing_id,
            status: update.status
          });

        if (error) throw error;
      }

      toast.success(`Deleted ${selectedListings.size} listings`);
      setSelectedListings(new Set());
      fetchFavorites();
    } catch (error: any) {
      console.error("Error deleting listings:", error);
      toast.error("Failed to delete listings");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading favorites...</p>
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
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Favorites</h1>
            <p className="text-lg text-muted-foreground">
              All your saved listings from hot sheets
            </p>
          </div>

          {/* Bulk Actions Toolbar */}
          <div className="flex justify-between items-center mb-6 gap-4">
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
              {selectedListings.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedListings.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground">
                  No favorites yet. Heart listings from your hot sheets to save them here.
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
                    <div className="absolute top-4 right-4 z-10">
                      <FavoriteButton listingId={listing.id} size="icon" variant="secondary" />
                    </div>
                    {listing.photos && listing.photos[0] ? (
                      <img
                        src={listing.photos[0].url || listing.photos[0]}
                        alt={listing.address}
                        className="w-full h-48 object-cover cursor-pointer"
                        onClick={() => navigate(`/consumer/property/${listing.id}`)}
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-2xl font-bold text-primary">
                        ${listing.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID# {listing.listing_number}
                      </p>
                    </div>
                    {listing.property_type && (
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{listing.property_type}</p>
                      </div>
                    )}
                    <p className="font-medium mb-1">{listing.address}</p>
                    <div className="flex items-center gap-1 mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}, {listing.state} {listing.zip_code}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground mb-3">
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
                    {listing.hot_sheet_name && (
                      <div className="text-xs text-muted-foreground mb-2">
                        From: {listing.hot_sheet_name}
                      </div>
                    )}
                    {agentMap[listing.agent_id] && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => navigate(`/agent/${listing.agent_id}`)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors text-right"
                        >
                          {agentMap[listing.agent_id].fullName}
                          {agentMap[listing.agent_id].company && (
                            <span className="block">{agentMap[listing.agent_id].company}</span>
                          )}
                        </button>
                      </div>
                    )}
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

export default MyFavorites;
