import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FavoriteButtonProps {
  listingId: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline";
  className?: string;
}

const FavoriteButton = ({ listingId, size = "lg", variant = "secondary", className = "" }: FavoriteButtonProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("listing_id", listingId)
          .maybeSingle();
        
        setIsFavorite(!!data);
      }
    };

    checkFavoriteStatus();
  }, [listingId]);

  const handleToggleFavorite = async () => {
    if (!userId) {
      toast.error("Please sign in to save favorites");
      return;
    }

    setLoading(true);
    try {
      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("listing_id", listingId);

        if (error) throw error;
        
        setIsFavorite(false);
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: userId,
            listing_id: listingId,
          });

        if (error) throw error;
        
        setIsFavorite(true);
        toast.success("Added to favorites");
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      disabled={loading}
      className={`gap-2 ${className}`}
    >
      <Heart className={`w-4 h-4 ${isFavorite ? "fill-current text-red-500" : ""}`} />
      {isFavorite ? "Saved" : "Save"}
    </Button>
  );
};

export default FavoriteButton;
