import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Bell, User, Mail, Phone, Plus, Edit, Eye, UserX } from "lucide-react";
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
  access_token: string | null;
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/consumer/auth");
      return;
    }
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
    const { data } = await supabase
      .from("hot_sheets")
      .select("id, name, criteria, created_at, is_active, access_token")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) {
      setHotSheets(data);
    }
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
    if (!relationshipId) return;

    const { error } = await supabase
      .from("client_agent_relationships")
      .update({ status: "inactive", ended_at: new Date().toISOString() })
      .eq("id", relationshipId);

    if (error) {
      toast.error("Failed to end relationship");
      return;
    }

    toast.success("Relationship ended");
    setAgent(null);
    setRelationshipId(null);
    setShowEndDialog(false);
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
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <PageTitle className="mb-2">My Dashboard</PageTitle>
            <p className="text-muted-foreground">
              Manage your saved searches, favorites, and agent relationship
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
                          <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                            <Phone className="w-4 h-4" />
                            {agent.phone}
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

          {/* Saved Searches (Hotsheets) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Your Saved Searches
                  </CardTitle>
                  <CardDescription>
                    Manage your property search alerts
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/client/hotsheets/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hotSheets.length > 0 ? (
                <div className="space-y-4">
                  {hotSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{sheet.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCriteriaSummary(sheet.criteria)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(sheet.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (sheet.access_token) {
                              navigate(`/client-hot-sheet/${sheet.access_token}`);
                            }
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You haven't created any saved searches yet
                  </p>
                  <Button onClick={() => navigate("/client/hotsheets/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Search
                  </Button>
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
