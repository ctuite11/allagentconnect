import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Home, Bed, Bath, Maximize, MapPin, Mail, CheckCircle2 } from "lucide-react";

interface PreviewListing {
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
  status: string;
}

export default function HotSheetPreview() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [hotSheetName, setHotSheetName] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentCompany, setAgentCompany] = useState<string | null>(null);
  const [listings, setListings] = useState<PreviewListing[]>([]);
  const [error, setError] = useState(false);

  // Subscribe form
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-hotsheet-preview", {
          body: { token },
        });

        if (fnError || !data?.success) {
          setError(true);
        } else {
          setHotSheetName(data.hotSheetName || "Hot Sheet");
          setAgentName(data.agentName || null);
          setAgentCompany(data.agentCompany || null);
          setListings(data.listings || []);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubscribe = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setSubscribing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-hotsheet-preview", {
        body: { token, email: trimmedEmail, first_name: firstName.trim() || null },
      });

      if (fnError || !data?.success) {
        toast.error("Something went wrong. Please try again.");
      } else {
        setSubscribed(true);
        toast.success("You're subscribed! You'll receive email updates for new listings.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading preview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <h1 className="text-xl font-semibold">Preview not available</h1>
            <p className="text-muted-foreground">This link may have expired or is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Hot Sheet Preview</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{hotSheetName}</h1>
          {agentName && (
            <p className="text-sm text-muted-foreground mt-2">
              Curated by <span className="font-medium text-foreground">{agentName}</span>
              {agentCompany && <span> · {agentCompany}</span>}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {listings.length} listing{listings.length !== 1 ? "s" : ""} matching this search
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Subscribe CTA */}
        {!subscribed ? (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-6">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold text-foreground">Want these updates?</h2>
                <p className="text-sm text-muted-foreground">
                  Get notified by email when new listings match this search. No account needed.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end max-w-lg mx-auto">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="preview_email">Email *</Label>
                  <Input
                    id="preview_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10"
                  />
                </div>
                <div className="w-full sm:w-32 space-y-1.5">
                  <Label htmlFor="preview_first">First name</Label>
                  <Input
                    id="preview_first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="h-10"
                  />
                </div>
                <Button
                  onClick={handleSubscribe}
                  disabled={subscribing || !email.trim()}
                  className="h-10 whitespace-nowrap"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {subscribing ? "Subscribing…" : "Get Updates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-6 pb-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-foreground">You're subscribed!</h2>
              <p className="text-sm text-muted-foreground">
                You'll receive email updates when new listings match this search.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Listing Cards */}
        {listings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No listings to show yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {listings.map((listing) => {
              const photoUrl =
                listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0
                  ? listing.photos[0]
                  : typeof listing.photos === "object" && listing.photos?.urls?.[0]
                  ? listing.photos.urls[0]
                  : null;

              return (
                <Card key={listing.id} className="overflow-hidden">
                  {photoUrl && (
                    <div className="aspect-[16/10] bg-muted overflow-hidden">
                      <img
                        src={photoUrl}
                        alt={listing.address}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">
                        {formatPrice(listing.price)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {listing.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {listing.address}, {listing.city}, {listing.state}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {listing.bedrooms != null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5" /> {listing.bedrooms} bed
                        </span>
                      )}
                      {listing.bathrooms != null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {listing.bathrooms} bath
                        </span>
                      )}
                      {listing.square_feet != null && (
                        <span className="flex items-center gap-1">
                          <Maximize className="h-3.5 w-3.5" /> {listing.square_feet.toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Bottom subscribe CTA */}
        {!subscribed && listings.length > 0 && (
          <div className="text-center mt-8 mb-12">
            <Button
              size="lg"
              onClick={() =>
                document
                  .getElementById("preview_email")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              <Mail className="h-4 w-4 mr-2" />
              Get Updates for This Search
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-8 border-t border-border mt-8">
          <p>Powered by All Agent Connect</p>
        </div>
      </div>
    </div>
  );
}
