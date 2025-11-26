import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Grid,
  List as ListIcon,
  Pencil,
  Eye,
  Share2,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

type ListingStatus =
  | "active"
  | "pending"
  | "sold"
  | "withdrawn"
  | "expired"
  | "cancelled"
  | "draft"
  | "coming_soon";

type ViewMode = "grid" | "list";

interface Listing {
  id: string;
  listing_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  status: string;
  listing_type: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
  created_at: string;
  active_date: string | null;
  auto_activate_on: string | null;
  auto_activate_days: number | null;
}

const statusTabs: { label: string; value: ListingStatus | "all" }[] = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Sold", value: "sold" },
  { label: "Withdrawn", value: "withdrawn" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Draft", value: "draft" },
  { label: "Coming Soon", value: "coming_soon" },
  { label: "All", value: "all" },
];

const MyListings = () => {
  const { user } = useAuthRole();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("active");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchListings();
    }
  }, [user, sortBy]);

  const fetchListings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("listings")
        .select("*")
        .eq("agent_id", user.id);

      // Apply sorting
      const [field, direction] = sortBy.split("_");
      const ascending = direction === "asc";
      
      if (field === "created") {
        query = query.order("created_at", { ascending });
      } else if (field === "price") {
        query = query.order("price", { ascending });
      } else if (field === "active") {
        query = query.order("active_date", { ascending, nullsFirst: !ascending });
      }

      const { data, error } = await query;

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter listings
  const filtered = listings.filter((listing) => {
    const matchesStatus =
      statusFilter === "all" ? true : listing.status === statusFilter;

    const searchTerm = search.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      listing.address.toLowerCase().includes(searchTerm) ||
      listing.city.toLowerCase().includes(searchTerm) ||
      listing.listing_number?.toLowerCase().includes(searchTerm);

    return matchesStatus && matchesSearch;
  });

  const getDaysOnMarket = (listing: Listing) => {
    if (!listing.active_date) return null;
    const start = new Date(listing.active_date);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "sold":
        return "default";
      case "draft":
      case "coming_soon":
        return "outline";
      default:
        return "outline";
    }
  };

  const getThumbnailUrl = (listing: Listing) => {
    if (!listing.photos) return null;
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    return photos[0] || null;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">You must be signed in as an agent to view your listings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your listings..." />;
  }

  if (listings.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 container mx-auto p-6">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-semibold mb-2">My Listings</h1>
            <p className="text-muted-foreground mb-6">You haven't created any listings yet.</p>
            <Button onClick={() => navigate("/new-listing")} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Listing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <div className="flex-1 container mx-auto p-6 space-y-4">
        {/* Header & controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your active, pending, and past listings from one place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/new-listing")}>
              <Plus className="mr-2 h-4 w-4" />
              New Listing
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 text-sm">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Search + sort row */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Input
              placeholder="Search by address or MLS #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">Newest first</SelectItem>
                <SelectItem value="created_at_asc">Oldest first</SelectItem>
                <SelectItem value="price_desc">Price (high → low)</SelectItem>
                <SelectItem value="price_asc">Price (low → high)</SelectItem>
                <SelectItem value="active_date_desc">Recently active</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {listings.length} listings
        </p>

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((listing) => {
              const thumbnail = getThumbnailUrl(listing);
              
              return (
                <div
                  key={listing.id}
                  className="border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition bg-card"
                >
                  <img
                    src={thumbnail || "/placeholder.svg"}
                    alt="Property"
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  />

                  <div className="p-4">
                    <div className="font-semibold text-lg">
                      {listing.address}, {listing.city}
                    </div>
                    <div className="text-muted-foreground">
                      ${listing.price.toLocaleString()}
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <Badge variant={getStatusBadgeVariant(listing.status)} className="capitalize">
                        {listing.status.replace("_", " ")}
                      </Badge>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/edit-listing/${listing.id}`)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/property/${listing.id}`)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const url = `${window.location.origin}/property/${listing.id}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied to clipboard!");
                          }}
                          title="Share"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!confirm("Are you sure you want to delete this listing?")) return;
                            try {
                              const { error } = await supabase
                                .from("listings")
                                .delete()
                                .eq("id", listing.id);
                              if (error) throw error;
                              toast.success("Listing deleted successfully");
                              fetchListings();
                            } catch (error) {
                              toast.error("Failed to delete listing");
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {filtered.map((listing) => {
              const thumbnail = getThumbnailUrl(listing);

              return (
                <div
                  key={listing.id}
                  className="flex items-center border rounded-lg p-4 bg-card hover:shadow-md transition"
                >
                  <img
                    src={thumbnail || "/placeholder.svg"}
                    alt="Property"
                    className="w-32 h-24 rounded-md object-cover mr-4"
                  />

                  <div className="flex-1">
                    <div className="font-semibold text-lg">
                      {listing.address}, {listing.city}
                    </div>
                    <div className="text-muted-foreground">
                      ${listing.price.toLocaleString()}
                    </div>
                    <Badge variant={getStatusBadgeVariant(listing.status)} className="mt-1 capitalize">
                      {listing.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/edit-listing/${listing.id}`)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/property/${listing.id}`)}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin}/property/${listing.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied to clipboard!");
                      }}
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to delete this listing?")) return;
                        try {
                          const { error } = await supabase
                            .from("listings")
                            .delete()
                            .eq("id", listing.id);
                          if (error) throw error;
                          toast.success("Listing deleted successfully");
                          fetchListings();
                        } catch (error) {
                          toast.error("Failed to delete listing");
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No listings found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyListings;
