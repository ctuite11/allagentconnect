import { useEffect, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Footer from "@/components/Footer";
import { Heart } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import { humanizeSnakeCase } from "@/lib/format";

interface Favorite {
  id: string;
  listing: {
    id: string;
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
  };
}

export default function ClientFavoritesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/consumer/auth");
      return;
    }
    await loadFavorites(user.id);
    setLoading(false);
  };

  const loadFavorites = async (userId: string) => {
    const { data } = await supabase
      .from("favorites")
      .select(`
        id,
        listing:listings (
          id, address, city, state, zip_code, price, bedrooms, bathrooms, 
          square_feet, property_type, photos
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) {
      setFavorites(data as any);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <main className="container mx-auto px-4 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <PageTitle icon={<Heart className="w-8 h-8 text-primary" />} className="mb-2">
              My Favorites
            </PageTitle>
            <p className="text-muted-foreground">
              {favorites.length === 0
                ? "You haven't favorited any properties yet"
                : `${favorites.length} saved ${favorites.length === 1 ? "property" : "properties"}`}
            </p>
          </div>

          {favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative group"
                >
                  <div
                    className="cursor-pointer"
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
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No image available
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-xl mb-1">
                        ${fav.listing.price.toLocaleString()}
                      </p>
                      <p className="text-sm font-medium">
                        {fav.listing.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fav.listing.city}, {fav.listing.state} {fav.listing.zip_code}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {fav.listing.bedrooms && (
                          <span>{fav.listing.bedrooms} bed</span>
                        )}
                        {fav.listing.bathrooms && (
                          <span>{fav.listing.bathrooms} bath</span>
                        )}
                        {fav.listing.square_feet && (
                          <span>{fav.listing.square_feet.toLocaleString()} sqft</span>
                        )}
                      </div>
                      {fav.listing.property_type && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {humanizeSnakeCase(fav.listing.property_type)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 z-10">
                    <FavoriteButton listingId={fav.listing.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No favorites yet</h2>
              <p className="text-muted-foreground mb-6">
                Start exploring properties and save your favorites
              </p>
              <button
                onClick={() => navigate("/browse")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Browse Properties
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
