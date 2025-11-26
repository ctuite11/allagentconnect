import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  List as ListIcon,
  Pencil,
  ImageIcon,
  Eye,
  CalendarDays,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

type ListingStatus =
  | "active"
  | "pending"
  | "sold"
  | "withdrawn"
  | "expired"
  | "cancelled"
  | "draft"
  | "coming_soon";

type ViewMode = "table" | "grid";

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
  const [viewMode, setViewMode] = useState<ViewMode>("table");
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
            <div className="hidden md:flex rounded-full border bg-muted p-1">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setViewMode("table")}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
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

          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile view toggle */}
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {listings.length} listings
        </p>

        {/* Table View */}
        {viewMode === "table" && (
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Property
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Price
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      DOM
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((listing) => {
                    const thumbnail = getThumbnailUrl(listing);
                    const dom = getDaysOnMarket(listing);
                    
                    return (
                      <tr key={listing.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={listing.address}
                                className="h-16 w-16 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{listing.address}</div>
                              <div className="text-sm text-muted-foreground">
                                {listing.city}, {listing.state} {listing.zip_code}
                              </div>
                              {listing.listing_number && (
                                <div className="text-xs text-muted-foreground">
                                  MLS# {listing.listing_number}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={getStatusBadgeVariant(listing.status)}>
                            {listing.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">
                            ${listing.price.toLocaleString()}
                          </div>
                          {listing.listing_type === "for_rent" && (
                            <div className="text-xs text-muted-foreground">per month</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm capitalize">
                            {listing.property_type?.replace(/_/g, " ") || "N/A"}
                          </div>
                          {listing.bedrooms && listing.bathrooms && (
                            <div className="text-xs text-muted-foreground">
                              {listing.bedrooms} bd • {listing.bathrooms} ba
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {dom !== null ? `${dom} days` : "—"}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
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
                              onClick={() => navigate(`/edit-listing/${listing.id}`)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/manage-listing-photos/${listing.id}`)}
                              title="Manage Photos"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((listing) => {
              const thumbnail = getThumbnailUrl(listing);
              const dom = getDaysOnMarket(listing);
              
              return (
                <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div 
                    className="aspect-video bg-muted relative cursor-pointer"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={listing.address}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant={getStatusBadgeVariant(listing.status)}>
                        {listing.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="font-semibold text-lg">
                        ${listing.price.toLocaleString()}
                        {listing.listing_type === "for_rent" && (
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {listing.address}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {listing.city}, {listing.state} {listing.zip_code}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {listing.bedrooms && (
                        <span>{listing.bedrooms} bd</span>
                      )}
                      {listing.bathrooms && (
                        <span>{listing.bathrooms} ba</span>
                      )}
                      {listing.square_feet && (
                        <span>{listing.square_feet.toLocaleString()} sqft</span>
                      )}
                    </div>

                    {dom !== null && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        <span>{dom} days on market</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/edit-listing/${listing.id}`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/manage-listing-photos/${listing.id}`)}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/property/${listing.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
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
