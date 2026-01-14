import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

import ListingCard from "@/components/ListingCard";
import forSaleImg from "@/assets/listing-for-sale.jpg";
import privateSaleImg from "@/assets/listing-private-sale.jpg";
import forRentImg from "@/assets/listing-for-rent.jpg";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LayoutGrid, List, Home, Flame, Heart, Users, Mail, Activity, UserCircle, CheckCircle, Bell } from "lucide-react";
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
  const location = useLocation();
  const listingsSectionRef = useRef<HTMLDivElement>(null);
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
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
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
  
  // Scroll to listings section if hash is present
  useEffect(() => {
    if (location.hash === '#my-listings' && listingsSectionRef.current && !loading) {
      setTimeout(() => {
        const element = listingsSectionRef.current;
        if (element) {
          const offset = 80; // Account for fixed header
          const elementPosition = element.getBoundingClientRect().top + window.scrollY;
          const offsetPosition = elementPosition - offset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  }, [location.hash, listings, loading]);
  
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

  // Reload data when returning to dashboard
  useEffect(() => {
    if (user && location.state?.reload) {
      loadData(user.id);
      // Clear the state to prevent reload loops
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user]);

  const loadData = async (userId: string) => {
    try {
      // Load user profile from agent_profiles
      const {
        data: profileData
      } = await supabase.from("agent_profiles").select("first_name, headshot_url").eq("id", userId).single();
      if (profileData?.first_name) {
        setFirstName(profileData.first_name);
      }
      if (profileData?.headshot_url) {
        setProfilePicture(profileData.headshot_url);
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

      // Load team members
      const { data: teamData } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, headshot_url")
        .neq("id", userId)
        .limit(5);
      if (teamData) setTeamMembers(teamData);

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
  
  const handleDelete = (listingId: string) => {
    setListings(prevListings => prevListings.filter(l => l.id !== listingId));
  };
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  const scrollToListings = () => {
    setShowResults(true);
    setTimeout(() => {
      if (listingsSectionRef.current) {
        listingsSectionRef.current.scrollIntoView({
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
    description: "Add new or coming soon listing.",
    image: forSaleImg,
    action: () => navigate("/agent/listings/new?type=sale")
  }, {
    title: "For Off Market Sale",
    description: "Add a new off market listing for sale.",
    image: privateSaleImg,
    action: () => navigate("/agent/listings/new?type=private")
  }, {
    title: "For Rent",
    description: "Add a new listing for rent.",
    image: forRentImg,
    action: () => navigate("/agent/listings/new?type=rent")
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
  
  return (
    <div className="min-h-screen bg-white" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 sm:mb-12 animate-fade-in">
          <div className="space-y-3 sm:space-y-4 flex-1">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1D1D1F] tracking-tight">
                Hey {firstName || "Agent"}!
              </h1>
              <p className="text-[#6E6E73] text-base sm:text-lg lg:text-xl max-w-2xl">
                Welcome to your success hub – let's make it an amazing day
              </p>
              {/* DEBUG STAMP - remove after verification */}
              <span className="text-[10px] text-neutral-400 font-mono">BG:#F7F8FA / CARD:#FFF</span>
            </div>
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-[#FFFFFF] border-l-4 border-emerald-500 rounded-lg max-w-2xl border" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <p className="text-xs sm:text-sm italic text-foreground/90 leading-relaxed">
                "{getDailyQuote()}"
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Overview Cards */}
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 mb-10 sm:mb-16 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={scrollToListings}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Listings</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Home className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{listings.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">View and manage listings</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/hot-sheets")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Hot Sheets</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Flame className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{hotSheetsCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Active property searches</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/favorites")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Favorites</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Heart className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{favoritesCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Saved favorite properties</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/my-clients")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Contacts</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{clientsCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Manage client relationships</p>
            </CardContent>
          </Card>

          {/* Hidden until launch - Communications Center card */}
          {false && (
          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/client-needs")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Communications</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{messagesCount}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Client needs and requests</p>
            </CardContent>
          </Card>
          )}

          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/agent-profile-editor")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Profile</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 overflow-hidden flex-shrink-0">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              {(firstName || profilePicture) && (
                <div className="text-2xl font-bold text-muted-foreground mb-1">
                  <CheckCircle className="h-8 w-8" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Manage profile information</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/manage-team")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">My Team</CardTitle>
              <div className="flex -space-x-2 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                {[...teamMembers, ...Array(Math.max(0, 3 - teamMembers.length))].slice(0, 3).map((member, index) => (
                  <div key={member?.id || `empty-${index}`} className="h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center overflow-hidden">
                    {member?.headshot_url ? (
                      <img src={member.headshot_url} alt={member.first_name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="h-3 w-3 text-muted-foreground opacity-30" />
                    )}
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{teamMembers.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Collaborate with team</p>
            </CardContent>
          </Card>

          {/* Communication Center Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 cursor-pointer bg-[#FFFFFF] overflow-hidden relative touch-manipulation h-40" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} onClick={() => navigate("/client-needs")}>
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 sm:p-4 relative z-10">
              <CardTitle className="text-sm font-medium">Communication Center</CardTitle>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-3 sm:p-4 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-foreground">
                {messagesCount + clientsCount}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Messages and notifications</p>
            </CardContent>
          </Card>

          {/* Recent Activity Feed - Full Width */}
          {recentActivity.length > 0 && <Card className="group hover:shadow-xl transition-all duration-300 bg-[#FFFFFF] md:col-span-2 lg:col-span-3 overflow-hidden relative touch-manipulation" style={{ borderColor: '#D2D2D7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 relative z-10 p-3 sm:p-4 pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  <CardDescription className="text-xs">Latest updates and interactions</CardDescription>
                </div>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 p-3 sm:p-4 pt-2">
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {recentActivity.slice(0, 4).map((activity, index) => <div key={index} className="flex items-start gap-2 p-2 rounded-lg border bg-background/50 hover:bg-background/80 hover:shadow-md transition-all duration-200 touch-manipulation min-h-[80px]">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted flex-shrink-0 mt-0.5">
                        {getActivityIcon(activity.icon)}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-medium line-clamp-2">{activity.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{formatTimestamp(activity.timestamp)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{activity.description}</p>
                        {activity.status && <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-muted text-foreground capitalize mt-1">
                            {activity.status}
                          </span>}
                      </div>
                    </div>)}
                </div>
              </CardContent>
            </Card>}
        </div>

        {/* Listings Section */}
        {showResults && <div ref={listingsSectionRef} id="my-listings" className="mt-6 sm:mt-8 mb-10 sm:mb-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">My Listings</h2>
              <p className="text-muted-foreground text-sm sm:text-base mt-1 sm:mt-2">
                Manage and track your property listings
              </p>
            </div>

            {/* Create New Listing Cards */}
            <div className="grid gap-4 sm:gap-5 md:grid-cols-3 mb-8 sm:mb-10">
              {listingTypes.map((type, index) => <Card key={index} className="group cursor-pointer hover:shadow-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-1 overflow-hidden border-0 ring-1 ring-border hover:ring-primary/50 touch-manipulation" onClick={type.action}>
                  <div className="relative h-32 sm:h-40 overflow-hidden">
                    <img src={type.image} alt={type.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    
                    <div className="absolute bottom-2 sm:bottom-3 left-3 sm:left-4 text-white">
                      <h3 className="font-semibold text-lg sm:text-xl">{type.title}</h3>
                    </div>
                  </div>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </CardContent>
                </Card>)}
            </div>

            {/* Status Filter & Controls Section */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {['active', 'draft', 'coming_soon', 'new', 'back_on_market', 'expired', 'pending', 'cancelled', 'temp_withdrawn', 'sold'].map(status => <Button key={status} variant={statusFilters.includes(status) ? 'default' : 'outline'} size="sm" onClick={() => toggleStatusFilter(status)} className="rounded-lg capitalize text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-4 shadow-sm hover:shadow transition-all touch-manipulation">
                    {status.replace(/_/g, ' ')}
                  </Button>)}
              </div>

              {/* Sort and View Controls */}
              <div className="flex items-center justify-between bg-background p-2.5 sm:p-3 rounded-lg gap-2 border">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[140px] sm:w-[180px] shadow-sm text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date Added</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex border rounded-lg overflow-hidden shadow-sm bg-background">
                  <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-none h-9 w-10 sm:w-auto touch-manipulation">
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="rounded-none h-9 w-10 sm:w-auto touch-manipulation">
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Listings Display */}
            {listings.length === 0 ? <Card className="p-8 sm:p-12 lg:p-16 text-center shadow-sm">
                <div className="max-w-md mx-auto">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto rounded-full bg-muted flex items-center justify-center mb-4 sm:mb-6">
                    <Home className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">No listings yet</h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    Get started by creating your first listing above
                  </p>
                </div>
              </Card> : <div className={viewMode === 'grid' ? 'grid gap-4 sm:gap-5 md:grid-cols-2' : 'grid gap-4 sm:gap-6'}>
                {sortListings(filterListings(listings)).map(listing => <ListingCard key={listing.id} listing={listing} onReactivate={handleReactivate} onDelete={handleDelete} viewMode={viewMode} />)}
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
    </div>
  );
};
export default AgentDashboard;