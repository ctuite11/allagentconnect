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
import { Heart, Bed, Bath, Maximize, MapPin } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";

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
  const [editableCriteria, setEditableCriteria] = useState<any>({
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    cities: "",
  });

  useEffect(() => {
    if (token) {
      validateAndLoadHotsheet();
    }
  }, [token]);

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

      // Initialize editable criteria from hotsheet
      const loadedCriteria = (hotSheetData.criteria as any) || {};
      setEditableCriteria({
        minPrice: loadedCriteria.minPrice || "",
        maxPrice: loadedCriteria.maxPrice || "",
        bedrooms: loadedCriteria.bedrooms || "",
        bathrooms: loadedCriteria.bathrooms || "",
        cities: loadedCriteria.cities ? loadedCriteria.cities.join(", ") : "",
      });

      // 6) Fetch matching listings using hot sheet criteria
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

  const handleSaveCriteria = async () => {
    if (!hotSheet) return;

    try {
      setLoading(true);
      setError(null);

      const newCriteria: any = {
        ...hotSheet.criteria,
      };

      if (editableCriteria.minPrice) {
        newCriteria.minPrice = Number(editableCriteria.minPrice) || undefined;
      } else {
        delete newCriteria.minPrice;
      }

      if (editableCriteria.maxPrice) {
        newCriteria.maxPrice = Number(editableCriteria.maxPrice) || undefined;
      } else {
        delete newCriteria.maxPrice;
      }

      if (editableCriteria.bedrooms) {
        newCriteria.bedrooms = Number(editableCriteria.bedrooms) || undefined;
      } else {
        delete newCriteria.bedrooms;
      }

      if (editableCriteria.bathrooms) {
        newCriteria.bathrooms = Number(editableCriteria.bathrooms) || undefined;
      } else {
        delete newCriteria.bathrooms;
      }

      if (editableCriteria.cities) {
        newCriteria.cities = editableCriteria.cities
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean);
      } else {
        delete newCriteria.cities;
      }

      // Reload listings with new criteria
      const query = buildListingsQuery(supabase, newCriteria).limit(200);
      const { data: listingsData, error: listingsError } = await query;

      if (listingsError) {
        throw listingsError;
      }

      console.log("Client hotsheet updated listings", listingsData);
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
          console.error("Failed to load listing agents", agentsError);
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

      toast.success("Updated search criteria for this hotsheet.");
      setLoading(false);
    } catch (err: any) {
      console.error("Client hotsheet criteria update error", err);
      
      const reason =
        err?.message ||
        err?.error_description ||
        err?.hint ||
        (typeof err === "string" ? err : JSON.stringify(err));
      
      toast.error(`Could not update listings. (${reason})`);
      setLoading(false);
    }
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

          {/* Editable Search Criteria */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Search Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="minPrice">Price Min</Label>
                  <Input
                    id="minPrice"
                    type="number"
                    placeholder="Min Price"
                    value={editableCriteria.minPrice}
                    onChange={(e) => setEditableCriteria({ ...editableCriteria, minPrice: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="maxPrice">Price Max</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    placeholder="Max Price"
                    value={editableCriteria.maxPrice}
                    onChange={(e) => setEditableCriteria({ ...editableCriteria, maxPrice: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="bedrooms">Beds Min</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    placeholder="Beds"
                    value={editableCriteria.bedrooms}
                    onChange={(e) => setEditableCriteria({ ...editableCriteria, bedrooms: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="bathrooms">Baths Min</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    placeholder="Baths"
                    value={editableCriteria.bathrooms}
                    onChange={(e) => setEditableCriteria({ ...editableCriteria, bathrooms: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[250px]">
                  <Label htmlFor="cities">Cities (comma-separated)</Label>
                  <Input
                    id="cities"
                    type="text"
                    placeholder="Boston, Cambridge, Somerville"
                    value={editableCriteria.cities}
                    onChange={(e) => setEditableCriteria({ ...editableCriteria, cities: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSaveCriteria}>
                Save Criteria
              </Button>
            </CardContent>
          </Card>

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
