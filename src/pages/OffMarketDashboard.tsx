import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { OffMarketTable } from "@/components/off-market/OffMarketTable";
import { OffMarketFilters } from "@/components/off-market/OffMarketFilters";
import { ChangeStatusDialog } from "@/components/off-market/ChangeStatusDialog";
import { Button } from "@/components/ui/button";
import { Plus, Lock } from "lucide-react";
import { toast } from "sonner";

export interface OffMarketListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  status: string;
  listing_type: string | null;
  created_at: string;
  photos: any[];
  view_count: number;
  inquiry_count: number;
  save_count: number;
}

export default function OffMarketDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<OffMarketListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<OffMarketListing[]>([]);
  
  // Filters
  const [searchText, setSearchText] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"price" | "created_at" | "interest">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // Status change dialog
  const [selectedListing, setSelectedListing] = useState<OffMarketListing | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  useEffect(() => {
    loadOffMarketListings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [listings, searchText, propertyTypeFilter, sortBy, sortOrder]);

  const loadOffMarketListings = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get off-market listings (listing_type = 'private' or status includes off-market indicators)
      const { data: listingsData, error } = await supabase
        .from("listings")
        .select(`
          id,
          address,
          city,
          state,
          zip_code,
          price,
          property_type,
          bedrooms,
          bathrooms,
          square_feet,
          status,
          listing_type,
          created_at,
          photos
        `)
        .eq("agent_id", user.id)
        .eq("listing_type", "private")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get stats for each listing
      const listingIds = listingsData?.map(l => l.id) || [];
      
      const { data: statsData } = await supabase
        .from("listing_stats")
        .select("listing_id, view_count, save_count, contact_count")
        .in("listing_id", listingIds);

      const { data: viewsData } = await supabase
        .from("off_market_views")
        .select("listing_id")
        .in("listing_id", listingIds);

      // Combine data
      const enrichedListings: OffMarketListing[] = (listingsData || []).map(listing => {
        const stats = statsData?.find(s => s.listing_id === listing.id);
        const offMarketViews = viewsData?.filter(v => v.listing_id === listing.id).length || 0;
        
        return {
          ...listing,
          photos: Array.isArray(listing.photos) ? listing.photos : [],
          view_count: (stats?.view_count || 0) + offMarketViews,
          inquiry_count: stats?.contact_count || 0,
          save_count: stats?.save_count || 0,
        };
      });

      setListings(enrichedListings);
    } catch (error) {
      console.error("Error loading off-market listings:", error);
      toast.error("Failed to load off-market listings");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...listings];

    // Text search
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(l => 
        l.address.toLowerCase().includes(search) ||
        l.city.toLowerCase().includes(search) ||
        l.zip_code.includes(search)
      );
    }

    // Property type filter
    if (propertyTypeFilter) {
      result = result.filter(l => l.property_type === propertyTypeFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === "price") {
        comparison = a.price - b.price;
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "interest") {
        const scoreA = a.view_count + (a.inquiry_count * 5) + (a.save_count * 3);
        const scoreB = b.view_count + (b.inquiry_count * 5) + (b.save_count * 3);
        comparison = scoreA - scoreB;
      }
      
      return sortOrder === "desc" ? -comparison : comparison;
    });

    setFilteredListings(result);
  };

  const handleChangeStatus = (listing: OffMarketListing) => {
    setSelectedListing(listing);
    setIsStatusDialogOpen(true);
  };

  const handleStatusChanged = () => {
    setIsStatusDialogOpen(false);
    setSelectedListing(null);
    loadOffMarketListings();
    toast.success("Listing status updated");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-amber-500" />
              <h1 className="text-3xl font-bold text-foreground">Off-Market Dashboard</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage your private inventory • {listings.length} listing{listings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button 
            onClick={() => navigate("/agent/listings/new?type=private")}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Off-Market Listing
          </Button>
        </div>

        {/* Filters */}
        <OffMarketFilters
          searchText={searchText}
          onSearchChange={setSearchText}
          propertyTypeFilter={propertyTypeFilter}
          onPropertyTypeChange={setPropertyTypeFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />

        {/* Table */}
        <OffMarketTable
          listings={filteredListings}
          onChangeStatus={handleChangeStatus}
          onViewListing={(id) => navigate(`/property/${id}`)}
          onEditListing={(id) => navigate(`/agent/listings/edit/${id}`)}
        />

        {/* Status Change Dialog */}
        {selectedListing && (
          <ChangeStatusDialog
            open={isStatusDialogOpen}
            onOpenChange={setIsStatusDialogOpen}
            listing={selectedListing}
            onStatusChanged={handleStatusChanged}
          />
        )}
      </div>
    </div>
  );
}
