import { useEffect, useState } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, FileText, User, Mail, Phone, Eye, UserX } from "lucide-react";
import { clearPrimaryAgentId } from "@/utils/agentTracking";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  headshot_url: string | null;
}

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
  created_at: string;
  is_active: boolean;
  agent?: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
}

interface Favorite {
  id: string;
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    photos: any;
  };
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [shareTokenByHotSheetId, setShareTokenByHotSheetId] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/consumer/auth");
      return;
    }
    setCurrentUserId(user.id);
    await Promise.all([loadAgentRelationship(user.id), loadHotSheets(user.id), loadFavorites(user.id)]);
    setLoading(false);
  };

  const loadAgentRelationship = async (userId: string) => {
    const { data: relationship } = await supabase
      .from("client_agent_relationships")
      .select("id, agent_id")
      .eq("client_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (relationship) {
      setRelationshipId(relationship.id);
      const { data: agentData } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email, phone, company, headshot_url")
        .eq("id", relationship.agent_id)
        .single();

      if (agentData) {
        setAgent(agentData);
      }
    }
  };

  const loadHotSheets = async (userId: string) => {
    // Get buyer profile email for fallback matching
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const buyerEmail = profile?.email?.toLowerCase().trim() ?? "";

    // Query A: hot sheets linked to this buyer via junction table, include agent profile
    const { data: rows, error: joinErr } = await supabase
      .from("hot_sheet_clients")
      .select(`
        client_id,
        hot_sheet_id,
        hot_sheets (
          id,
          name,
          criteria,
          created_at,
          is_active,
          user_id
        )
      `);

    if (joinErr) {
      console.error("Failed to load hot sheets (join)", joinErr);
      setHotSheets([]);
      return;
    }

    const rawSheets = (rows || [])
      .map((r: any) => ({ ...(r.hot_sheets || {}), _client_id: r.client_id }))
      .filter((s: any) => s.id);

    if (!rawSheets.length) {
      setHotSheets([]);
      setShareTokenByHotSheetId({});
      return;
    }

    // Query B: fetch accepted tokens for this buyer (by user_id)
    const { data: acceptedTokenRows } = await (supabase as any)
      .from("share_tokens")
      .select("token, payload, accepted_at")
      .eq("type", "client_hotsheet_invite")
      .not("accepted_at", "is", null)
      .eq("accepted_by_user_id", userId) as { data: any[] | null };

    // Build sets of accepted hot_sheet_ids for this buyer (by client_id or email in payload)
    const acceptedHotSheetIds = new Set<string>();
    const tokenMap: Record<string, string> = {};

    for (const t of acceptedTokenRows || []) {
      const p = (t.payload as any) ?? {};
      const hsId = String(p.hot_sheet_id ?? "");
      if (!hsId) continue;

      const tokenClientId = String((p as any).client_id ?? "");
      const tokenEmail = String((p as any).client_email ?? "").toLowerCase().trim();

      const matchById = tokenClientId && rawSheets.some((s: any) => String(s._client_id) === tokenClientId && String(s.id) === hsId);
      const matchByEmail = buyerEmail && tokenEmail === buyerEmail;

      if (matchById || matchByEmail) {
        acceptedHotSheetIds.add(hsId);
        if (t.token) tokenMap[hsId] = t.token;
      }
    }

    // Only show hot sheets with an accepted invite
    const acceptedSheets = rawSheets.filter((s: any) => acceptedHotSheetIds.has(String(s.id)));

    // Fetch agent profiles for attribution
    const agentIds = [...new Set(acceptedSheets.map((s: any) => s.user_id).filter(Boolean))];
    let agentMap: Record<string, any> = {};
    if (agentIds.length) {
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, company")
        .in("id", agentIds);
      for (const a of agents || []) agentMap[a.id] = a;
    }

    const sheetsWithAgent = acceptedSheets.map((s: any) => ({
      ...s,
      agent: agentMap[s.user_id] ?? null,
    }));

    setHotSheets(sheetsWithAgent);
    setShareTokenByHotSheetId(tokenMap);
  };

  const loadFavorites = async (userId: string) => {
    const { data } = await supabase
      .from("favorites")
      .select(`
        id,
        listing:listings (
          id, address, city, state, price, bedrooms, bathrooms, photos
        )
      `)
      .eq("user_id", userId)
      .limit(6);

    if (data) {
      setFavorites(data as any);
    }
  };

  const handleEndRelationship = async () => {
    if (!currentUserId) {
      console.error("End relationship: currentUserId is null");
      toast.error("Please sign in again and retry");
      return;
    }

    const { error } = await supabase.rpc('end_client_relationship');

    if (error) {
      console.error("End relationship RPC error:", error);
      toast.error(error.message ?? "Failed to end relationship");
      return;
    }

    console.log("End relationship success via RPC");
    toast.success("Relationship ended");
    clearPrimaryAgentId();
    setAgent(null);
    setRelationshipId(null);
    setShowEndDialog(false);

    await loadAgentRelationship(currentUserId);
  };

  const formatCriteriaSummary = (criteria: any) => {
    const parts = [];
    if (criteria?.bedrooms) parts.push(`${criteria.bedrooms}+ beds`);
    if (criteria?.bathrooms) parts.push(`${criteria.bathrooms}+ baths`);
    if (criteria?.maxPrice) parts.push(`under $${(criteria.maxPrice / 1000).toFixed(0)}k`);
    if (criteria?.cities && criteria.cities.length > 0) {
      parts.push(criteria.cities.slice(0, 2).join(", "));
    }
    return parts.join(" • ");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24">
      <main className="container mx-auto px-4 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <PageTitle className="mb-2">My Dashboard</PageTitle>
            <p className="text-muted-foreground">
              Manage your hot sheets, favorites, and agent relationship
            </p>
          </div>

          {/* Agent Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Your Agent
              </CardTitle>
              <CardDescription>
                {agent ? "Your current All Agent Connect representative" : "You're not currently working with an agent"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agent ? (
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={agent.headshot_url || ""} />
                      <AvatarFallback>
                        {agent.first_name[0]}{agent.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">
                        {agent.first_name} {agent.last_name}
                      </h3>
                      {agent.company && (
                        <p className="text-sm text-muted-foreground">{agent.company}</p>
                      )}
                      <div className="flex flex-col gap-1 mt-2">
                        <a href={`mailto:${agent.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                          <Mail className="w-4 h-4" />
                          {agent.email}
                        </a>
                        {agent.phone && (
                          <a href={`tel:${(agent.phone ?? "").replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm hover:text-primary">
                            <Phone className="w-4 h-4" />
                            {formatPhoneNumber(agent.phone ?? "")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => window.location.href = `mailto:${agent.email}`}>
                      Contact {agent.first_name}
                    </Button>
                    <Button variant="outline" onClick={() => setShowEndDialog(true)}>
                      <UserX className="w-4 h-4 mr-2" />
                      End Relationship
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You're not currently working with an agent on All Agent Connect.
                  </p>
                  <Button onClick={() => navigate("/browse")}>
                    Browse Properties
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hot Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Your Hot Sheets
              </CardTitle>
              <CardDescription>
                Property search alerts shared by your agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hotSheets.length > 0 ? (
                <div className="space-y-4">
                  {hotSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{sheet.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {sheet.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        {sheet.agent && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            From {sheet.agent.first_name} {sheet.agent.last_name}
                            {sheet.agent.company ? ` · ${sheet.agent.company}` : ""}
                          </p>
                        )}
                        {formatCriteriaSummary(sheet.criteria) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatCriteriaSummary(sheet.criteria)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Shared {new Date(sheet.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        {shareTokenByHotSheetId[sheet.id] && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/client/hotsheet/${shareTokenByHotSheetId[sheet.id]}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Open
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    If your agent shares a Hot Sheet with you, it will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Favorites Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Your Favorites
                  </CardTitle>
                  <CardDescription>
                    Properties you've saved
                  </CardDescription>
                </div>
                {favorites.length > 0 && (
                  <Button variant="outline" onClick={() => navigate("/client/favorites")}>
                    View All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {favorites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/property/${fav.listing.id}`)}
                    >
                      <div className="aspect-video bg-muted relative">
                        {fav.listing.photos && fav.listing.photos[0] ? (
                          <img
                            src={fav.listing.photos[0]}
                            alt={fav.listing.address}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold text-lg">
                          ${fav.listing.price.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fav.listing.address}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fav.listing.city}, {fav.listing.state}
                        </p>
                        {(fav.listing.bedrooms || fav.listing.bathrooms) && (
                          <p className="text-sm mt-1">
                            {fav.listing.bedrooms} bed • {fav.listing.bathrooms} bath
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You haven't favorited any properties yet
                  </p>
                  <Button onClick={() => navigate("/browse")}>
                    Start Browsing
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* End Relationship Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              End relationship with {agent?.first_name} {agent?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end your relationship with {agent?.first_name}{" "}
              {agent?.last_name} on All Agent Connect? You'll still be able to view your
              saved homes and searches, but new activity will no longer be connected to
              this agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndRelationship}>
              Yes, end relationship
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
