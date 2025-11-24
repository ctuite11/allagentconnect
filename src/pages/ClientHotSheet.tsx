import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageSquare, ChevronDown, ChevronUp, Settings, Send, Bed, Bath, Maximize, Home, MapPin, Image as ImageIcon, Mail, Phone, Building2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import FavoriteButton from "@/components/FavoriteButton";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { TownsPicker } from "@/components/TownsPicker";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";

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
  description: string | null;
  created_at?: string;
}

const ClientHotSheet = () => {
  const params = useParams();
  console.log("ClientHotSheet route params", params);

  const token =
    (params.token as string | undefined) ||
    (params.id as string | undefined) ||
    (params.shareToken as string | undefined);

  if (!token) {
    throw new Error("No token provided");
  }

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotSheet, setHotSheet] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  
  // Edit criteria state
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("all");
  const [showAreas, setShowAreas] = useState<boolean>(false);
  const [citySearch, setCitySearch] = useState("");
  
  // Selection and sorting state
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");
  
  // Contact agent modal state
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  
  // Auth and login prompt state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Use the TownsPicker hook
  const { townsList, expandedCities, toggleCityExpansion, hasCountyData } = useTownsPicker({
    state,
    county: selectedCountyId,
    showAreas,
  });

  // Get counties for the selected state from COUNTIES_BY_STATE
  const counties = state && COUNTIES_BY_STATE[state]
    ? COUNTIES_BY_STATE[state].map(name => ({ id: name, name, state }))
    : [];

  useEffect(() => {
    if (token) {
      fetchHotSheet();
    } else {
      setError("No token provided");
      setLoading(false);
    }
  }, [token]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show required onboarding modal for anonymous users after data loads
  useEffect(() => {
    if (!currentUser && agentProfile && hotSheet && !loading) {
      console.log("ClientHotSheet onboarding modal shown for token", token);
      setShowLoginPrompt(true);
    }
  }, [currentUser, agentProfile, hotSheet, loading, token]);

  const fetchHotSheet = async () => {
    try {
      if (!token) {
        throw new Error("Missing token in URL params");
      }

      setLoading(true);
      setError(null);

      // Step 1: Look up the share token
      const { data: tokenDataResult, error: tokenError } = await supabase
        .from("share_tokens")
        .select("*")
        .eq("token", token);

      if (tokenError) throw tokenError;

      console.log("Client hotsheet share token data", tokenDataResult);

      const tokenData = Array.isArray(tokenDataResult) ? tokenDataResult[0] : tokenDataResult;

      if (!tokenData) {
        throw new Error("Share token not found");
      }

      console.log("Client hotsheet share token", tokenData);

      // Step 2: Parse payload to get hot_sheet_id
      const payload = tokenData.payload as any;
      console.log("Client hotsheet payload", payload);

      if (!payload || !payload.hot_sheet_id) {
        throw new Error("No hotsheet id found in payload");
      }

      const hotSheetId = payload.hot_sheet_id;
      console.log("ClientHotSheet attempting to load hot_sheet_id:", hotSheetId);

      // Step 3: Load the hot sheet
      const { data: hotSheetDataResult, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", hotSheetId);

      if (hotSheetError) {
        console.error("ClientHotSheet error loading hotsheet:", hotSheetError);
        throw hotSheetError;
      }

      console.log("ClientHotSheet data result from hot_sheets:", hotSheetDataResult);

      const hotSheetData = Array.isArray(hotSheetDataResult) ? hotSheetDataResult[0] : hotSheetDataResult;

      if (!hotSheetData) {
        throw new Error("Hotsheet not found");
      }

      console.log("Client hotsheet hotSheet", hotSheetData);
      setHotSheet(hotSheetData);

      // Load criteria into form
      const criteria: any = hotSheetData.criteria || {};
      setPropertyTypes(criteria.propertyTypes || []);
      setMinPrice(criteria.minPrice?.toString() || "");
      setMaxPrice(criteria.maxPrice?.toString() || "");
      setBedrooms(criteria.bedrooms?.toString() || "");
      setBathrooms(criteria.bathrooms?.toString() || "");
      setSelectedCities(criteria.cities || []);
      setState(criteria.state || "MA");
      setSelectedCountyId(criteria.countyId || "all");

      // Load agent profile for banner
      if (hotSheetData.user_id) {
        const { data: agentData } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", hotSheetData.user_id)
          .maybeSingle();
        
        if (agentData) {
          setAgentProfile(agentData);
        }
      }

      // Step 4: Build and fetch listings
      const query = buildListingsQuery(supabase, criteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      console.log("Client hotsheet listings", listingsData);
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

      // Fetch favorites
      const { data: favData } = await supabase
        .from("hot_sheet_favorites")
        .select("listing_id")
        .eq("hot_sheet_id", hotSheetData.id);

      setFavorites(new Set(favData?.map(f => f.listing_id) || []));

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("hot_sheet_comments")
        .select("*")
        .eq("hot_sheet_id", hotSheetData.id);

      const commentsMap: Record<string, string> = {};
      commentsData?.forEach(c => {
        commentsMap[c.listing_id] = c.comment;
      });
      setComments(commentsMap);

      // Success - all data loaded
      setLoading(false);
    } catch (error: any) {
      console.error("Client hotsheet load error", error);

      const reason =
        error?.message ||
        error?.error_description ||
        error?.hint ||
        (typeof error === "string" ? error : JSON.stringify(error));

      setError(
        `We couldn't load this hotsheet. (${reason}) Please contact your agent or try the link again.`
      );
      setLoading(false);
    }
  };

  const toggleFavorite = async (listingId: string) => {
    try {
      const isFavorite = favorites.has(listingId);

      if (isFavorite) {
        const { error } = await supabase
          .from("hot_sheet_favorites")
          .delete()
          .eq("hot_sheet_id", hotSheet.id)
          .eq("listing_id", listingId);

        if (error) throw error;

        setFavorites(prev => {
          const newFavs = new Set(prev);
          newFavs.delete(listingId);
          return newFavs;
        });
        toast.success("Removed from favorites");
      } else {
        const { error } = await supabase
          .from("hot_sheet_favorites")
          .insert({
            hot_sheet_id: hotSheet.id,
            listing_id: listingId,
          });

        if (error) throw error;

        setFavorites(prev => new Set([...prev, listingId]));
        toast.success("Added to favorites");
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite");
    }
  };

  const handleSendComment = async (listingId: string) => {
    const commentText = newComment[listingId]?.trim();
    if (!commentText) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      // Check if comment already exists
      const { data: existing } = await supabase
        .from("hot_sheet_comments")
        .select("id")
        .eq("hot_sheet_id", hotSheet.id)
        .eq("listing_id", listingId)
        .maybeSingle();

      if (existing) {
        // Update existing comment
        const { error } = await supabase
          .from("hot_sheet_comments")
          .update({ comment: commentText })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new comment
        const { error } = await supabase
          .from("hot_sheet_comments")
          .insert({
            hot_sheet_id: hotSheet.id,
            listing_id: listingId,
            comment: commentText,
          });

        if (error) throw error;
      }

      setComments(prev => ({ ...prev, [listingId]: commentText }));
      setNewComment(prev => ({ ...prev, [listingId]: "" }));
      toast.success("Comment sent to agent");
    } catch (error: any) {
      console.error("Error sending comment:", error);
      toast.error("Failed to send comment");
    }
  };

  const handleApplyCriteria = async () => {
    try {
      const updatedCriteria = {
        propertyTypes: propertyTypes.length > 0 ? propertyTypes : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        cities: selectedCities.length > 0 ? selectedCities : null,
        state: state || null,
        countyId: selectedCountyId !== "all" ? selectedCountyId : null,
      };

      // Build and fetch listings with updated criteria
      const query = buildListingsQuery(supabase, updatedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;

      setListings(listingsData || []);
      toast.success("Search updated");
      setEditDialogOpen(false);
    } catch (error: any) {
      console.error("Error updating criteria:", error);
      toast.error("Failed to update search");
    }
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const propertyTypeOptions = [
    { value: "single_family", label: "Single Family" },
    { value: "condo", label: "Condo" },
    { value: "multi_family", label: "Multi Family" },
    { value: "townhouse", label: "Townhouse" },
  ];

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  // Selection functions
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
      setSelectedListings(new Set(listings.map(l => l.id)));
    }
  };

  const handleKeepSelected = () => {
    if (selectedListings.size === 0) {
      toast.error("No listings selected");
      return;
    }
    const filtered = listings.filter(l => selectedListings.has(l.id));
    setListings(filtered);
    toast.success(`Showing ${filtered.length} selected listings`);
  };

  const handleSendMessage = async () => {
    const messageText = contactMessage.trim();
    if (!messageText) {
      toast.error("Please enter a message");
      return;
    }

    try {
      console.log("ClientHotSheet contact modal opened for agent:", agentProfile?.id);
      
      // Insert general message into hot_sheet_comments with listing_id as null
      // Note: This may fail if schema doesn't allow null listing_id
      const { error } = await supabase
        .from("hot_sheet_comments")
        .insert({
          hot_sheet_id: hotSheet.id,
          listing_id: null as any, // General message, not tied to a specific property
          comment: `[General Inquiry] ${messageText}`,
        });

      if (error) throw error;

      setContactMessage("");
      setIsContactModalOpen(false);
      toast.success(`Your message has been sent to ${agentProfile?.first_name || "your agent"}.`);
    } catch (error: any) {
      console.error("Contact agent error", error);
      toast.error("We couldn't send your message. Please try again.");
    }
  };

  const handleSetupLogin = () => {
    // Extract client email if available from hotsheet
    const clientEmail = (hotSheet as any)?.client_email || "";
    const clientId = hotSheet?.client_id || "";
    
    // Navigate to luxury onboarding page with all necessary params
    const inviteUrl = `/client-invite?invitation_token=${token}&email=${encodeURIComponent(clientEmail)}&agent_id=${agentProfile?.id}&client_id=${clientId}`;
    navigate(inviteUrl);
  };

  // Sort listings
  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case "oldest":
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      case "price-high":
        return b.price - a.price;
      case "price-low":
        return a.price - b.price;
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading your hotsheet…</p>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">We hit a snag</h1>
          <p className="text-muted-foreground">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Card className="p-8">
            <p className="text-muted-foreground">Hot sheet not found</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Agent Banner */}
          {agentProfile && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {agentProfile.headshot_url ? (
                    <img 
                      src={agentProfile.headshot_url} 
                      alt={`${agentProfile.first_name} ${agentProfile.last_name}`}
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                      <UserCircle2 className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          You're working with {agentProfile.first_name} {agentProfile.last_name}
                        </h3>
                        <div className="md:hidden mt-3">
                          <Button 
                            onClick={() => {
                              console.log("ClientHotSheet contact modal opened for agent:", agentProfile?.id);
                              setIsContactModalOpen(true);
                            }}
                            variant="default"
                            size="sm"
                            className="w-full"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Contact {agentProfile.first_name}
                          </Button>
                        </div>
                        {agentProfile.company && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                            <Building2 className="w-4 h-4" />
                            {agentProfile.company}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                          {agentProfile.email && (
                            <a href={`mailto:${agentProfile.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                              <Mail className="w-3.5 h-3.5" />
                              {agentProfile.email}
                            </a>
                          )}
                          {(agentProfile.phone || agentProfile.cell_phone) && (
                            <a href={`tel:${agentProfile.phone || agentProfile.cell_phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                              <Phone className="w-3.5 h-3.5" />
                              {agentProfile.phone || agentProfile.cell_phone}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Want full control? Create a free account to unlock advanced filters and save your searches
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            console.log("ClientHotSheet contact modal opened for agent:", agentProfile?.id);
                            setIsContactModalOpen(true);
                          }}
                          className="shrink-0"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Contact {agentProfile.first_name}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const params = new URLSearchParams();
                            if (agentProfile?.id) params.set('primary_agent_id', agentProfile.id);
                            if (hotSheet?.id) params.set('hot_sheet_id', hotSheet.id);
                            navigate(`/auth?${params.toString()}`);
                          }}
                          className="shrink-0"
                        >
                          Create Free Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">{hotSheet.name}</h1>
              <p className="text-muted-foreground">
                {hotSheet.clients && `For: ${hotSheet.clients.first_name} ${hotSheet.clients.last_name}`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {listings.length} matching {listings.length === 1 ? 'property' : 'properties'}
              </p>
            </div>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Edit Search
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Search Criteria</DialogTitle>
                  <DialogDescription>
                    Update your search preferences to refine matching properties
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Property Types</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyTypeOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-pt-${option.value}`}
                            checked={propertyTypes.includes(option.value)}
                            onCheckedChange={() => togglePropertyType(option.value)}
                          />
                          <Label htmlFor={`edit-pt-${option.value}`} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-min-price">Min Price</Label>
                      <Input
                        id="edit-min-price"
                        type="number"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-max-price">Max Price</Label>
                      <Input
                        id="edit-max-price"
                        type="number"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-bedrooms">Min Bedrooms</Label>
                      <Input
                        id="edit-bedrooms"
                        type="number"
                        placeholder="Any"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-bathrooms">Min Bathrooms</Label>
                      <Input
                        id="edit-bathrooms"
                        type="number"
                        step="0.5"
                        placeholder="Any"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Location selection matching agent's hotsheet builder */}
                  <div className="space-y-3">
                    <Label>Location</Label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-state">State</Label>
                        <Select value={state} onValueChange={setState}>
                          <SelectTrigger id="edit-state">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s.code} value={s.code}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {hasCountyData && (
                        <div className="space-y-2">
                          <Label htmlFor="edit-county">County</Label>
                          <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                            <SelectTrigger id="edit-county">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Counties</SelectItem>
                              {counties.map((county) => (
                                <SelectItem key={county.id} value={county.id}>
                                  {county.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Towns / Cities ({selectedCities.length} selected)</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="edit-show-areas"
                            checked={showAreas}
                            onCheckedChange={(checked) => setShowAreas(checked as boolean)}
                          />
                          <Label htmlFor="edit-show-areas" className="text-xs cursor-pointer">
                            Show neighborhoods
                          </Label>
                        </div>
                      </div>
                      <Input
                        placeholder="Search towns..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                      />
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        <TownsPicker
                          towns={townsList}
                          selectedTowns={selectedCities}
                          onToggleTown={toggleCity}
                          expandedCities={expandedCities}
                          onToggleCityExpansion={toggleCityExpansion}
                          state={state}
                          searchQuery={citySearch}
                          variant="checkbox"
                          showAreas={showAreas}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 mt-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleApplyCriteria}>
                      Apply Changes
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Action Buttons */}
          {listings.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedListings.size === listings.length && listings.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({listings.length} listings)
                  </label>
                </div>
                {selectedListings.size > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({selectedListings.size} selected)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedListings.size > 0 && (
                  <>
                    <Button onClick={handleKeepSelected} variant="outline" size="sm">
                      Keep Selected ({selectedListings.size})
                    </Button>
                    <BulkShareListingsDialog
                      listingIds={Array.from(selectedListings)}
                      listingCount={selectedListings.size}
                    />
                  </>
                )}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="price-high">Price High-Low</SelectItem>
                    <SelectItem value="price-low">Price Low-High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground">No properties match your criteria yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search criteria to see more results.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="relative" onClick={() => navigate(`/consumer/property/${listing.id}`)}>
                    <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedListings.has(listing.id)}
                        onCheckedChange={() => toggleListing(listing.id)}
                        className="bg-background/80 backdrop-blur-sm"
                      />
                    </div>
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton listingId={listing.id} size="icon" variant="secondary" />
                    </div>
                    {listing.photos && listing.photos[0] ? (
                      <img
                        src={listing.photos[0].url || listing.photos[0]}
                        alt={listing.address}
                        className="w-full h-48 object-cover"
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
                    {agentMap[listing.agent_id] && (
                      <div className="flex justify-end mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agent/${listing.agent_id}`);
                          }}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors text-right"
                        >
                          {agentMap[listing.agent_id].fullName}
                          {agentMap[listing.agent_id].company && (
                            <span className="block">{agentMap[listing.agent_id].company}</span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Comment Section */}
                    <div className="space-y-2">
                      {comments[listing.id] && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Your comment:</p>
                          <p className="text-sm">{comments[listing.id]}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment for your agent..."
                          value={newComment[listing.id] || ""}
                          onChange={(e) => setNewComment(prev => ({ ...prev, [listing.id]: e.target.value }))}
                          maxLength={500}
                        />
                        <Button 
                          size="icon"
                          onClick={() => handleSendComment(listing.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Required Onboarding Modal - Luxury Design with Agent Info */}
      <Dialog open={showLoginPrompt} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px]" hideCloseButton>
          <DialogHeader>
            {/* Agent Header Section */}
            {agentProfile && (
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                  {agentProfile.headshot_url ? (
                    <img 
                      src={agentProfile.headshot_url} 
                      alt={agentProfile.first_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {agentProfile.first_name?.charAt(0)}{agentProfile.last_name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">You're setting up your access with</p>
                  <p className="font-semibold text-foreground">{agentProfile.first_name} {agentProfile.last_name}</p>
                </div>
              </div>
            )}
            
            <DialogTitle className="text-2xl">
              Secure Your Access to All Agent Connect
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4 text-base leading-relaxed">
              <p className="text-foreground/90">
                Your agent has curated a personalized collection of homes for you. 
                To continue exploring your private hot sheet, please set up your All Agent Connect login.
              </p>
              <div className="pt-2">
                <p className="font-medium text-foreground/90 mb-3">Creating your login ensures you can:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-foreground/80">View your homes anytime</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-foreground/80">Save and organize your favorites</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-foreground/80">Message your agent directly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-foreground/80">Access your search securely from any device</span>
                  </li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button
              onClick={handleSetupLogin}
              className="w-full h-11"
              size="lg"
            >
              Set Up My Login
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Agent Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Contact {agentProfile?.first_name}</DialogTitle>
            <DialogDescription>
              Send a message to your agent about this search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[150px]"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsContactModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              className="flex-1"
            >
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ClientHotSheet;