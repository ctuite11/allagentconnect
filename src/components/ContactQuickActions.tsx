import { ListPlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
}

interface ContactQuickActionsProps {
  client: Client;
  size: "sm" | "md";
  onHotSheet: (client: Client) => void;
  onViewFavorites: (client: Client) => void;
  stopPropagation?: boolean;
}

const ContactQuickActions = ({
  client,
  size,
  onHotSheet,
  onViewFavorites,
  stopPropagation = false,
}: ContactQuickActionsProps) => {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const buttonSize = size === "sm" ? "sm" : "default";

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
              <ListPlus className={cn(iconSize, "text-emerald-600")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>
            <p>Create Hot Sheet</p>
          </TooltipContent>
        </Tooltip>

        {/* View Favorites - Navigate to client's favorites */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={buttonSize}
              className="px-2"
              onClick={(e) => handleClick(e, () => onViewFavorites(client))}
            >
              <Star className={cn(iconSize, "text-emerald-600")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>
            <p>View Favorites</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default ContactQuickActions;
