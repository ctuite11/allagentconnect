import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FavoriteButtonProps {
  listingId: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline";
  className?: string;
  /** Icon-only for listing photo overlays: outline / red filled, no button chrome */
  photoIcon?: boolean;
  labels?: {
    signIn?: string;
    default?: string;
    saved?: string;
  };
}

const FavoriteButton = ({
  listingId,
  size = "lg",
  variant = "secondary",
  className = "",
  photoIcon = false,
  labels,
}: FavoriteButtonProps) => {
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
      // DCMLS host → consumer signup flow; AAC host → agent auth surface
      const { isDcmlsHost } = await import("@/lib/host");
      if (isDcmlsHost()) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/consumer/auth?mode=signup&from=${encodeURIComponent(from)}`;
      } else {
        toast.error("Please sign in to save favorites");
      }
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

  const getButtonText = () => {
    if (!userId) return labels?.signIn || "Sign In to Save";
    return isFavorite ? labels?.saved || "Saved" : labels?.default || "Save";
  };

  const favoriteTooltipText = isFavorite ? "Added to favorites" : "Add to favorites";

  if (photoIcon && size === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            disabled={loading}
            className={cn(
              "h-9 w-9 min-h-0 min-w-0 rounded-sm p-0 gap-0 bg-transparent border-0 shadow-none",
              "hover:bg-transparent",
              isFavorite
                ? "hover:scale-[1.12] active:scale-105"
                : "hover:scale-110 active:scale-95",
              "transition-transform duration-200",
              "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0",
              className,
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={cn(
                "h-7 w-7 shrink-0",
                isFavorite
                  ? "fill-[#FF2D55] text-[#FF2D55]"
                  : "fill-transparent text-white stroke-white stroke-2 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.85))]",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{favoriteTooltipText}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleToggleFavorite}
          disabled={loading}
          className={cn("gap-2", className)}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("w-4 h-4", isFavorite && "fill-current text-destructive")} />
          {size !== "icon" && getButtonText()}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{favoriteTooltipText}</TooltipContent>
    </Tooltip>
  );
};

export default FavoriteButton;
