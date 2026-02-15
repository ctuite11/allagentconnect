import { useState, useEffect, useCallback } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate, useParams } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Image as ImageIcon, Bed, Bath, Maximize, Home, MapPin, Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import ListingChatDrawer, { type ChatMessage } from "@/components/ListingChatDrawer";
import { ShareListingDialog } from "@/components/ShareListingDialog";

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
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatListingId, setChatListingId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchHotSheetAndListings();
    }
  }, [id]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`hotsheet-chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hot_sheet_comments",
          filter: `hot_sheet_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessagesMap((prev) => {
            const lid = newMsg.listing_id;
            const existing = prev[lid] || [];
            // Dedupe by id
            if (existing.some((m) => m.id === newMsg.id)) return prev;
            return { ...prev, [lid]: [...existing, newMsg] };
          });
          // Toast for client messages
          if (newMsg.sender_role === "client") {
            const listing = listings.find((l) => l.id === newMsg.listing_id);
            const addr = listing ? `${listing.address}, ${listing.city}` : "a listing";
            toast.info(`New message — ${addr}`);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, listings]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessagesMap((prev) => {
      const lid = msg.listing_id;
      const existing = prev[lid] || [];
      if (existing.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [lid]: [...existing, msg] };
    });
  }, []);

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

// Fetch all chat messages for this hot sheet
const { data: comments } = await supabase
  .from("hot_sheet_comments")
  .select("id, hot_sheet_id, listing_id, comment, sender_role, sender_id, created_at")
  .eq("hot_sheet_id", id as string)
  .order("created_at", { ascending: true });
if (comments && comments.length > 0) {
  const grouped: Record<string, ChatMessage[]> = {};
  comments.forEach((c: any) => {
    if (!c.listing_id) return;
    if (!grouped[c.listing_id]) grouped[c.listing_id] = [];
    grouped[c.listing_id].push(c as ChatMessage);
  });
  setMessagesMap(grouped);
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

      // Generate share tokens + send invites for ALL clients on this hot sheet
      const { data: hscRows, error: hscError } = await supabase
        .from("hot_sheet_clients")
        .select("client_id")
        .eq("hot_sheet_id", hotSheet.id);

      if (!hscError && hscRows && hscRows.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: agentProfile } = await supabase
            .from("agent_profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .maybeSingle();
          const agentName = agentProfile
            ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim()
            : "Your agent";

          for (const row of hscRows) {
            const clientId = row.client_id;

            // Skip if active relationship already exists
            const { data: existingRel } = await supabase
              .from("client_agent_relationships")
              .select("id")
              .eq("agent_id", user.id)
              .eq("client_id", clientId)
              .eq("status", "active")
              .maybeSingle();

            if (existingRel) {
              console.log(`[send-first-batch] Skipping client ${clientId} -- active relationship`);
              continue;
            }

            // Skip if token already exists for this client+hotsheet
            const { data: existingToken } = await supabase
              .from("share_tokens")
              .select("token")
              .eq("agent_id", user.id)
              .contains("payload", {
                type: "client_hotsheet_invite",
                client_id: clientId,
                hot_sheet_id: hotSheet.id,
              })
              .maybeSingle();

            if (existingToken) {
              console.log(`[send-first-batch] Token already exists for client ${clientId}`);
              continue;
            }

            // Look up client email
            const { data: clientData } = await supabase
              .from("clients")
              .select("email")
              .eq("id", clientId)
              .maybeSingle();

            if (!clientData?.email) continue;

            const token = crypto.randomUUID();

            const { error: tokenError } = await supabase
              .from("share_tokens")
              .insert({
                token,
                agent_id: user.id,
                payload: {
                  type: "client_hotsheet_invite",
                  client_id: clientId,
                  hot_sheet_id: hotSheet.id,
                  client_email: clientData.email,
                },
              });

            if (tokenError) {
              console.error(`[send-first-batch] Token error for ${clientId}:`, tokenError);
              continue;
            }

            // Send invite email
            const hotSheetLink = `${window.location.origin}/client-invite?invitation_token=${token}&email=${encodeURIComponent(clientData.email)}&agent_id=${user.id}&client_id=${clientId}`;

            supabase.functions.invoke("send-hot-sheet-invite", {
              body: {
                invitedEmail: clientData.email,
                inviterName: agentName,
                hotSheetName: hotSheet.name,
                hotSheetLink,
              },
            }).then(({ error: emailErr }) => {
              if (emailErr) console.error(`[send-first-batch] Email error:`, emailErr);
              else console.log(`[send-first-batch] Invite sent to ${clientData.email}`);
            });
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
      <div className="min-h-screen flex flex-col pt-20">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading hot sheet...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-screen flex flex-col pt-20">
        <main className="flex-1 flex items-center justify-center">
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
    <div className="min-h-screen flex flex-col pt-20">
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header with inline back button */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <PageHeader
                title={hotSheet.name}
                subtitle={getClientDisplay() ? `Client: ${getClientDisplay()}` : undefined}
                backTo="/hot-sheets"
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate(buildSearchUrl())}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      View in Search
                    </Button>
                    <Button onClick={() => navigate("/agent-dashboard")}>
                      Done
                    </Button>
                  </div>
                }
              />
            </div>
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
                  chatMessages={messagesMap[listing.id]}
                  hotSheetId={id}
                  onNewMessage={handleNewMessage}
                  onOpenChat={() => {
                    setChatListingId(listing.id);
                    setChatDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Chat Drawer */}
      {chatListingId && (
        <ListingChatDrawer
          open={chatDrawerOpen}
          onOpenChange={setChatDrawerOpen}
          hotSheetId={id!}
          listingId={chatListingId}
          listingAddress={
            listings.find((l) => l.id === chatListingId)
              ? `${listings.find((l) => l.id === chatListingId)!.address}, ${listings.find((l) => l.id === chatListingId)!.city}`
              : ""
          }
          messages={messagesMap[chatListingId] || []}
          onNewMessage={handleNewMessage}
        />
      )}

      <Footer />
    </div>
  );
};

export default HotSheetReview;
