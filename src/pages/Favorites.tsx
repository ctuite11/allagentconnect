import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
// Navigation removed - rendered globally in App.tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, BedDouble, Bath, Ruler, Heart } from "lucide-react";
import { toast } from "sonner";
import FavoriteButton from "@/components/FavoriteButton";

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

interface FavoritesProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

const Favorites = ({
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: FavoritesProps) => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<Set<string>>(new Set());
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToEmail, setShareToEmail] = useState("");
  const [shareSubject, setShareSubject] = useState("Share selected listings");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const buyerMode = isBuyerMode || (!isAgentMode && !isPublicMode);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(buyerMode ? "Please sign in to view your saved homes" : "Please sign in to view favorites");
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
      toast.error(buyerMode ? "Failed to load your saved homes" : "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getMainPhoto = (photos: any[]) => {
    if (!photos || photos.length === 0) return "/placeholder.svg";
    const p = photos[0];
    if (typeof p === "string") return p;
    if (p && typeof p === "object") return (p as { url?: string }).url ?? "/placeholder.svg";
    return "/placeholder.svg";
  };

  const sortedFavorites = useMemo(() => {
    const next = [...favorites];
    if (sortBy === "price_asc") {
      next.sort((a, b) => (a.listings?.price || 0) - (b.listings?.price || 0));
      return next;
    }
    if (sortBy === "price_desc") {
      next.sort((a, b) => (b.listings?.price || 0) - (a.listings?.price || 0));
      return next;
    }
    next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return next;
  }, [favorites, sortBy]);

  const selectedFavorites = useMemo(
    () => sortedFavorites.filter((fav) => selectedFavoriteIds.has(fav.id)),
    [sortedFavorites, selectedFavoriteIds],
  );

  const toggleSelectFavorite = (favoriteId: string) => {
    setSelectedFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(favoriteId)) next.delete(favoriteId);
      else next.add(favoriteId);
      return next;
    });
  };

  const shareSelected = useCallback(() => {
    if (selectedFavorites.length === 0) return;
    setShareSubject(`Share selected listings (${selectedFavorites.length})`);
    setShareMessage("Here are some listings I wanted to share:");
    setShareModalOpen(true);
  }, [selectedFavorites]);

  const handleSendShareEmail = useCallback(() => {
    const run = async () => {
      if (!shareToEmail.trim() || !shareSubject.trim() || !shareMessage.trim()) {
        toast.error("Please fill in To email, Subject, and Message");
        return;
      }

      setShareSending(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (!authUser) {
          toast.error("You must be logged in to send email");
          return;
        }

        const recipientEmail = shareToEmail.trim();
        const recipientName = recipientEmail.split("@")[0] || "Recipient";

        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        const aacPrimaryCta = "#0E56F5";
        const sharePhotoH = 150;
        const shareImgColW = 240;

        const listingCardsHtml = selectedFavorites
          .map((fav) => {
            const listing = fav.listings;
            const listingUrl = `${window.location.origin}/property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const address = escapeHtml(listing.address || "Address unavailable");
            const cityStateZip = escapeHtml(
              `${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim(),
            );
            const photoUrl = getMainPhoto(listing.photos || []);
            const safePhoto = photoUrl ? escapeHtml(photoUrl) : "";
            return [
              `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:14px 0;background:#ffffff;box-shadow:0 1px 6px rgba(17,24,39,0.06);">`,
              `<tr>`,
              `<td width="${shareImgColW}" style="width:${shareImgColW}px;vertical-align:top;background:#f3f4f6;padding:0;">`,
              safePhoto
                ? `<a href="${listingUrl}" style="text-decoration:none;"><img src="${safePhoto}" alt="${address}" width="${shareImgColW}" height="${sharePhotoH}" style="display:block;width:${shareImgColW}px;max-width:100%;height:${sharePhotoH}px;object-fit:cover;object-position:center;border:0;line-height:0;font-size:0;" /></a>`
                : `<div style="box-sizing:border-box;width:${shareImgColW}px;height:${sharePhotoH}px;line-height:${sharePhotoH}px;text-align:center;background:#f3f4f6;color:#6b7280;font-size:12px;overflow:hidden;">Photo unavailable</div>`,
              `</td>`,
              `<td style="padding:16px 18px;vertical-align:top;">`,
              `<div style="font-size:22px;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(price)}</div>`,
              `<div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${address}</div>`,
              `<div style="margin-top:4px;font-size:13px;color:#6b7280;line-height:1.35;">${cityStateZip}</div>`,
              `<div style="margin-top:16px;"><a href="${listingUrl}" style="display:inline-block;background-color:${aacPrimaryCta};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">View listing</a></div>`,
              `</td>`,
              `</tr>`,
              `</table>`,
            ].join("");
          })
          .join("");

        const plainTextFallback = selectedFavorites
          .map((fav) => {
            const listing = fav.listings;
            const listingUrl = `${window.location.origin}/property/${listing.id}`;
            const price = listing.price ? `$${listing.price.toLocaleString()}` : "Price unavailable";
            const address = `${listing.address || ""}, ${listing.city || ""}, ${listing.state || ""} ${listing.zip_code || ""}`.trim();
            return `- ${address} - ${price} - ${listingUrl}`;
          })
          .join("\n");

        const htmlBody = `
          <div style="font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6;">
            <p style="margin:0 0 12px 0;white-space:pre-wrap;">${escapeHtml(shareMessage)}</p>
            ${listingCardsHtml}
          </div>
        `;

        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            to: recipientEmail,
            recipientName,
            subject: shareSubject.trim(),
            htmlBody,
            textBody: `${shareMessage}\n\n${plainTextFallback}`,
            fromName: user?.email || "All Agent Connect",
          },
        });
        if (error) throw error;

        toast.success("Listings shared successfully");
        setShareModalOpen(false);
        setShareToEmail("");
      } catch (err: any) {
        console.error("Share email failed", err);
        toast.error(err?.message || "Failed to send email");
      } finally {
        setShareSending(false);
      }
    };
    void run();
  }, [selectedFavorites, shareToEmail, shareSubject, shareMessage, user, shareSending]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col pt-20">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">{buyerMode ? "Loading your saved homes..." : "Loading favorites..."}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col pt-14 md:pt-16">
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 py-6 md:py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#111827]">
              {buyerMode ? "Your Saved Homes" : "My Favorites"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {buyerMode
                ? "Review the listings you have saved to revisit later."
                : "Manage your favorite properties so you don't lose track of them."}
            </p>
          </div>

          {/* Favorites Count */}
          <div>
            <h2 className="text-sm font-medium text-gray-600 mt-6">
              {buyerMode ? `Saved Homes (${favorites.length})` : `Favorites (${favorites.length})`}
            </h2>
          </div>

          {/* Favorites Grid */}
          {favorites.length === 0 ? (
            <Card className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(15,23,42,0.08)] p-8 md:p-10 text-center">
              <div className="text-center">
                <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">{buyerMode ? "No saved homes yet" : "No favorites yet"}</h3>
                <p className="text-muted-foreground mb-6">
                  {buyerMode
                    ? "Start browsing homes and save the ones you want to revisit."
                    : "Start browsing properties and save your favorites to keep track of them."}
                </p>
                <Button className="px-5 py-2 text-sm" onClick={() => navigate("/browse")}>
                  {buyerMode ? "Browse Homes" : "Browse Properties"}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-md px-2.5 text-xs"
                    onClick={() =>
                      setSelectedFavoriteIds((prev) =>
                        prev.size === sortedFavorites.length
                          ? new Set()
                          : new Set(sortedFavorites.map((fav) => fav.id)),
                      )
                    }
                  >
                    {selectedFavoriteIds.size === sortedFavorites.length ? "Unselect all" : "Select all"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-md px-2.5 text-xs"
                    onClick={shareSelected}
                    disabled={selectedFavorites.length === 0}
                  >
                    Share selected
                  </Button>
                </div>
                <div className="w-44 min-w-0 shrink-0 sm:w-52">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="h-8 rounded-md border-zinc-200/80 text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="price_asc">Price low to high</SelectItem>
                      <SelectItem value="price_desc">Price high to low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedFavorites.map((favorite) => {
                const listing = favorite.listings;
                const isSelected = selectedFavoriteIds.has(favorite.id);
                return (
                  <div
                    key={favorite.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/property/${listing.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/property/${listing.id}`);
                      }
                    }}
                    className={`group w-full rounded-[24px] bg-white overflow-hidden text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 transition-all duration-200 ease-out transform-gpu ${
                      isSelected
                        ? "ring-2 ring-[#0E56F5]/50 shadow-[0_8px_28px_rgba(14,86,245,0.18)]"
                        : "shadow-[0_2px_8px_rgba(15,23,42,0.07)] ring-1 ring-zinc-200/80 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] hover:ring-zinc-300/80"
                    }`}
                  >
                    <div className="relative w-full overflow-hidden bg-zinc-100" style={{ aspectRatio: "16/10" }}>
                      <img
                        src={getMainPhoto(listing.photos)}
                        alt={listing.address}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/55 via-white/15 to-transparent pointer-events-none" />
                      <div
                        className="absolute top-2 left-2 z-20 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectFavorite(favorite.id)}
                          className="h-5 w-5 border-zinc-300 bg-white/90 data-[state=checked]:border-[#0E56F5] data-[state=checked]:bg-[#0E56F5]"
                          aria-label={isSelected ? "Unselect listing" : "Select listing"}
                        />
                      </div>
                      <div
                        className="absolute top-2 right-2 z-20 max-w-[calc(100%-6.5rem)] flex min-h-0 items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FavoriteButton
                          listingId={listing.id}
                          size="icon"
                          photoIcon
                          className="!h-7 !w-7 !min-w-0 p-0 [&>svg]:!h-6 [&>svg]:!w-6"
                        />
                      </div>
                    </div>
                    <div className="relative border-t border-zinc-200/45 bg-gradient-to-b from-white via-white to-[#fbfcff] px-3.5 pb-3.5 pt-3">
                      <p className="text-[1.05rem] font-semibold tracking-[-0.02em] leading-none text-zinc-950">
                        {formatPrice(listing.price)}
                      </p>
                      <p className="mt-1.5 text-[13px] font-medium leading-[1.3] text-zinc-900 break-words">
                        {listing.address}
                      </p>
                      <p className="mt-1 text-[11.5px] font-medium leading-[1.35] text-zinc-500">
                        <MapPin className="mr-1 inline h-3.5 w-3.5 align-[-1px]" />
                        {listing.city}, {listing.state} {listing.zip_code}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-medium leading-none text-zinc-600">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                          <BedDouble className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                          {listing.bedrooms ?? "--"} bd
                        </span>
                        <span className="text-zinc-300">•</span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                          <Bath className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                          {listing.bathrooms ?? "--"} ba
                        </span>
                        <span className="text-zinc-300">•</span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
                          <Ruler className="h-[13px] w-[13px] text-zinc-500" strokeWidth={2.1} />
                          {listing.square_feet ? `${listing.square_feet.toLocaleString()} sqft` : "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </main>

      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Share selected listings</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-to-email">To email</Label>
                <Input
                  id="share-to-email"
                  type="email"
                  placeholder="name@example.com"
                  value={shareToEmail}
                  onChange={(e) => setShareToEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-subject">Subject</Label>
                <Input
                  id="share-subject"
                  value={shareSubject}
                  onChange={(e) => setShareSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-message">Message</Label>
                <Textarea
                  id="share-message"
                  className="min-h-[180px]"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShareModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSendShareEmail} disabled={shareSending}>
                Send Email
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Favorites;
