import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Square, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PropertyCardProps {
  image: string;
  title: string;
  price: string;
  address: string;
  beds: number;
  baths: number;
  sqft: string;
  unitNumber?: string;
  listingId?: string;
  onFavoriteChange?: () => void;
}

const PropertyCard = ({ image, title, price, address, beds, baths, sqft, unitNumber, listingId, onFavoriteChange }: PropertyCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!listingId) {
      toast.error("Unable to favorite this property");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to favorite properties");
        return;
      }

      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);

        if (error) throw error;
        setIsFavorited(false);
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            listing_id: listingId
          });

        if (error) throw error;
        setIsFavorited(true);
        toast.success("Added to favorites");
      }
      
      onFavoriteChange?.();
    } catch (error: any) {
      toast.error("Error updating favorites: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-custom-hover transition-all duration-300 group">
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title}
          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {listingId && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={handleFavoriteClick}
            disabled={isLoading}
          >
            <Heart 
              className={`w-5 h-5 transition-all ${
                isFavorited 
                  ? "fill-red-500 text-red-500" 
                  : "text-muted-foreground"
              }`} 
            />
          </Button>
        )}
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-2xl font-bold text-primary">{price}</h3>
        </div>
        
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <p className="text-sm">{address}</p>
          </div>
          {unitNumber && (
            <Badge variant="secondary" className="w-fit text-xs">
              Unit {unitNumber}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>{beds} beds</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            <span>{baths} baths</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="w-4 h-4" />
            <span>{sqft} sqft</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PropertyCard;
