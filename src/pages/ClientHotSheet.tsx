import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageSquare, ChevronDown, ChevronUp, Settings, Send } from "lucide-react";
import { toast } from "sonner";

interface Listing {
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
  description: string | null;
}

const ClientHotSheet = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [hotSheet, setHotSheet] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Edit criteria state
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");

  useEffect(() => {
    if (token) {
      fetchHotSheet();
    }
  }, [token]);

  const fetchHotSheet = async () => {
    try {
      setLoading(true);

      // Get hot sheet by access token
      const { data: hotSheetData, error: hotSheetError } = await supabase
        .from("hot_sheets")
        .select("*, clients(*)")
        .eq("access_token", token)
        .single();

      if (hotSheetError) throw hotSheetError;
      setHotSheet(hotSheetData);

      // Load criteria into form
      const criteria: any = hotSheetData.criteria || {};
      setPropertyTypes(criteria.propertyTypes || []);
      setMinPrice(criteria.minPrice?.toString() || "");
      setMaxPrice(criteria.maxPrice?.toString() || "");
      setBedrooms(criteria.bedrooms?.toString() || "");
      setBathrooms(criteria.bathrooms?.toString() || "");
      setCity(criteria.city || "");
      setZipCode(criteria.zipCode || "");

      // Fetch matching listings
      let query = supabase
        .from("listings")
        .select("*")
        .eq("status", "active");

      if (criteria.propertyTypes && Array.isArray(criteria.propertyTypes) && criteria.propertyTypes.length > 0) {
        query = query.in("property_type", criteria.propertyTypes);
      }
      if (criteria.minPrice) query = query.gte("price", criteria.minPrice);
      if (criteria.maxPrice) query = query.lte("price", criteria.maxPrice);
      if (criteria.bedrooms) query = query.gte("bedrooms", criteria.bedrooms);
      if (criteria.bathrooms) query = query.gte("bathrooms", criteria.bathrooms);
      if (criteria.city) query = query.ilike("city", `%${criteria.city}%`);
      if (criteria.zipCode) query = query.eq("zip_code", criteria.zipCode);

      const { data: listingsData, error: listingsError } = await query.order("created_at", { ascending: false });

      if (listingsError) throw listingsError;
      setListings(listingsData || []);

      // Fetch favorites
      const { data: favData } = await supabase
        .from("hot_sheet_favorites")
        .select("listing_id")
        .eq("hot_sheet_id", hotSheetData.id);

      setFavorites(new Set(favData?.map(f => f.listing_id) || []));

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("hot_sheet_comments")
        .select("*")
        .eq("hot_sheet_id", hotSheetData.id);

      const commentsMap: Record<string, string> = {};
      commentsData?.forEach(c => {
        commentsMap[c.listing_id] = c.comment;
      });
      setComments(commentsMap);
    } catch (error: any) {
      console.error("Error loading hot sheet:", error);
      toast.error("Failed to load hot sheet");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (listingId: string) => {
    try {
      const isFavorite = favorites.has(listingId);

      if (isFavorite) {
        const { error } = await supabase
          .from("hot_sheet_favorites")
          .delete()
          .eq("hot_sheet_id", hotSheet.id)
          .eq("listing_id", listingId);

        if (error) throw error;

        setFavorites(prev => {
          const newFavs = new Set(prev);
          newFavs.delete(listingId);
          return newFavs;
        });
        toast.success("Removed from favorites");
      } else {
        const { error } = await supabase
          .from("hot_sheet_favorites")
          .insert({
            hot_sheet_id: hotSheet.id,
            listing_id: listingId,
          });

        if (error) throw error;

        setFavorites(prev => new Set([...prev, listingId]));
        toast.success("Added to favorites");
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite");
    }
  };

  const handleSendComment = async (listingId: string) => {
    const commentText = newComment[listingId]?.trim();
    if (!commentText) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      // Check if comment already exists
      const { data: existing } = await supabase
        .from("hot_sheet_comments")
        .select("id")
        .eq("hot_sheet_id", hotSheet.id)
        .eq("listing_id", listingId)
        .maybeSingle();

      if (existing) {
        // Update existing comment
        const { error } = await supabase
          .from("hot_sheet_comments")
          .update({ comment: commentText })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new comment
        const { error } = await supabase
          .from("hot_sheet_comments")
          .insert({
            hot_sheet_id: hotSheet.id,
            listing_id: listingId,
            comment: commentText,
          });

        if (error) throw error;
      }

      setComments(prev => ({ ...prev, [listingId]: commentText }));
      setNewComment(prev => ({ ...prev, [listingId]: "" }));
      toast.success("Comment sent to agent");
    } catch (error: any) {
      console.error("Error sending comment:", error);
      toast.error("Failed to send comment");
    }
  };

  const handleUpdateCriteria = async () => {
    try {
      const updatedCriteria = {
        propertyTypes: propertyTypes.length > 0 ? propertyTypes : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        city: city || null,
        zipCode: zipCode || null,
      };

      const { error } = await supabase
        .from("hot_sheets")
        .update({ criteria: updatedCriteria })
        .eq("id", hotSheet.id);

      if (error) throw error;

      toast.success("Search criteria updated");
      setEditDialogOpen(false);
      fetchHotSheet(); // Refresh listings with new criteria
    } catch (error: any) {
      console.error("Error updating criteria:", error);
      toast.error("Failed to update criteria");
    }
  };

  const propertyTypeOptions = [
    { value: "single_family", label: "Single Family" },
    { value: "condo", label: "Condo" },
    { value: "multi_family", label: "Multi Family" },
    { value: "townhouse", label: "Townhouse" },
  ];

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading hot sheet...</p>
        </main>
      </div>
    );
  }

  if (!hotSheet) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Card className="p-8">
            <p className="text-muted-foreground">Hot sheet not found</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">{hotSheet.name}</h1>
              <p className="text-muted-foreground">
                {hotSheet.clients && `For: ${hotSheet.clients.first_name} ${hotSheet.clients.last_name}`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {listings.length} matching {listings.length === 1 ? 'property' : 'properties'}
              </p>
            </div>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Edit Search
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Search Criteria</DialogTitle>
                  <DialogDescription>
                    Update your search preferences to refine matching properties
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Property Types</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyTypeOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-pt-${option.value}`}
                            checked={propertyTypes.includes(option.value)}
                            onCheckedChange={() => togglePropertyType(option.value)}
                          />
                          <Label htmlFor={`edit-pt-${option.value}`} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-min-price">Min Price</Label>
                      <Input
                        id="edit-min-price"
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-max-price">Max Price</Label>
                      <Input
                        id="edit-max-price"
                        type="number"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-bedrooms">Min Bedrooms</Label>
                      <Input
                        id="edit-bedrooms"
                        type="number"
                        placeholder="Any"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-bathrooms">Min Bathrooms</Label>
                      <Input
                        id="edit-bathrooms"
                        type="number"
                        step="0.5"
                        placeholder="Any"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-city">City</Label>
                      <Input
                        id="edit-city"
                        placeholder="Any"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-zip">Zip Code</Label>
                      <Input
                        id="edit-zip"
                        placeholder="Any"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateCriteria}>
                      Update Search
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Listings Grid */}
          {listings.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground">No properties match your criteria yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search criteria to see more results.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden">
                  <div className="relative aspect-video bg-muted">
                    {listing.photos && listing.photos[0] ? (
                      <img 
                        src={listing.photos[0]} 
                        alt={listing.address}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No photo</p>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => toggleFavorite(listing.id)}
                    >
                      <Heart 
                        className={`h-4 w-4 ${favorites.has(listing.id) ? 'fill-red-500 text-red-500' : ''}`}
                      />
                    </Button>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">${listing.price?.toLocaleString()}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {listing.address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {listing.city}, {listing.state} {listing.zip_code}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(listing.bedrooms || listing.bathrooms || listing.square_feet) && (
                      <div className="text-sm text-muted-foreground">
                        {listing.bedrooms && `${listing.bedrooms} beds`}
                        {listing.bathrooms && ` • ${listing.bathrooms} baths`}
                        {listing.square_feet && ` • ${listing.square_feet.toLocaleString()} sqft`}
                      </div>
                    )}

                    {/* Comment Section */}
                    <div className="space-y-2">
                      {comments[listing.id] && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Your comment:</p>
                          <p className="text-sm">{comments[listing.id]}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment for your agent..."
                          value={newComment[listing.id] || ""}
                          onChange={(e) => setNewComment(prev => ({ ...prev, [listing.id]: e.target.value }))}
                          maxLength={500}
                        />
                        <Button 
                          size="icon"
                          onClick={() => handleSendComment(listing.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClientHotSheet;