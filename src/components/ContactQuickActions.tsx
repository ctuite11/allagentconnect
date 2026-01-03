import { ListPlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { aacStyles } from "@/ui/aacStyles";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ContactQuickActionsProps {
  client: Client;
  size: "sm" | "md";
  onHotSheet: (client: Client) => void;
  onToggleFavorite: (client: Client, newValue: boolean) => void;
  stopPropagation?: boolean;
}

const ContactQuickActions = ({
  client,
  size,
  onHotSheet,
  onToggleFavorite,
  stopPropagation = false,
}: ContactQuickActionsProps) => {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const buttonSize = size === "sm" ? "sm" : "default";
  const isFavorite = client.is_favorite ?? false;

  const handleClick = (e: React.MouseEvent, action: () => void) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    action();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Hot Sheet - Primary accent */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={buttonSize}
              className="px-2"
              onClick={(e) => handleClick(e, () => onHotSheet(client))}
            >
              <ListPlus className={cn(iconSize, aacStyles.iconGreenSmall.replace(/h-\d+ w-\d+/, ""))} />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>
            <p>Create Hot Sheet</p>
          </TooltipContent>
        </Tooltip>

        {/* Favorite - Muted when off, accent when on */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={buttonSize}
              className="px-2"
              onClick={(e) => handleClick(e, () => onToggleFavorite(client, !isFavorite))}
            >
              <Star
                className={cn(
                  iconSize,
                  isFavorite
                    ? aacStyles.iconGreenFill
                    : aacStyles.iconMuted
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>
            <p>{isFavorite ? "Remove from Favorites" : "Add to Favorites"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default ContactQuickActions;
