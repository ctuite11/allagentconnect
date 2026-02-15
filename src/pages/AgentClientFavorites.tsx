import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/layout/PageShell";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanizeSnakeCase } from "@/lib/format";

interface ClientFavorite {
  id: string;
  listing_id: string;
  created_at: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  photos: any;
}

export default function AgentClientFavorites() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<ClientFavorite[]>([]);
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      loadClientInfo(clientId);
      loadFavorites(clientId);
    }
  }, [clientId]);

  const loadClientInfo = async (id: string) => {
    const { data } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", id)
      .maybeSingle();
    if (data) setClientName(`${data.first_name} ${data.last_name}`);
  };

  const loadFavorites = async (id: string) => {
    try {
      // The client record id != auth user id. We need to find the user_id
      // from client_agent_relationships where the client email matches.
      // But the RPC expects the client's auth user_id, not client record id.
      // First resolve client email → user id via client_agent_relationships.
      const { data: client } = await supabase
        .from("clients")
        .select("email")
        .eq("id", id)
        .maybeSingle();

      if (!client?.email) {
        setError("Client not found");
        setLoading(false);
        return;
      }

      // Find user_id from profiles by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", client.email)
        .maybeSingle();

      if (!profile?.id) {
        setError("This client hasn't created an account yet");
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "get_client_favorites_for_agent",
        { p_client_id: profile.id }
      );

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setError(rpcError.message.includes("No active relationship")
          ? "You don't have an active relationship with this client"
          : "Failed to load favorites");
        setLoading(false);
        return;
      }

      setFavorites((data || []) as ClientFavorite[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button variant="ghost" onClick={() => navigate("/my-clients")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Button>

        <div className="mb-8">
          <PageTitle icon={<Heart className="w-8 h-8 text-primary" />} className="mb-2">
            {clientName ? `${clientName}'s Favorites` : "Client Favorites"}
          </PageTitle>
          <p className="text-muted-foreground">
            {error
              ? error
              : favorites.length === 0 && !loading
                ? "This client hasn't favorited any properties yet"
                : `${favorites.length} saved ${favorites.length === 1 ? "property" : "properties"}`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? null : favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => {
              const photos = Array.isArray(fav.photos) ? fav.photos : [];
              return (
                <div
                  key={fav.id}
                  className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/property/${fav.listing_id}`)}
                >
                  <div className="aspect-video bg-muted">
                    {photos[0] ? (
                      <img src={photos[0]} alt={fav.address} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-xl mb-1">
                      ${fav.price?.toLocaleString() ?? "—"}
                    </p>
                    <p className="text-sm font-medium">{fav.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {fav.city}, {fav.state} {fav.zip_code}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {fav.bedrooms != null && <span>{fav.bedrooms} bed</span>}
                      {fav.bathrooms != null && <span>{fav.bathrooms} bath</span>}
                      {fav.square_feet != null && <span>{fav.square_feet.toLocaleString()} sqft</span>}
                    </div>
                    {fav.property_type && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {humanizeSnakeCase(fav.property_type)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No favorites yet</h2>
            <p className="text-muted-foreground">
              This client hasn't saved any properties to their favorites
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
