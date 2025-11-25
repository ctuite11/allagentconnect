import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { Heart, Bed, Bath, Maximize, MapPin, UserCircle2, MessageSquare, Mail, Phone, Building2 } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import { enforceClientIdentity } from "@/lib/enforceClientIdentity";
import { User } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";

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
}

const ClientHotsheetPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotSheet, setHotSheet] = useState<any>(null);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { fullName: string; company?: string | null }>>({});
  const [tokenData, setTokenData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showEditCriteria, setShowEditCriteria] = useState(false);

  useEffect(() => {
    if (token) {
      validateAndLoadHotsheet();
    }
  }, [token]);

  // Check authentication status
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enforce client identity after token data is loaded
  useEffect(() => {
    if (!tokenData || !tokenData.payload) return;

    const payload = tokenData.payload as any;
    const clientEmailFromToken = payload?.client_email || payload?.email || null;

    enforceClientIdentity({
      supabase,
      clientEmailFromToken,
      setCurrentUser,
      setShowLoginPrompt,
    });
  }, [tokenData]);

  const validateAndLoadHotsheet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error("Missing token in URL params");
      }

      // 1) Validate token from share_tokens table
      const { data: tokenData, error: tokenError } = await supabase
        .from("share_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        throw tokenError;
      }

      if (!tokenData) {
        throw new Error("Share token not found");
      }

      console.log("Client hotsheet share token", tokenData);
      
      // Store token data for identity enforcement
      setTokenData(tokenData);

      // Check if token is expired (only if expires_at is set and in the past)
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error("Share token expired");
      }

      // 2) Parse payload - assume it contains hot_sheet_id and optional client_id
      let payload: any = tokenData.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          throw new Error("Invalid payload JSON on share token");
        }
      }

      console.log("Client hotsheet payload", payload);

      const hotSheetId =
        payload?.hot_sheet_id || payload?.hotSheetId || payload?.hotsheetId;

      if (!hotSheetId) {
        throw new Error("No hot_sheet_id found in share token payload");
      }

      // 3) Set agent + client context (cookie / localStorage)
      if (tokenData.agent_id) {
        document.cookie = `primary_agent_id=${tokenData.agent_id}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; SameSite=Lax`;
        localStorage.setItem("primary_agent_id", tokenData.agent_id);
      }

      if (payload.client_id) {
        localStorage.setItem("client_id", payload.client_id);
      }

      // 4) Fetch agent profile
      if (tokenData.agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", tokenData.agent_id)
          .single();

        if (agentError) {
          throw agentError;
        }

        setAgentProfile(agentData);
        setAgent(agentData);
      }

      // 5) Fetch hot sheet details
      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", hotSheetId)
        .single();

      if (hotSheetError || !hotSheetData) {
        throw hotSheetError || new Error("Hotsheet not found");
      }

      console.log("Client hotsheet hotSheet", hotSheetData);
      setHotSheet(hotSheetData);

      // 6) Fetch matching listings using hot sheet criteria
      const loadedCriteria = (hotSheetData.criteria as any) || {};
      const query = buildListingsQuery(supabase, loadedCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      console.log("Client hotsheet listings", listingsData);
      setListings(listingsData || []);

      // Load listing agents for display
      const agentIds = Array.from(
        new Set(
          (listingsData || [])
            .map((l: any) => l.agent_id)
            .filter((id: string | null | undefined) => Boolean(id))
        )
      );

      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, company")
          .in("id", agentIds);

        if (agentsError) {
          console.error("Failed to load listing agents for client hotsheet", agentsError);
        } else if (agentsData) {
          const agentMapping = agentsData.reduce(
            (
              acc: Record<string, { fullName: string; company?: string | null }>,
              agent: any
            ) => {
              acc[agent.id] = {
                fullName: `${agent.first_name} ${agent.last_name}`,
                company: agent.company,
              };
              return acc;
            },
            {} as Record<string, { fullName: string; company?: string | null }>
          );
          setAgentMap(agentMapping);
        }
      }

      // ✅ SUCCESS – stop loading
      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet load error", err);

      const reason =
        err?.message ||
        err?.error_description ||
        err?.hint ||
        (typeof err === "string" ? err : JSON.stringify(err));

      setError(
        `We couldn't load this hotsheet. (${reason}) Please contact your agent or try the link again.`
      );
      setLoading(false);
    }
  };

  const handleUpdateCriteria = () => {
    // Reload the hotsheet data after criteria is updated
    validateAndLoadHotsheet();
  };

  const handleSetupLogin = () => {
    // Close the login prompt
    setShowLoginPrompt(false);
    
    // Extract client email from token payload
    const payload = tokenData?.payload as any;
    const clientEmail = payload?.client_email || payload?.email || "";
    const clientId = payload?.client_id || "";
    
    // Build query params
    const params = new URLSearchParams();
    params.set("invitation_token", token!);
    if (clientEmail) params.set("email", clientEmail);
    if (agentProfile?.id) params.set("agent_id", agentProfile.id);
    if (clientId) params.set("client_id", clientId);
    
    // Navigate to client invitation setup page
    navigate(`/client-invite?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted-foreground text-lg">Loading your hotsheet…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-6 text-center">
            <h1 className="text-xl font-semibold mb-2">We hit a snag</h1>
            <p className="text-muted-foreground mb-4">
              We couldn't load this hotsheet. Please contact your agent or try the link again.
            </p>
            <Button onClick={() => navigate("/")}>Back to home</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const criteria = hotSheet?.criteria || {};

  // Show luxury onboarding modal for anonymous users BEFORE rendering main content
  if (showLoginPrompt && !currentUser && agentProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[600px]" hideCloseButton>
            <DialogHeader>
              {/* Agent Header Section */}
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
              
              <DialogTitle className="text-2xl">
                Secure Your Access to All Agent Connect
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4 text-base leading-relaxed">
                <p className="text-foreground/90">
                  {agentProfile.first_name} has curated a personalized collection of homes for you. 
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
                      <span className="text-foreground/80">Message {agentProfile.first_name} directly</span>
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
                Set Up My Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Agent Header */}
          {agent && (
            <div className="mb-6 p-4 border rounded-lg bg-muted flex items-center gap-4">
              {agent.headshot_url && (
                <img
                  src={agent.headshot_url}
                  alt={`${agent.first_name} ${agent.last_name}`}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">
                  Your custom hotsheet from
                </p>
                <h2 className="text-lg font-semibold mb-1">
                  {agent.first_name} {agent.last_name}
                </h2>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                  {agent.email && <span>{agent.email}</span>}
                  {agent.email && agent.phone && <span>·</span>}
                  {agent.phone && <span>{agent.phone}</span>}
                  {(agent.email || agent.phone) && agent.company && <span>·</span>}
                  {agent.company && <span>{agent.company}</span>}
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {hotSheet?.name || "Your Custom Hotsheet"}
            </h1>
            {agentProfile && (
              <p className="text-muted-foreground">
                Curated by {agentProfile.first_name} {agentProfile.last_name}
                {agentProfile.company && ` from ${agentProfile.company}`}
              </p>
            )}
          </div>

          {/* Search Criteria with Edit Button */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Search Criteria</CardTitle>
                <Button onClick={() => setShowEditCriteria(true)} variant="outline">
                  Edit Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {criteria.minPrice && (
                  <div>
                    <span className="text-muted-foreground">Min Price:</span>{" "}
                    <span className="font-semibold">${parseFloat(criteria.minPrice).toLocaleString()}</span>
                  </div>
                )}
                {criteria.maxPrice && (
                  <div>
                    <span className="text-muted-foreground">Max Price:</span>{" "}
                    <span className="font-semibold">${parseFloat(criteria.maxPrice).toLocaleString()}</span>
                  </div>
                )}
                {criteria.bedrooms && (
                  <div>
                    <span className="text-muted-foreground">Min Beds:</span>{" "}
                    <span className="font-semibold">{criteria.bedrooms}</span>
                  </div>
                )}
                {criteria.bathrooms && (
                  <div>
                    <span className="text-muted-foreground">Min Baths:</span>{" "}
                    <span className="font-semibold">{criteria.bathrooms}</span>
                  </div>
                )}
                {criteria.cities && criteria.cities.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Cities:</span>{" "}
                    <span className="font-semibold">{criteria.cities.join(", ")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit Criteria Dialog */}
          {hotSheet && (
            <EditHotsheetCriteriaDialog
              open={showEditCriteria}
              onOpenChange={setShowEditCriteria}
              hotSheetId={hotSheet.id}
              initialCriteria={criteria}
              onUpdate={handleUpdateCriteria}
            />
          )}

          {/* Listings Count */}
          <div className="mb-4">
            <p className="text-lg font-semibold">
              {listings.length} {listings.length === 1 ? "Property" : "Properties"} Found
            </p>
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No properties match your criteria yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => {
                const photos = listing.photos || [];
                const photoUrl = photos[0]?.url || "";
                const agent = agentMap[listing.agent_id];

                return (
                  <Card
                    key={listing.id}
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/property/${listing.id}`)}
                  >
                    <div className="relative h-48 bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={listing.address}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton listingId={listing.id} size="icon" />
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h3 className="font-semibold text-lg mb-1">{listing.address}</h3>
                        <p className="text-sm text-muted-foreground">
                          {listing.city}, {listing.state} {listing.zip_code}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-primary mb-3">
                        ${listing.price?.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        {listing.bedrooms !== null && (
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4" />
                            <span>{listing.bedrooms} beds</span>
                          </div>
                        )}
                        {listing.bathrooms !== null && (
                          <div className="flex items-center gap-1">
                            <Bath className="h-4 w-4" />
                            <span>{listing.bathrooms} baths</span>
                          </div>
                        )}
                        {listing.square_feet && (
                          <div className="flex items-center gap-1">
                            <Maximize className="h-4 w-4" />
                            <span>{listing.square_feet.toLocaleString()} sqft</span>
                          </div>
                        )}
                      </div>
                      {agent && (
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          Listed by {agent.fullName}
                          {agent.company && ` • ${agent.company}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ClientHotsheetPage;
