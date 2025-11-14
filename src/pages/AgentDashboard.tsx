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
import { Badge } from "@/components/ui/badge";
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
  cancelled_at?: string | null;
  agent_id?: string;
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [listingToCancel, setListingToCancel] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tempStatusFilters, setTempStatusFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showResults, setShowResults] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'status' | 'matches'>('date');
  const [hotSheetsCount, setHotSheetsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [firstName, setFirstName] = useState<string>("");
  const motivationalQuotes = ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Your only limit is you. Push yourself to new heights today!", "Great things never come from comfort zones.", "The secret of getting ahead is getting started.", "Don't watch the clock; do what it does. Keep going.", "Every listing is an opportunity, every client is a relationship.", "Dream big, work hard, stay focused, and surround yourself with good people.", "The harder you work for something, the greater you'll feel when you achieve it.", "Success doesn't just find you. You have to go out and get it.", "Believe you can and you're halfway there.", "Your clients don't buy houses, they buy the future you help them envision.", "Excellence is not a skill, it's an attitude.", "The best time to plant a tree was 20 years ago. The second best time is now.", "Small daily improvements lead to stunning results.", "Make today so awesome that yesterday gets jealous."];
  const getDailyQuote = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return motivationalQuotes[dayOfYear % motivationalQuotes.length];
  };
  useEffect(() => {
    document.title = "Agent Dashboard - All Agent Connect";
  }, []);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
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
      // Load user profile from agent_profiles
      const {
        data: profileData
      } = await supabase.from("agent_profiles").select("first_name").eq("id", userId).single();
      if (profileData?.first_name) {
        setFirstName(profileData.first_name);
      }

      // Load listings with stats
      const {
        data,
        error
      } = await supabase.from("listings").select(`
          *,
          listing_stats (
            view_count,
            save_count,
            contact_count,
            showing_request_count
          )
        `).eq("agent_id", userId).order("created_at", {
        ascending: false
      });
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
      const {
        count: hotSheetsCount
      } = await supabase.from("hot_sheets").select("*", {
        count: "exact",
        head: true
      }).eq("user_id", userId);
      if (hotSheetsCount) setHotSheetsCount(hotSheetsCount);

      // Load favorites count
      const {
        count: favoritesCount
      } = await supabase.from("favorites").select("*", {
        count: "exact",
        head: true
      }).eq("user_id", userId);
      if (favoritesCount) setFavoritesCount(favoritesCount);

      // Load clients count
      const {
        count: clientsCount
      } = await supabase.from("clients").select("*", {
        count: "exact",
        head: true
      }).eq("agent_id", userId);
      if (clientsCount) setClientsCount(clientsCount);

      // Load messages count
      const {
        count: messagesCount
      } = await supabase.from("agent_messages").select("*", {
        count: "exact",
        head: true
      }).eq("agent_id", userId);
      if (messagesCount) setMessagesCount(messagesCount);

      // Load recent activity
      const activity: any[] = [];

      // Recent listings (last 5)
      const {
        data: recentListings
      } = await supabase.from("listings").select("id, address, city, state, created_at, status").eq("agent_id", userId).order("created_at", {
        ascending: false
      }).limit(5);
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
      const {
        data: recentMessages
      } = await supabase.from("agent_messages").select("id, sender_name, message, created_at, listing_id").eq("agent_id", userId).order("created_at", {
        ascending: false
      }).limit(5);
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
      const {
        data: recentClients
      } = await supabase.from("clients").select("id, first_name, last_name, created_at, email").eq("agent_id", userId).order("created_at", {
        ascending: false
      }).limit(5);
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
  const filterListings = (listingsToFilter: Listing[]) => {
    if (statusFilters.length === 0) return listingsToFilter;
    return listingsToFilter.filter(listing => statusFilters.includes(listing.status));
  };
  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };
  const handleCancelClick = (listingId: string) => {
    setListingToCancel(listingId);
    setCancelDialogOpen(true);
  };
  const handleCancelConfirm = async () => {
    if (!listingToCancel) return;
    try {
      const {
        error
      } = await supabase.from("listings").update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      }).eq("id", listingToCancel);
      if (error) throw error;

      // Update the local listings state
      setListings(listings.map(l => l.id === listingToCancel ? {
        ...l,
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      } : l));
      toast.success("Listing cancelled successfully");
    } catch (error: any) {
      toast.error("Error cancelling listing: " + error.message);
    } finally {
      setCancelDialogOpen(false);
      setListingToCancel(null);
    }
  };
  const handleReactivate = async (listingId: string) => {
    try {
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return;

      // Check if 30 days have passed since cancellation
      const daysSinceCancellation = listing.cancelled_at ? Math.floor((Date.now() - new Date(listing.cancelled_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Determine if we should reset cumulative_active_days
      const shouldResetDays = daysSinceCancellation > 30;
      const updates: any = {
        status: 'active',
        active_date: new Date().toISOString(),
        cancelled_at: null
      };

      // If more than 30 days have passed, reset cumulative days
      if (shouldResetDays) {
        // Also need to update listing_stats
        const {
          error: statsError
        } = await supabase.from("listing_stats").update({
          cumulative_active_days: 0
        }).eq("listing_id", listingId);
        if (statsError) {
          console.error("Error resetting stats:", statsError);
        }
      }
      const {
        error
      } = await supabase.from("listings").update(updates).eq("id", listingId);
      if (error) throw error;

      // Reload listings to get updated data
      const {
        data: updatedListings
      } = await supabase.from("listings").select(`
          *,
          listing_stats (
            view_count,
            save_count,
            contact_count,
            showing_request_count,
            cumulative_active_days
          )
        `).eq("agent_id", user?.id).order("created_at", {
        ascending: false
      });
      if (updatedListings) {
        const processedListings = updatedListings.map(listing => ({
          ...listing,
          listing_stats: Array.isArray(listing.listing_stats) ? listing.listing_stats[0] : listing.listing_stats
        }));
        setListings(processedListings);
      }
      toast.success(shouldResetDays ? "Listing reactivated with reset days on market (30+ days since cancellation)" : "Listing reactivated with preserved days on market");
    } catch (error: any) {
      toast.error("Error reactivating listing: " + error.message);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  const scrollToListings = () => {
    setShowResults(true);
    setTimeout(() => {
      const listingsSection = document.getElementById('listings-section');
      if (listingsSection) {
        listingsSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>;
  }
  const listingTypes = [{
    title: "For Sale",
    description: "Add a new listing for sale.",
    image: forSaleImg,
    action: () => navigate("/add-listing?type=sale")
  }, {
    title: "For Off Market Sale",
    description: "Add a new off market listing for sale.",
    image: privateSaleImg,
    action: () => navigate("/add-listing?type=private")
  }, {
    title: "For Rent",
    description: "Add a new listing for rent.",
    image: forRentImg,
    action: () => navigate("/add-listing?type=rent")
  }];
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
  return <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Hey {firstName || "Agent"}!
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Welcome to your success hub – let's make today amazing
            </p>
            <div className="mt-3 p-3 bg-primary/5 border-l-4 border-primary rounded-r-lg">
              <p className="text-sm italic text-foreground/80">
                "{getDailyQuote()}"
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Dashboard Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-primary bg-gradient-to-br from-card to-card/50" onClick={scrollToListings}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Listings</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Home className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{listings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
                  {listings.filter(l => l.status === 'active').length} active
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/hot-sheets")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Hot Sheets</CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">{hotSheetsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Active searches</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-red-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/favorites")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Favorites</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">{favoritesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Saved properties</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/my-clients")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Contacts</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{clientsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Total clients</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-purple-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/coming-soon")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Communications</CardTitle>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-500 bg-clip-text text-transparent">{messagesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Total messages</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-emerald-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/agent-profile-editor")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Profile</CardTitle>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage your profile information</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-indigo-500 bg-gradient-to-br from-card to-card/50" onClick={() => navigate("/manage-team")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Team</CardTitle>
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage team members</p>
            </CardContent>
          </Card>

          {/* Recent Activity Feed - Full Width */}
          {recentActivity.length > 0 && <Card className="hover:shadow-lg transition-all hover:scale-105 border-l-4 border-l-slate-700 bg-gradient-to-br from-card to-card/50 lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Your latest listings, messages, and client interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentActivity.slice(0, 6).map((activity, index) => <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-background/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted flex-shrink-0">
                        {getActivityIcon(activity.icon)}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium line-clamp-1">{activity.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTimestamp(activity.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{activity.description}</p>
                        {activity.status && <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary capitalize">
                            {activity.status}
                          </span>}
                      </div>
                    </div>)}
                </div>
              </CardContent>
            </Card>}
        </div>

        {/* Listings Section */}
        {showResults && <div id="listings-section" className="mt-8 mb-12">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold">My Listings</h2>
              <p className="text-muted-foreground text-sm">
                Manage and track your property listings
              </p>
            </div>

            {/* Create New Listing Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {listingTypes.map((type, index) => <Card key={index} className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 overflow-hidden" onClick={type.action}>
                  <div className="relative h-32 overflow-hidden">
                    <img src={type.image} alt={type.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-3 text-white">
                      <h3 className="font-semibold text-lg">{type.title}</h3>
                    </div>
                  </div>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </CardContent>
                </Card>)}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['active', 'draft', 'coming_soon', 'new', 'back_on_market', 'expired', 'contingent', 'cancelled', 'under_agreement', 'temp_withdrawn', 'sold'].map(status => <Button key={status} variant={statusFilters.includes(status) ? 'default' : 'outline'} size="sm" onClick={() => toggleStatusFilter(status)} className="rounded-md capitalize text-xs h-7 px-2.5">
                  {status.replace(/_/g, ' ')}
                </Button>)}
            </div>

            {/* Sort and View Controls */}
            <div className="flex items-center justify-between mb-4">
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date Added</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex border rounded-lg overflow-hidden">
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-none">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="rounded-none">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Listings Display */}
            {listings.length === 0 ? <Card className="p-12">
                <div className="text-center">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by creating your first listing above
                  </p>
                </div>
              </Card> : <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 gap-4' : 'grid gap-4'}>
                {sortListings(filterListings(listings)).map(listing => <ListingCard key={listing.id} listing={listing} onReactivate={handleReactivate} viewMode={viewMode} />)}
              </div>}
          </div>}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this listing? The listing will be hidden but you can still search for cancelled listings later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default AgentDashboard;