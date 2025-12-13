import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Bed, Bath, Home, Edit, Trash2, Eye, Calendar, Users, Mail, Heart, Star, BarChart3, Sparkles, TrendingDown, RefreshCw, Maximize, ChevronLeft, ChevronRight, Phone, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ReverseProspectDialog } from "./ReverseProspectDialog";
import MarketInsightsDialog from "./MarketInsightsDialog";
import ContactAgentDialog from "./ContactAgentDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { buildDisplayAddress, propertyTypeToEnum } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/phoneFormat";
interface ListingCardProps {
  listing: {
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
    photos?: any;
    open_houses?: any;
    listing_type?: string | null;
    created_at?: string;
    active_date?: string | null;
    listing_number?: string | null;
    is_relisting?: boolean;
    original_listing_id?: string | null;
    condo_details?: any;
    cancelled_at?: string | null;
    listing_stats?: {
      view_count: number;
      save_count: number;
      contact_count: number;
      showing_request_count: number;
      cumulative_active_days: number;
    };
    neighborhood?: string | null;
    agent_id?: string;
  };
  onReactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  viewMode?: 'grid' | 'list' | 'compact';
  showActions?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  agentInfo?: {
    name: string;
    company?: string | null;
  } | null;
}
const ListingCard = ({
  listing,
  onReactivate,
  onDelete,
  viewMode = 'grid',
  showActions = true,
  onSelect,
  isSelected = false,
  agentInfo = null
}: ListingCardProps) => {
  const navigate = useNavigate();
  const [matchCount, setMatchCount] = useState<number>(0);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [prospectDialogOpen, setProspectDialogOpen] = useState(false);
  const [marketInsightsOpen, setMarketInsightsOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [quickOpenHouseDialogOpen, setQuickOpenHouseDialogOpen] = useState(false);
  const [quickOHType, setQuickOHType] = useState<'public' | 'broker'>('public');
  const [quickOHDate, setQuickOHDate] = useState('');
  const [quickOHStartTime, setQuickOHStartTime] = useState('');
  const [quickOHEndTime, setQuickOHEndTime] = useState('');
  const [quickOHNotes, setQuickOHNotes] = useState('');
  const [agentProfile, setAgentProfile] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    headshot_url?: string | null;
    company?: string | null;
  } | null>(null);

  useEffect(() => {
    loadMatchCount();
    loadStatusHistory();
    loadPriceHistory();
  }, [listing.id]);

  // Fetch agent profile for grid view
  useEffect(() => {
    const fetchAgentProfile = async () => {
      if (!listing.agent_id || viewMode !== 'grid') return;
      
      try {
        const { data, error } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email, phone, headshot_url, company")
          .eq("id", listing.agent_id)
          .single();
        
        if (!error && data) {
          setAgentProfile(data);
        }
      } catch (error) {
        console.error("Error fetching agent profile:", error);
      }
    };

    fetchAgentProfile();
  }, [listing.agent_id, viewMode]);
  const loadStatusHistory = async () => {
    try {
      const {
        data
      } = await supabase.from("listing_status_history").select("*").eq("listing_id", listing.id).order("changed_at", {
        ascending: false
      }).limit(5);
      if (data) {
        setStatusHistory(data);
      }
    } catch (error) {
      console.error("Error loading status history:", error);
    }
  };

  const loadPriceHistory = async () => {
    try {
      // Check if there are any favorites for this listing with price history
      const { data } = await supabase
        .from("favorite_price_history")
        .select("*")
        .eq("listing_id", listing.id)
        .order("changed_at", { ascending: false })
        .limit(1);
      
      if (data) {
        setPriceHistory(data);
      }
    } catch (error) {
      console.error("Error loading price history:", error);
    }
  };
  const loadMatchCount = async () => {
    try {
      setLoadingMatches(true);
      
      // Fetch all active hot sheets
      const { data: hotSheets, error } = await supabase
        .from("hot_sheets")
        .select("id, criteria")
        .eq("is_active", true);

      if (error) throw error;
      
      if (!hotSheets || hotSheets.length === 0) {
        setMatchCount(0);
        return;
      }

      // Filter hot sheets using JavaScript matching logic
      const matchingSheets = hotSheets.filter((sheet) => {
        const criteria = sheet.criteria as any;
        if (!criteria) return false;

        // Price matching: listing price must fall within hot sheet min/max range
        if (criteria.min_price && listing.price < criteria.min_price) return false;
        if (criteria.max_price && listing.price > criteria.max_price) return false;

        // Bedrooms: listing must have >= hot sheet minimum (if specified)
        if (criteria.bedrooms !== null && criteria.bedrooms !== undefined) {
          if (listing.bedrooms === null || listing.bedrooms < criteria.bedrooms) return false;
        }

        // Bathrooms: listing must have >= hot sheet minimum (if specified)
        if (criteria.bathrooms !== null && criteria.bathrooms !== undefined) {
          if (listing.bathrooms === null || listing.bathrooms < criteria.bathrooms) return false;
        }

        // City matching: only if specified in hot sheet criteria
        if (criteria.city && criteria.city.trim() !== "") {
          if (!listing.city || listing.city.toLowerCase() !== criteria.city.toLowerCase()) return false;
        }

        // State matching: only if specified in hot sheet criteria
        if (criteria.state && criteria.state.trim() !== "") {
          if (!listing.state || listing.state.toLowerCase() !== criteria.state.toLowerCase()) return false;
        }

        // Property type matching: if specified in hot sheet
        if (criteria.property_type && criteria.property_type.trim() !== "") {
          const listingType = propertyTypeToEnum(listing.property_type || "");
          if (!listingType || listingType !== criteria.property_type) return false;
        }

        // Listing type matching: if specified (for_sale vs for_rent)
        if (criteria.listing_type && criteria.listing_type.trim() !== "") {
          if (!listing.listing_type || listing.listing_type !== criteria.listing_type) return false;
        }

        return true;
      });

      setMatchCount(matchingSheets.length);
    } catch (error) {
      console.error("Error loading match count:", error);
    } finally {
      setLoadingMatches(false);
    }
  };
  
  const handleQuickAddOpenHouse = async () => {
    if (!quickOHDate || !quickOHStartTime || !quickOHEndTime) {
      toast.error("Please fill in date and time");
      return;
    }
    
    try {
      const newOpenHouse = {
        type: quickOHType,
        date: quickOHDate,
        start_time: quickOHStartTime,
        end_time: quickOHEndTime,
        notes: quickOHNotes
      };
      
      const currentOpenHouses = listing.open_houses || [];
      const updatedOpenHouses = [...currentOpenHouses, newOpenHouse];
      
      const { error } = await supabase
        .from('listings')
        .update({ open_houses: updatedOpenHouses })
        .eq('id', listing.id);
      
      if (error) throw error;
      
      setQuickOHDate('');
      setQuickOHStartTime('');
      setQuickOHEndTime('');
      setQuickOHNotes('');
      setQuickOpenHouseDialogOpen(false);
      
      toast.success("Open house added successfully!");
      window.location.reload();
    } catch (error) {
      console.error('Error adding open house:', error);
      toast.error('Failed to add open house');
    }
  };

  const handleDelete = async () => {
    console.log("Delete clicked for listing:", {
      id: listing.id,
      status: listing.status,
      address: listing.address,
      agent_id: listing.agent_id
    });
    
    setDeleting(true);
    try {
      // Use backend function that handles cascading deletes and RLS
      const { data, error } = await supabase.rpc('delete_draft_listing', {
        p_listing_id: listing.id,
      });
      
      if (error) {
        console.error("RPC error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log("Draft deleted successfully:", listing.id);
      toast.success("Draft listing deleted successfully");
      onDelete?.(listing.id);
    } catch (error: any) {
      console.error("Error deleting draft listing:", error);
      // Show the specific error message from the backend
      toast.error(error?.message || "Failed to delete draft listing");
    } finally {
      setDeleting(false);
    }
  };
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(price);
  };
  const getPhotoByIndex = (index: number) => {
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      const photo = listing.photos[index];
      if (!photo) return null;

      // If it's a string, assume it's already a URL
      if (typeof photo === 'string') {
        return photo;
      }

      // If it's an object with a url property
      if (photo.url) {
        // Check if it's a full URL or a storage path
        if (photo.url.startsWith('http')) {
          return photo.url;
        }
        // If it's a storage path, construct the public URL
        const {
          data
        } = supabase.storage.from('listing-photos').getPublicUrl(photo.url);
        return data.publicUrl;
      }
    }
    return null;
  };
  
  const getFirstPhoto = () => {
    return getPhotoByIndex(0);
  };
  
  const getTotalPhotos = () => {
    return listing.photos && Array.isArray(listing.photos) ? listing.photos.length : 0;
  };
  
  const handlePreviousPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : getTotalPhotos() - 1);
  };
  
  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => prev < getTotalPhotos() - 1 ? prev + 1 : 0);
  };
  // Helper to format 24-hour time to 12-hour AM/PM
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const hasUpcomingOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return false;
    const now = new Date();
    return listing.open_houses.some((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}:00`);
      return ohEndDateTime > now;
    });
  };
  const getNextOpenHouse = () => {
    if (!listing.open_houses || !Array.isArray(listing.open_houses)) return null;
    const now = new Date();
    const upcoming = listing.open_houses.filter((oh: any) => {
      const ohEndDateTime = new Date(`${oh.date}T${oh.end_time}:00`);
      return ohEndDateTime > now;
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  };
  const getStatusChangeBanner = () => {
    // Check current listing status directly (not just from history)
    const currentStatus = listing.status;

    // Check for Coming Soon status
    if (currentStatus === 'coming_soon') {
      return {
        text: "COMING SOON",
        color: "bg-indigo-600",
        iconType: "sparkles" as const
      };
    }

    // Check if listing is "new" status OR recently became active (not a relisting)
    // Show NEW LISTING banner for: status='new' OR status='active' within 7 days
    const isNewStatus = currentStatus === 'new';
    const isActiveStatus = currentStatus === 'active';
    
    if ((isNewStatus || isActiveStatus) && !listing.is_relisting) {
      // For 'new' status, always show the banner
      if (isNewStatus) {
        return {
          text: "NEW LISTING",
          color: "bg-blue-600",
          iconType: "sparkles" as const
        };
      }
      
      // For 'active' status, check if it became active recently (within 7 days)
      if (isActiveStatus && statusHistory.length > 0) {
        const allActiveStatuses = statusHistory.filter(h => h.new_status === 'active');
        if (allActiveStatuses.length >= 1) {
          const mostRecentActiveDate = new Date(allActiveStatuses[0].changed_at);
          const daysSinceActive = Math.ceil((Date.now() - mostRecentActiveDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceActive <= 7) {
            return {
              text: "NEW LISTING",
              color: "bg-blue-600",
              iconType: "sparkles" as const
            };
          }
        }
      }
    }

    // Check if back on market (was pending, under_contract, withdrawn, or cancelled and now active again)
    // This applies when status changes within the same listing (not creating a new listing)
    if (statusHistory.length >= 2 && isActiveStatus) {
      const previousStatus = statusHistory[1]?.new_status;
      const changeDate = new Date(statusHistory[0].changed_at);
      const daysSinceChange = Math.ceil((Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

      // List of statuses that when followed by active should show "BACK ON MARKET"
      const offMarketStatuses = ['pending', 'under_contract', 'withdrawn', 'cancelled', 'temporarily_withdrawn'];
      if (offMarketStatuses.includes(previousStatus) && daysSinceChange <= 14) {
        return {
          text: "BACK ON MARKET",
          color: "bg-orange-600",
          iconType: "refresh" as const
        };
      }
    }
    return null;
  };

  const getPriceChangeBanner = () => {
    if (priceHistory.length === 0) return null;
    
    const recentPriceChange = priceHistory[0];
    const changeDate = new Date(recentPriceChange.changed_at);
    const daysSinceChange = Math.ceil((Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Show price change banner for 14 days
    if (daysSinceChange <= 14) {
      const priceDirection = recentPriceChange.new_price < recentPriceChange.old_price ? 'reduced' : 'increased';
      return {
        text: priceDirection === 'reduced' ? "PRICE REDUCED" : "PRICE CHANGE",
        color: priceDirection === 'reduced' ? "bg-red-600" : "bg-amber-600",
        iconType: "trendingDown" as const
      };
    }
    
    return null;
  };
  const getOpenHouseBanner = () => {
    const nextOH = getNextOpenHouse();
    if (!nextOH) return null;
    const isBrokerOnly = nextOH.event_type === 'broker_tour';
    return {
      text: isBrokerOnly ? "BROKER OPEN HOUSE" : "OPEN HOUSE",
      date: format(new Date(nextOH.date), "MMM d"),
      time: `${formatTime(nextOH.start_time)} - ${formatTime(nextOH.end_time)}`,
      color: isBrokerOnly ? "bg-purple-600" : "bg-green-600",
      isBroker: isBrokerOnly
    };
  };
  const photoUrl = getFirstPhoto();
  const nextOpenHouse = getNextOpenHouse();
  const statusBanner = getStatusChangeBanner();
  const priceChangeBanner = getPriceChangeBanner();
  const openHouseBanner = getOpenHouseBanner();

  // Color coding for match count
  const getMatchButtonStyle = () => {
    if (matchCount === 0) {
      return {
        variant: "outline" as const,
        className: "border-muted-foreground/20 text-muted-foreground hover:bg-muted"
      };
    } else if (matchCount >= 10) {
      // High demand - green
      return {
        variant: "default" as const,
        className: "bg-green-600 hover:bg-green-700 text-white border-green-600"
      };
    } else if (matchCount >= 5) {
      // Medium demand - yellow/amber
      return {
        variant: "default" as const,
        className: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
      };
    } else {
      // Low demand - blue/default
      return {
        variant: "outline" as const,
        className: "border-primary/50 text-primary hover:bg-primary/10"
      };
    }
  };
  const matchButtonStyle = getMatchButtonStyle();
  const getUnitNumber = () => {
    if (!listing.condo_details) return null;
    try {
      const details = typeof listing.condo_details === 'string' ? JSON.parse(listing.condo_details) : listing.condo_details;
      return details?.unit_number || null;
    } catch {
      return null;
    }
  };
  const unitNumber = getUnitNumber();
  const calculateDaysOnMarket = () => {
    // Use active_date (MLS date) if available, otherwise fall back to created_at
    const marketDate = listing.active_date || listing.created_at;
    if (!marketDate) return 0;
    const activeDate = new Date(marketDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - activeDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const daysOnMarket = calculateDaysOnMarket();

  // Use shared display address helper
  const displayAddress = buildDisplayAddress(listing);

  // Compact view (for HotSheets and search results)
  if (viewMode === 'compact') {
    const currentPhoto = getPhotoByIndex(currentPhotoIndex);
    const totalPhotos = getTotalPhotos();
    const hasMultiplePhotos = totalPhotos > 1;
    
    return <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="relative group">
          {onSelect && <div className="absolute top-2 left-2 z-10">
              <div onClick={e => {
            e.stopPropagation();
            onSelect(listing.id);
          }} className={`w-7 h-7 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center shadow-md ${isSelected ? 'bg-primary border-primary' : 'bg-background/90 border-border hover:border-primary backdrop-blur-sm'}`}>
                {isSelected && <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>}
              </div>
            </div>}
          {(listing.neighborhood || (listing as any).attom_data?.neighborhood) && <div className="absolute bottom-2 right-2 z-10">
              <span className="inline-flex items-center rounded-full bg-background/90 text-foreground px-3 py-1.5 text-sm font-medium shadow-md backdrop-blur-sm">
                {listing.neighborhood || (listing as any).attom_data?.neighborhood}
              </span>
            </div>}
          
          {/* Photo navigation arrows */}
          {hasMultiplePhotos && (
            <>
              <button
                onClick={handlePreviousPhoto}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur-sm p-1 rounded-full shadow-lg transition-all hover:bg-background hover:scale-110"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={handleNextPhoto}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 bg-background/95 backdrop-blur-sm p-1 rounded-full shadow-lg transition-all hover:bg-background hover:scale-110"
                aria-label="Next photo"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </>
          )}
          
          {currentPhoto ? <img src={currentPhoto} alt={listing.address || `${listing.city}, ${listing.state} ${listing.zip_code}`} className="w-full h-48 object-cover cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)} /> : <div className="w-full h-48 bg-muted flex items-center justify-center">
              <Home className="h-12 w-12 text-muted-foreground" />
            </div>}
          
          {/* Status Change Banner (top priority) */}
          {statusBanner && <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              {statusBanner.iconType === 'sparkles' ? <Sparkles className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
              {statusBanner.text}
            </div>}
          
          {/* Price Change Banner (second priority) */}
          {priceChangeBanner && !statusBanner && <div className={`absolute top-0 left-0 right-0 ${priceChangeBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
              <TrendingDown className="w-3 h-3" />
              {priceChangeBanner.text}
            </div>}
          
          {/* Open House Banner (third priority) */}
          {openHouseBanner && !statusBanner && !priceChangeBanner && <div className={`absolute top-0 left-0 right-0 ${openHouseBanner.color} text-white text-xs font-bold px-2 py-1 text-center`}>
              {openHouseBanner.isBroker ? '🏢' : '🎈'} {openHouseBanner.text}
            </div>}
        </div>
        <CardContent className="p-2.5">
          <div className="flex items-start justify-between mb-1.5">
            <p onClick={() => navigate(`/property/${listing.id}`)} className="font-bold text-primary cursor-pointer text-lg">
              ${listing.price.toLocaleString()}
            </p>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                ID# {listing.listing_number}
              </p>
              <p className="text-xs text-muted-foreground">
                DOM {daysOnMarket} {daysOnMarket === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 mb-1.5 cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="font-medium text-sm">
              {displayAddress}
            </p>
          </div>
          
          {listing.property_type && <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{listing.property_type}</p>
            </div>}
          
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-6 text-lg">
              {listing.bedrooms && <div className="flex items-center gap-1.5">
                  <Bed className="h-5 w-5 text-primary" />
                  <span className="text-foreground font-semibold">{listing.bedrooms}</span>
                </div>}
              {listing.bathrooms && <div className="flex items-center gap-1.5">
                  <Bath className="h-5 w-5 text-primary" />
                  <span className="text-foreground font-semibold">{listing.bathrooms}</span>
                </div>}
              {listing.square_feet && <div className="flex items-center gap-1.5">
                  <Maximize className="h-5 w-5 text-primary" />
                  <span className="text-foreground font-semibold">{listing.square_feet.toLocaleString()}</span>
                </div>}
            </div>
            
            {agentInfo && <div className="text-xs text-right">
                <span className="text-foreground font-medium">{agentInfo.name}</span>
                {agentInfo.company && <span className="text-muted-foreground"> • {agentInfo.company}</span>}
              </div>}
          </div>
          
          {/* Open House Info */}
          {nextOpenHouse && (
            <div className={`flex items-center gap-2 text-sm p-2 rounded-md mt-2 ${nextOpenHouse.event_type === 'broker_tour' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'}`}>
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {nextOpenHouse.event_type === 'broker_tour' ? 'Broker Tour' : 'Open House'}: {format(new Date(nextOpenHouse.date), "MMM d")} • {formatTime(nextOpenHouse.start_time)} - {formatTime(nextOpenHouse.end_time)}
              </span>
            </div>
          )}
          
          {showActions && (listing.status === 'active' || listing.status === 'coming_soon') && (
            <div className="pt-2 border-t mt-2 space-y-2">
              <Button size="sm" variant={matchButtonStyle.variant} className={`w-full ${matchButtonStyle.className}`} onClick={() => setProspectDialogOpen(true)} disabled={loadingMatches}>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {loadingMatches ? "..." : `${matchCount} Match${matchCount !== 1 ? "es" : ""}`}
              </Button>
              <div className="flex items-center gap-2 w-full">
                <span className="text-2xl animate-pulse">🎈</span>
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
                  e.stopPropagation();
                  setQuickOpenHouseDialogOpen(true);
                }}>
                  Schedule Open House
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <Dialog open={quickOpenHouseDialogOpen} onOpenChange={setQuickOpenHouseDialogOpen}>
          <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Open House</DialogTitle>
                <DialogDescription>
                  Add an open house for {listing.address}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={quickOHType === 'public' ? 'default' : 'outline'}
                      onClick={() => setQuickOHType('public')}
                      className="flex-1"
                    >
                      Public Open House
                    </Button>
                    <Button
                      type="button"
                      variant={quickOHType === 'broker' ? 'default' : 'outline'}
                      onClick={() => setQuickOHType('broker')}
                      className="flex-1"
                    >
                      Broker Open House
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-oh-date">Date</Label>
                  <Input
                    id="quick-oh-date"
                    type="date"
                    value={quickOHDate}
                    onChange={(e) => setQuickOHDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick-oh-start">Start Time</Label>
                    <Input
                      id="quick-oh-start"
                      type="time"
                      value={quickOHStartTime}
                      onChange={(e) => setQuickOHStartTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quick-oh-end">End Time</Label>
                    <Input
                      id="quick-oh-end"
                      type="time"
                      value={quickOHEndTime}
                      onChange={(e) => setQuickOHEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-oh-notes">Notes (optional)</Label>
                  <Textarea
                    id="quick-oh-notes"
                    value={quickOHNotes}
                    onChange={(e) => setQuickOHNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickOpenHouseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQuickAddOpenHouse}>
                  Add Open House
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>;
  }
  if (viewMode === 'list') {
    return <Card className="overflow-hidden hover:shadow-md transition-shadow border-l-4 border-l-primary">
        <div className="flex gap-3 p-3">
          {/* Photo with Banners */}
          <div className="relative w-40 h-40 flex-shrink-0">
            {photoUrl ? <img src={photoUrl} alt={listing.address} className="w-full h-full object-cover rounded" /> : <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                <Home className="w-8 h-8 text-muted-foreground" />
              </div>}
            
            {/* Status Change Banner (top priority) */}
            {statusBanner && <div className={`absolute top-0 left-0 right-0 ${statusBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
                {statusBanner.iconType === 'sparkles' ? <Sparkles className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                {statusBanner.text}
              </div>}
            
            {/* Price Change Banner (second priority) */}
            {priceChangeBanner && !statusBanner && <div className={`absolute top-0 left-0 right-0 ${priceChangeBanner.color} text-white text-xs font-bold px-2 py-1 text-center flex items-center justify-center gap-1`}>
                <TrendingDown className="w-3 h-3" />
                {priceChangeBanner.text}
              </div>}
            
            {/* Open House Banner (third priority) */}
            {openHouseBanner && <div className={`absolute ${statusBanner && priceChangeBanner ? 'top-6' : statusBanner || priceChangeBanner ? 'top-5' : 'top-0'} left-0 right-0 ${openHouseBanner.color} text-white text-xs font-bold px-2 py-1 text-center`}>
                {openHouseBanner.isBroker ? '🏢' : '🎈'} {openHouseBanner.date} • {openHouseBanner.time}
              </div>}
            
            {/* Photo count badge */}
            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
              {listing.photos?.length || 0} Photos
            </div>
          </div>

          {/* Listing Info */}
          <div className="flex-1 grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <h3 className="font-semibold text-sm mb-1">
                {listing.address}
                {unitNumber && <Badge variant="secondary" className="ml-2 text-xs">
                    Unit {unitNumber}
                  </Badge>}
              </h3>
              <div className="flex items-center text-muted-foreground text-xs mb-2">
                <MapPin className="w-3 h-3 mr-1" />
                {listing.city}, {listing.state} {listing.zip_code}
                {(listing.neighborhood || (listing as any).attom_data?.neighborhood) && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {listing.neighborhood || (listing as any).attom_data?.neighborhood}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                {listing.listing_number && <span>Listing #{listing.listing_number}</span>}
                {listing.is_relisting && <>
                    {listing.listing_number && <span>•</span>}
                    <Badge variant="secondary" className="text-xs">
                      Relisted
                    </Badge>
                  </>}
                {listing.listing_number && daysOnMarket > 0 && <span>•</span>}
                {daysOnMarket > 0 && <Badge variant="outline" className="text-xs">
                    {daysOnMarket} {daysOnMarket === 1 ? 'day' : 'days'} on market
                  </Badge>}
                {listing.listing_stats?.cumulative_active_days && listing.listing_stats.cumulative_active_days > daysOnMarket && <>
                    <span>•</span>
                    <Badge variant="secondary" className="text-xs">
                      {listing.listing_stats.cumulative_active_days} total active
                    </Badge>
                  </>}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                {listing.bedrooms && <span><Bed className="w-3 h-3 inline mr-0.5" />{listing.bedrooms}</span>}
                {listing.bathrooms && <span><Bath className="w-3 h-3 inline mr-0.5" />{listing.bathrooms}</span>}
                {listing.square_feet && <span><Home className="w-3 h-3 inline mr-0.5" />{listing.square_feet.toLocaleString()} sqft</span>}
              </div>
              
              {/* Open House Info */}
              {nextOpenHouse && (
                <div className={`flex items-center gap-1.5 text-xs p-2 rounded-md mb-2 ${nextOpenHouse.type === 'broker' ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800' : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'}`}>
                  <Calendar className={`h-4 w-4 ${nextOpenHouse.type === 'broker' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`} />
                  <div className="flex-1">
                    <div className={`font-semibold ${nextOpenHouse.type === 'broker' ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300'}`}>
                      {nextOpenHouse.type === 'broker' ? 'Broker Tour' : 'Open House'}
                    </div>
                    <div className={`${nextOpenHouse.type === 'broker' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`}>
                      {format(new Date(nextOpenHouse.date), "EEE, MMM d")} • {nextOpenHouse.start_time} - {nextOpenHouse.end_time}
                    </div>
                  </div>
                </div>
              )}
              
              {(listing.status === 'active' || listing.status === 'coming_soon') && matchCount > 0 && (
                <Button 
                  size="sm" 
                  variant={matchButtonStyle.variant} 
                  onClick={() => setProspectDialogOpen(true)} 
                  disabled={loadingMatches} 
                  className={`text-xs ${matchButtonStyle.className}`}
                >
                  <Users className="w-3 h-3 mr-1" />
                  {loadingMatches ? "Loading..." : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`}
                </Button>
              )}
            </div>

            <div className="col-span-2">
              <Badge variant={listing.status === "active" ? "default" : "secondary"} className="mb-1 text-xs">
                {listing.status}
              </Badge>
              {listing.property_type && <div className="text-xs text-muted-foreground">{listing.property_type}</div>}
            </div>

            <div className="col-span-2 text-right">
              <div className="text-base font-bold text-primary mb-0.5">
                {formatPrice(listing.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                {listing.listing_type === 'for_rent' ? 'Rental' : 'Sale'}
              </div>
              {listing.created_at && <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(listing.created_at), "MM/dd/yy")}
                </div>}
            </div>

            <div className="col-span-2 flex flex-col gap-1 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate(`/agent/listings/edit/${listing.id}`)} className="w-full">
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
              sessionStorage.setItem('fromAgentDashboard', 'true');
              navigate(`/property/${listing.id}?from=my-listings`, {
                state: {
                  fromAgentDashboard: true
                }
              });
            }} className="w-full">
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/analytics/${listing.id}`)} className="w-full">
                <BarChart3 className="w-3 h-3 mr-1" />
                Stats
              </Button>
              {listing.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()} className="w-full">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Draft Listing</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this draft listing? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <div className="flex items-center gap-2 w-full">
                <span className="text-2xl animate-pulse">🎈</span>
                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
                  e.stopPropagation();
                  setQuickOpenHouseDialogOpen(true);
                }}>
                  Schedule OH
                </Button>
              </div>
              {listing.status === 'cancelled' && onReactivate && <Button variant="default" size="sm" onClick={() => onReactivate(listing.id)} className="w-full bg-green-600 hover:bg-green-700">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reactivate
                </Button>}
            </div>
          </div>
        </div>
        {openHouseBanner && <div className={`${openHouseBanner.isBroker ? 'bg-purple-50 border-t border-purple-200' : 'bg-green-50 border-t border-green-200'} px-3 py-1.5 text-xs`}>
            <Calendar className={`w-4 h-4 inline mr-2 ${openHouseBanner.isBroker ? 'text-purple-600' : 'text-green-600'}`} />
            <span className={`font-semibold ${openHouseBanner.isBroker ? 'text-purple-700' : 'text-green-700'}`}>
              {openHouseBanner.isBroker ? 'Broker Open House:' : 'Open House:'}
            </span>{" "}
            {format(new Date(nextOpenHouse.date), "EEEE, MMMM d, yyyy")} • {openHouseBanner.time}
          </div>}
        <ReverseProspectDialog open={prospectDialogOpen} onOpenChange={setProspectDialogOpen} listing={listing} matchCount={matchCount} />
        <MarketInsightsDialog open={marketInsightsOpen} onOpenChange={setMarketInsightsOpen} listing={{
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        price: listing.price,
        property_type: listing.property_type
      }} />
      <ReverseProspectDialog open={prospectDialogOpen} onOpenChange={setProspectDialogOpen} listing={listing} matchCount={matchCount} />
      <MarketInsightsDialog open={marketInsightsOpen} onOpenChange={setMarketInsightsOpen} listing={{
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code,
      price: listing.price,
      property_type: listing.property_type
    }} />
      <Dialog open={quickOpenHouseDialogOpen} onOpenChange={setQuickOpenHouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Open House</DialogTitle>
            <DialogDescription>
              Add an open house for {listing.address}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={quickOHType === 'public' ? 'default' : 'outline'}
                  onClick={() => setQuickOHType('public')}
                  className="flex-1"
                >
                  Public Open House
                </Button>
                <Button
                  type="button"
                  variant={quickOHType === 'broker' ? 'default' : 'outline'}
                  onClick={() => setQuickOHType('broker')}
                  className="flex-1"
                >
                  Broker Open House
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-oh-date">Date</Label>
              <Input
                id="quick-oh-date"
                type="date"
                value={quickOHDate}
                onChange={(e) => setQuickOHDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quick-oh-start">Start Time</Label>
                <Input
                  id="quick-oh-start"
                  type="time"
                  value={quickOHStartTime}
                  onChange={(e) => setQuickOHStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-oh-end">End Time</Label>
                <Input
                  id="quick-oh-end"
                  type="time"
                  value={quickOHEndTime}
                  onChange={(e) => setQuickOHEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-oh-notes">Notes (optional)</Label>
              <Textarea
                id="quick-oh-notes"
                value={quickOHNotes}
                onChange={(e) => setQuickOHNotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpenHouseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAddOpenHouse}>
              Add Open House
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>;
  }

  // Grid view - Clean design for listing search results
  const currentPhoto = getPhotoByIndex(currentPhotoIndex);
  const totalPhotos = getTotalPhotos();
  const pricePerSqft = listing.square_feet && listing.square_feet > 0 
    ? Math.round(listing.price / listing.square_feet) 
    : null;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/property/${listing.id}`)}>
      {/* Photo Container with scrolling */}
      <div className="relative aspect-[4/3] group">
        {currentPhoto ? (
          <img 
            src={currentPhoto} 
            alt={listing.address} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Home className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Selection Checkbox - Top Right */}
        {onSelect && (
          <div 
            className="absolute top-2 right-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect(listing.id)}
              className="h-5 w-5 bg-white border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        )}
        
        {/* Photo Navigation Arrows */}
        {totalPhotos > 1 && (
          <>
            <button
              onClick={handlePreviousPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Photo indicator dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {Array.from({ length: Math.min(totalPhotos, 5) }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${i === currentPhotoIndex % 5 ? 'bg-white' : 'bg-white/50'}`} 
                />
              ))}
              {totalPhotos > 5 && <span className="text-white text-xs ml-1">+{totalPhotos - 5}</span>}
            </div>
          </>
        )}
        
        {/* Property Type Pill - Bottom Right Corner */}
        {listing.property_type && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 right-2 text-xs bg-black/70 text-white border-0 hover:bg-black/70"
          >
            {listing.property_type}
          </Badge>
        )}
      </div>

      <CardContent className="p-3">
        {/* Address Row with Icon */}
        <div className="flex justify-between items-start gap-2 mb-2">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {listing.address}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {listing.city}, {listing.state} {listing.zip_code}
                </p>
              </div>
            </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-primary">
              {formatPrice(listing.price)}
            </div>
            {pricePerSqft && (
              <div className="text-xs text-muted-foreground">
                ${pricePerSqft}/sqft
              </div>
            )}
          </div>
        </div>

        {/* Beds, Baths, SqFt Row with Blue Icons */}
        <div className="flex gap-4 mb-2 text-base font-semibold text-foreground">
          {listing.bedrooms !== null && (
            <div className="flex items-center gap-1.5">
              <Bed className="w-5 h-5 text-primary" />
              <span>{listing.bedrooms}</span>
            </div>
          )}
          {listing.bathrooms !== null && (
            <div className="flex items-center gap-1.5">
              <Bath className="w-5 h-5 text-primary" />
              <span>{listing.bathrooms}</span>
            </div>
          )}
          {listing.square_feet !== null && (
            <div className="flex items-center gap-1.5">
              <Home className="w-5 h-5 text-primary" />
              <span>{listing.square_feet.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Listing Number - blue and clickable */}
        {listing.listing_number && (
          <div className="text-sm mb-3">
            <button
              type="button"
              className="text-primary font-mono font-medium hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/property/${listing.id}`);
              }}
            >
              #{listing.listing_number}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border my-3" />

        {/* Agent Section */}
        {agentProfile ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={agentProfile.headshot_url || undefined} alt={`${agentProfile.first_name} ${agentProfile.last_name}`} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {agentProfile.first_name?.[0]}{agentProfile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {agentProfile.first_name} {agentProfile.last_name}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {agentProfile.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {formatPhoneNumber(agentProfile.phone)}
                  </span>
                )}
              </div>
            </div>
            <ContactAgentDialog
              listingId={listing.id}
              agentId={agentProfile.id}
              listingAddress={`${listing.address}, ${listing.city}, ${listing.state}`}
              buttonSize="sm"
              buttonVariant="default"
            />
          </div>
        ) : agentInfo ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {agentInfo.name}
              </div>
              {agentInfo.company && (
                <div className="text-xs text-muted-foreground truncate">
                  {agentInfo.company}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground">
                Listing Agent
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default ListingCard;