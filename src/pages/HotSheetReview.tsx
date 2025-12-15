import { useState, useEffect } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, Image as ImageIcon, Bed, Bath, Maximize, Home, MapPin, Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { ShareListingDialog } from "@/components/ShareListingDialog";
import { BulkShareListingsDialog } from "@/components/BulkShareListingsDialog";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

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
  status: string;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
  last_sent_at?: string | null;
  client_id?: string | null;
}

const HotSheetReview = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hotSheet, setHotSheet] = useState<HotSheet | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (id) {
      fetchHotSheetAndListings();
    }
  }, [id]);

  const buildSearchUrl = () => {
    if (!hotSheet) return "";
    const criteria = hotSheet.criteria as any;
    const params = new URLSearchParams();
    
    if (criteria.statuses?.length) params.set("status", criteria.statuses.join(","));
    if (criteria.propertyTypes?.length) params.set("type", criteria.propertyTypes.join(","));
    if (criteria.state) params.set("state", criteria.state);
    if (criteria.cities?.length) params.set("towns", criteria.cities.join("|"));
    if (criteria.zipCode) params.set("zip", criteria.zipCode);
    if (criteria.minPrice) params.set("minPrice", criteria.minPrice.toString());
    if (criteria.maxPrice) params.set("maxPrice", criteria.maxPrice.toString());
    if (criteria.bedrooms) params.set("bedrooms", criteria.bedrooms.toString());
    if (criteria.bathrooms) params.set("bathrooms", criteria.bathrooms.toString());
    
    return `/search?${params.toString()}`;
  };

  const fetchHotSheetAndListings = async () => {
    try {
      setLoading(true);
      
      // Fetch hot sheet
      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("id, name, criteria, last_sent_at, client_id")
        .eq("id", id)
        .maybeSingle();

      if (hotSheetError) throw hotSheetError;
      setHotSheet(hotSheetData);

      // Build query using unified search utility
      const criteria = hotSheetData.criteria as any;
      const query = buildListingsQuery(supabase, criteria).limit(200);

      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) throw listingsError;
      setListings(listingsData || []);
      setAllListings(listingsData || []);

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
      setListings(allListings);
    } else {
      setSelectedListings(new Set(listings.map((l) => l.id)));
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

      // Automatically create share token if client is attached via hot_sheet_clients
      const { data: hscRows, error: hscError } = await supabase
        .from("hot_sheet_clients")
        .select("client_id")
        .eq("hot_sheet_id", hotSheet.id)
        .limit(1);

      if (hscError || !hscRows || hscRows.length === 0) {
        console.warn("No client attached in hot_sheet_clients for this hotsheet");
      } else {
        const client_id = hscRows[0].client_id;
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!user || userError) {
          console.error("No authenticated user for share token", userError);
        } else {
          const token = crypto.randomUUID();

          const { data: tokenRow, error: tokenError } = await supabase
            .from("share_tokens")
            .insert({
              token,
              agent_id: user.id,
              payload: {
                type: "client_hotsheet_invite",
                client_id,
                hot_sheet_id: hotSheet.id,
              },
            })
            .select()
            .single();

          if (tokenError) {
            console.error("Error creating share token", tokenError);
          } else {
            console.log("Created share token", tokenRow);
          }
        }
      }

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
        <main className="flex-1 flex items-center justify-center pt-20">
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
        <main className="flex-1 flex items-center justify-center pt-20">
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
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/hot-sheets")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Hot Sheets
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(buildSearchUrl())}
              >
                <Search className="h-4 w-4 mr-2" />
                View in Search
              </Button>
            </div>
            <PageTitle className="mb-2">{hotSheet.name}</PageTitle>
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
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Scope:</span>
                  {hotSheet.criteria.cities?.length > 0 ? (
                    <span>{hotSheet.criteria.cities.join(", ")}</span>
                  ) : hotSheet.criteria.state ? (
                    <span>All of {hotSheet.criteria.state}</span>
                  ) : (
                    <span>No location filter</span>
                  )}
                </div>
              </div>
              {getCriteriaDisplay().length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {getCriteriaDisplay().map((criterion, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-muted border border-border text-foreground rounded-full text-sm"
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
              {selectedListings.size > 0 && (
                <>
                  <Button
                    onClick={handleKeepSelected}
                    disabled={selectedListings.size === 0}
                  >
                    Keep Selected ({selectedListings.size})
                  </Button>
                  <BulkShareListingsDialog 
                    listingIds={Array.from(selectedListings)}
                    listingCount={selectedListings.size}
                  />
                </>
              )}
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
              {!hotSheet?.last_sent_at && (
                <Button
                  onClick={handleSendFirstBatch}
                  disabled={sending || selectedListings.size === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send First Batch ({selectedListings.size})
                </Button>
              )}
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
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode="compact"
                  showActions={false}
                  onSelect={toggleListing}
                  isSelected={selectedListings.has(listing.id)}
                  agentInfo={
                    agentMap[listing.agent_id]
                      ? {
                          name: agentMap[listing.agent_id].fullName,
                          company: agentMap[listing.agent_id].company
                        }
                      : null
                  }
                />
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
