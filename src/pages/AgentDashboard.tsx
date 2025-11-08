import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import ListingCard from "@/components/ListingCard";
import forSaleImg from "@/assets/listing-for-sale.jpg";
import privateSaleImg from "@/assets/listing-private-sale.jpg";
import forRentImg from "@/assets/listing-for-rent.jpg";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LayoutGrid, List, Home, Flame, Heart, Users, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Listing {
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
  photos: any;
  open_houses: any;
  listing_type: string | null;
  created_at: string;
  active_date?: string | null;
  is_relisting?: boolean;
  original_listing_id?: string | null;
  listing_stats?: {
    view_count: number;
    save_count: number;
    contact_count: number;
    showing_request_count: number;
    cumulative_active_days: number;
  };
}

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tempStatusFilters, setTempStatusFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'status' | 'matches'>('date');
  const [hotSheetsCount, setHotSheetsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Agent Dashboard - Agent Connect";
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async (userId: string) => {
    try {
      // Load listings with stats
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_stats (
            view_count,
            save_count,
            contact_count,
            showing_request_count
          )
        `)
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        // Transform the data to match our interface
        const transformedData = data.map(listing => ({
          ...listing,
          listing_stats: listing.listing_stats?.[0] || {
            view_count: 0,
            save_count: 0,
            contact_count: 0,
            showing_request_count: 0
          }
        }));
        setListings(transformedData);
      }

      // Load hot sheets count
      const { count: hotSheetsCount } = await supabase
        .from("hot_sheets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (hotSheetsCount) setHotSheetsCount(hotSheetsCount);

      // Load favorites count
      const { count: favoritesCount } = await supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (favoritesCount) setFavoritesCount(favoritesCount);

      // Load clients count
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", userId);
      if (clientsCount) setClientsCount(clientsCount);

      // Load messages count
      const { count: messagesCount } = await supabase
        .from("agent_messages")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", userId);
      if (messagesCount) setMessagesCount(messagesCount);

      // Load recent activity
      const activity: any[] = [];

      // Recent listings (last 5)
      const { data: recentListings } = await supabase
        .from("listings")
        .select("id, address, city, state, created_at, status")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (recentListings) {
        recentListings.forEach(listing => {
          activity.push({
            type: 'listing',
            icon: 'Home',
            title: 'New listing added',
            description: `${listing.address}, ${listing.city}, ${listing.state}`,
            timestamp: listing.created_at,
            status: listing.status
          });
        });
      }

      // Recent messages (last 5)
      const { data: recentMessages } = await supabase
        .from("agent_messages")
        .select("id, sender_name, message, created_at, listing_id")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (recentMessages) {
        recentMessages.forEach(msg => {
          activity.push({
            type: 'message',
            icon: 'Mail',
            title: `Message from ${msg.sender_name}`,
            description: msg.message.substring(0, 100) + (msg.message.length > 100 ? '...' : ''),
            timestamp: msg.created_at
          });
        });
      }

      // Recent clients (last 5)
      const { data: recentClients } = await supabase
        .from("clients")
        .select("id, first_name, last_name, created_at, email")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (recentClients) {
        recentClients.forEach(client => {
          activity.push({
            type: 'client',
            icon: 'Users',
            title: 'New client added',
            description: `${client.first_name} ${client.last_name} - ${client.email}`,
            timestamp: client.created_at
          });
        });
      }

      // Sort all activity by timestamp
      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activity.slice(0, 10)); // Keep only 10 most recent
    } catch (error: any) {
      toast.error("Error loading data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sortListings = (listingsToSort: Listing[]) => {
    return [...listingsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'matches':
          // This will sort by match count once we have that data
          return 0;
        default:
          return 0;
      }
    });
  };

  const handleDeleteClick = (listingId: string) => {
    setListingToDelete(listingId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;

    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingToDelete);

      if (error) throw error;

      setListings(listings.filter((l) => l.id !== listingToDelete));
      toast.success("Listing deleted successfully");
    } catch (error: any) {
      toast.error("Error deleting listing: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const listingTypes = [
    {
      title: "For Sale",
      description: "Add a new listing for sale.",
      image: forSaleImg,
      action: () => navigate("/add-listing?type=sale"),
    },
    {
      title: "For Off Market Sale",
      description: "Add a new off market listing for sale.",
      image: privateSaleImg,
      action: () => navigate("/add-listing?type=private"),
    },
    {
      title: "For Rent",
      description: "Add a new listing for rent.",
      image: forRentImg,
      action: () => navigate("/add-listing?type=rent"),
    },
  ];

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home':
        return <Home className="h-4 w-4" />;
      case 'Mail':
        return <Mail className="h-4 w-4" />;
      case 'Users':
        return <Users className="h-4 w-4" />;
      default:
        return <Home className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Hello. Bonjour. Hola. 你好. Ciao
            </p>
            <h1 className="text-4xl font-bold">My Listings</h1>
            <p className="text-muted-foreground mt-2">
              A convenient way to add for sale and for rent listings, update listing status, easily edit property details and track all of your listings.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Dashboard Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/agent-dashboard")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Listings</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{listings.length}</div>
              <p className="text-xs text-muted-foreground">
                {listings.filter(l => l.status === 'active').length} active
              </p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs mt-1" 
                onClick={(e) => { e.stopPropagation(); navigate("/analytics"); }}
              >
                View Analytics →
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/hot-sheets")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Hot Sheets</CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hotSheetsCount}</div>
              <p className="text-xs text-muted-foreground">Active searches</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/favorites")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Favorites</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{favoritesCount}</div>
              <p className="text-xs text-muted-foreground">Saved properties</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/my-clients")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientsCount}</div>
              <p className="text-xs text-muted-foreground">Total clients</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Communications</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messagesCount}</div>
              <p className="text-xs text-muted-foreground">Total messages</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/add-listing")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full mb-2" onClick={(e) => { e.stopPropagation(); navigate("/add-listing"); }}>
                New Listing
              </Button>
              <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); navigate("/manage-coverage-areas"); }}>
                Coverage Areas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Feed */}
        {recentActivity.length > 0 && (
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest listings, messages, and client interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                      {getActivityIcon(activity.icon)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                      {activity.status && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary capitalize">
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Listing Type Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {listingTypes.map((type) => (
            <Card key={type.title} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img
                  src={type.image}
                  alt={type.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">{type.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{type.description}</p>
                <Button onClick={type.action} className="w-full">
                  Create Here
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Existing Listings */}
        {listings.length > 0 ? (
          <div className="space-y-8">
            {/* Draft Listings */}
            {listings.filter(l => (l.status || '').toLowerCase() === "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Draft Listings</h2>
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                  {listings.filter(l => (l.status || '').toLowerCase() === "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onDelete={handleDeleteClick}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Active Listings */}
            {listings.filter(l => (l.status || '').toLowerCase() !== "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase()))).length > 0 && (
              <div>
                {/* Status Filter and View Toggle - Moved above Active Listings */}
                <div className="mb-6 space-y-4">
                  <h2 className="text-xl font-semibold">Filter by Status</h2>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={tempStatusFilters.length === 8}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempStatusFilters(["active", "pending", "draft", "sold", "rented", "temporarily withdrawn", "cancelled", "expired"]);
                          } else {
                            setTempStatusFilters([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">All</span>
                    </label>
                    {["active", "pending", "draft", "sold", "rented", "temporarily withdrawn", "cancelled", "expired"].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempStatusFilters.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempStatusFilters([...tempStatusFilters, status]);
                            } else {
                              setTempStatusFilters(tempStatusFilters.filter(s => s !== status));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      setStatusFilters(tempStatusFilters);
                      setShowResults(true);
                    }}>
                      View Results
                    </Button>
                    {showResults && (
                      <Button variant="outline" onClick={() => {
                        setStatusFilters([]);
                        setTempStatusFilters([]);
                        setShowResults(false);
                      }}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {showResults && statusFilters.length > 0 && (
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      Showing {listings.filter(l => statusFilters.includes((l.status || '').toLowerCase())).length} listing(s) with status: {statusFilters.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </p>
                  </div>
                )}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Active Listings</h2>
                  <div className="flex gap-2 items-center">
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Sort by Date</SelectItem>
                        <SelectItem value="price">Sort by Price</SelectItem>
                        <SelectItem value="status">Sort by Status</SelectItem>
                        <SelectItem value="matches">Sort by Matches</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                  {sortListings(listings.filter(l => (l.status || '').toLowerCase() !== "draft" && (!showResults || statusFilters.length === 0 || statusFilters.includes((l.status || '').toLowerCase())))).map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onDelete={handleDeleteClick}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">You haven't added any listings yet.</p>
              <Button onClick={() => navigate("/add-listing")}>
                Add Your First Listing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgentDashboard;
