import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { applyDcmlsFilter } from "@/lib/dcmlsFilter";
import { Bed, Bath, Home } from "lucide-react";

interface DcmlsListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);

const resolvePhoto = (photos: any): string | null => {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
  const p = photos[0];
  if (typeof p === "string") return p;
  if (p?.url) {
    if (p.url.startsWith("http")) return p.url;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(p.url);
    return data.publicUrl;
  }
  return null;
};

const DcmlsExclusiveListings = () => {
  const [listings, setListings] = useState<DcmlsListing[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      let query = supabase
        .from("listings_public")
        .select("id, address, city, state, price, bedrooms, bathrooms, square_feet, photos, publish_to_dcmls, dcmls_status, status")
        .order("created_at", { ascending: false })
        .limit(6);
      query = applyDcmlsFilter(query);
      const { data } = await query;
      if (data) setListings(data as DcmlsListing[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading || listings.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Homes You Won't Find Anywhere Else</h2>
          <p className="text-xl text-muted-foreground">
            Exclusive listings from our agent network
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const photo = resolvePhoto(listing.photos);
            return (
              <div
                key={listing.id}
                className="rounded-2xl border bg-card overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => navigate(`/property/${listing.id}`)}
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {photo ? (
                    <img src={photo} alt={listing.address} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Home className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 z-10 inline-flex items-center text-white text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full shadow-sm"
                    style={{ backgroundColor: "#0E56F5" }}
                  >
                    DCMLS
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-lg font-bold text-primary">{formatPrice(listing.price)}</p>
                  <p className="mt-1 break-words text-sm font-medium text-foreground">{listing.address}</p>
                  <p className="text-xs text-muted-foreground">{listing.city}, {listing.state}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    {listing.bedrooms != null && (
                      <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{listing.bedrooms}</span>
                    )}
                    {listing.bathrooms != null && (
                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{listing.bathrooms}</span>
                    )}
                    {listing.square_feet != null && (
                      <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{listing.square_feet.toLocaleString()} sqft</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DcmlsExclusiveListings;
