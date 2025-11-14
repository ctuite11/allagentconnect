import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Bed, Bath, Square, X, MessageSquare, Heart, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  property_type: string;
  listing_type: string;
  status: string;
  photos: any[];
  agent_id: string;
}

interface Favorite {
  id: string;
  listing_id: string;
  created_at: string;
  listings: Listing;
}

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to view favorites");
      navigate("/auth");
      return;
    }
    setUser(user);
    fetchFavorites(user.id);
  };

  const fetchFavorites = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          listing_id,
          created_at,
          listings (
            id,
            address,
            city,
            state,
            zip_code,
            price,
            bedrooms,
            bathrooms,
            square_feet,
            property_type,
            listing_type,
            status,
            photos,
            agent_id
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites((data || []) as any);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      toast.error("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId);

      if (error) throw error;

      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      toast.success("Removed from favorites");
    } catch (error: any) {
      console.error("Error removing favorite:", error);
      toast.error("Failed to remove favorite");
    }
  };

  const handleSendComment = async (listingId: string, agentId: string) => {
    if (!comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      setSendingComment(true);
      
      // Get user profile for name and email
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, email, phone")
        .eq("id", user.id)
        .single();

      const senderName = profile 
        ? `${profile.first_name} ${profile.last_name}` 
        : user.email;
      const senderEmail = profile?.email || user.email;
      const senderPhone = profile?.phone || "";

      const { error } = await supabase
        .from("agent_messages")
        .insert({
          agent_id: agentId,
          listing_id: listingId,
          sender_name: senderName,
          sender_email: senderEmail,
          sender_phone: senderPhone,
          message: comment,
        });

      if (error) throw error;

      toast.success("Comment sent to agent");
      setComment("");
      setCommentDialogOpen(null);
    } catch (error: any) {
      console.error("Error sending comment:", error);
      toast.error("Failed to send comment");
    } finally {
      setSendingComment(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getListingBadge = (listingType: string) => {
    switch (listingType) {
      case "for_sale":
        return <Badge className="bg-success">For Sale</Badge>;
      case "for_rent":
        return <Badge className="bg-blue-500">For Rent</Badge>;
      case "private_sale":
        return <Badge className="bg-purple-500">Private Sale</Badge>;
      default:
        return null;
    }
  };

  const getMainPhoto = (photos: any[]) => {
    if (!photos || photos.length === 0) return "/placeholder.svg";
    return photos[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading favorites...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Heart className="h-8 w-8 fill-current text-red-500" />
                My Favorites
              </h1>
              <p className="text-muted-foreground">
                Manage your favorite properties so you don't lose track of them.
              </p>
            </div>
          </div>

          {/* Favorites Count */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Favorites ({favorites.length})
            </h2>
          </div>

          {/* Favorites Grid */}
          {favorites.length === 0 ? (
            <Card className="p-12 border-l-4 border-l-primary">
              <div className="text-center">
                <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start browsing properties and save your favorites to keep track of them.
                </p>
                <Button onClick={() => navigate("/browse")}>Browse Properties</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite) => {
                const listing = favorite.listings;
                return (
                  <Card key={favorite.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
                    <div className="relative">
                      <img
                        src={getMainPhoto(listing.photos)}
                        alt={listing.address}
                        className="w-full h-48 object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                        onClick={() => navigate(`/consumer-property/${listing.id}`)}
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                        {getListingBadge(listing.listing_type)}
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-3 left-3"
                        onClick={() => handleRemoveFavorite(favorite.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <CardContent className="p-4">
                      <div className="mb-3">
                        <h3 className="text-2xl font-bold text-primary mb-1">
                          {formatPrice(listing.price)}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{listing.address}, {listing.city}, {listing.state} {listing.zip_code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        {listing.bedrooms && (
                          <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            <span>{listing.bedrooms} beds</span>
                          </div>
                        )}
                        {listing.bathrooms && (
                          <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            <span>{listing.bathrooms} baths</span>
                          </div>
                        )}
                        {listing.square_feet && (
                          <div className="flex items-center gap-1">
                            <Square className="w-4 h-4" />
                            <span>{listing.square_feet} sqft</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => navigate(`/consumer-property/${listing.id}`)}
                        >
                          View Details
                        </Button>
                        
                        <Dialog 
                          open={commentDialogOpen === listing.id} 
                          onOpenChange={(open) => {
                            setCommentDialogOpen(open ? listing.id : null);
                            if (!open) setComment("");
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="icon">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Comment on Property</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Send a comment or question to the listing agent
                                </p>
                                <Textarea
                                  placeholder="Enter your comment or question..."
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  rows={4}
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setCommentDialogOpen(null);
                                    setComment("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleSendComment(listing.id, listing.agent_id)}
                                  disabled={sendingComment || !comment.trim()}
                                >
                                  Send Comment
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
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

export default Favorites;
