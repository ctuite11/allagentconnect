import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import FavoriteButton from "@/components/FavoriteButton";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Maximize, MapPin, Heart } from "lucide-react";
import { toast } from "sonner";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string | null;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
}

interface FavoriteRow {
  id: string;
  created_at: string;
  listings: Listing | null;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const getPhoto = (photos: any): string | null => {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0];
  if (typeof first === "string") return first;
  if (first?.url) return first.url;
  return null;
};

const DcmlsSaved = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?redirect=/saved");
        return;
      }
      const { data, error } = await supabase
        .from("favorites")
        .select("id, created_at, listings(id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, photos)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load saved homes");
        console.error(error);
      } else {
        setFavorites((data as any) || []);
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  return (
    <>
      <Seo
        title="Saved Homes — Direct Connect MLS"
        description="Your saved homes on Direct Connect MLS."
        canonical="https://directconnectmls.com/saved"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-16">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Saved Homes
            </h1>
            <p className="text-muted-foreground mt-2">
              {loading ? "Loading…" : `${favorites.length} ${favorites.length === 1 ? "home" : "homes"} saved`}
            </p>
          </div>

          {!loading && favorites.length === 0 && (
            <div className="border border-border/60 rounded-2xl p-16 text-center bg-muted/20">
              <Heart className="w-10 h-10 mx-auto mb-4 text-muted-foreground/60" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No saved homes yet
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Tap the heart on any listing to save it here. We'll keep a private list across your devices.
              </p>
              <Button asChild>
                <Link to="/browse?dcmls=1">Browse listings</Link>
              </Button>
            </div>
          )}

          {!loading && favorites.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((fav) => {
                const l = fav.listings;
                if (!l) return null;
                const photo = getPhoto(l.photos);
                return (
                  <div
                    key={fav.id}
                    className="group rounded-xl overflow-hidden border border-border/60 bg-card hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/property/${l.id}`)}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {photo ? (
                        <img
                          src={photo}
                          alt={l.address}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                          No photo
                        </div>
                      )}
                      <div
                        className="absolute top-3 right-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FavoriteButton
                          listingId={l.id}
                          size="icon"
                          variant="secondary"
                          className="rounded-full bg-white/90 hover:bg-white border-0 h-9 w-9"
                        />
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-lg font-semibold text-foreground tracking-tight">
                        {formatPrice(l.price)}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1.5">
                        {l.bedrooms != null && (
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5" /> {l.bedrooms}
                          </span>
                        )}
                        {l.bathrooms != null && (
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5" /> {l.bathrooms}
                          </span>
                        )}
                        {l.square_feet != null && (
                          <span className="flex items-center gap-1">
                            <Maximize className="w-3.5 h-3.5" /> {l.square_feet.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-1.5 mt-2.5 text-sm text-foreground">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2">
                          {l.address}, {l.city}, {l.state}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default DcmlsSaved;
