import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Bed, Bath, Square, Heart, Building2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncStickyFromDB } from "@/utils/agentTracking";
import { useUserRole } from "@/hooks/useUserRole";

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
  agentId?: string;
  agentName?: string;
  agentCompany?: string;
  agentPhoto?: string;
  agentPhone?: string;
  agentEmail?: string;
}

const PropertyCard = ({ image, title, price, address, beds, baths, sqft, unitNumber, listingId, onFavoriteChange, agentId, agentName, agentCompany, agentPhoto, agentPhone, agentEmail }: PropertyCardProps) => {
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [clientPrimaryAgent, setClientPrimaryAgent] = useState<any>(null);
  const { role } = useUserRole(currentUser);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      // Check if user is a client with a primary agent (DB is source of truth)
      if (user && role !== 'agent') {
        const agentId = await syncStickyFromDB();
        
        if (agentId) {
          const { data: agentData } = await supabase
            .from("agent_profiles")
            .select("*")
            .eq("id", agentId)
            .maybeSingle();
          
          if (agentData) {
            setClientPrimaryAgent(agentData);
          }
        }
      }
    };
    
    loadUser();
  }, [role]);

  const checkFavoriteStatus = async () => {
    if (!listingId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("listing_id", listingId)
        .single();

      setIsFavorited(!!data);
    } catch (error) {
      // Not favorited or error
    }
  };

  useEffect(() => {
    checkFavoriteStatus();
  }, [listingId]);

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
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <img 
          src={image} 
          alt={title}
          className="w-full h-48 object-cover"
        />
        {listingId && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-background/90 hover:bg-background"
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
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-2xl font-bold text-primary">{price}</h3>
          {clientPrimaryAgent ? (
            // Client with primary agent - show simplified contact button
            <Button 
              variant="default" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agent/${clientPrimaryAgent.id}`, { state: { from: location.pathname + location.search } });
              }}
            >
              Ask {clientPrimaryAgent.first_name} about this home
            </Button>
          ) : (agentName || agentCompany) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (agentId) navigate(`/agent/${agentId}`, { state: { from: location.pathname + location.search } });
                    }}
                  >
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={agentPhoto} alt={agentName} />
                      <AvatarFallback className="bg-primary">
                        <svg viewBox="0 0 34 34" className="w-8 h-8 text-white" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.6667 11.3333H11.3333V22.6667H22.6667V11.3333Z"/><path d="M2.83333 26.9167C2.83333 29.2542 4.74583 31.1667 7.08333 31.1667C9.42083 31.1667 11.3333 29.2542 11.3333 26.9167V22.6667H7.08333C4.74583 22.6667 2.83333 24.5792 2.83333 26.9167Z"/><path d="M7.08333 2.83333C4.74583 2.83333 2.83333 4.74583 2.83333 7.08333C2.83333 9.42083 4.74583 11.3333 7.08333 11.3333H11.3333V7.08333C11.3333 4.74583 9.42083 2.83333 7.08333 2.83333Z"/><path d="M31.1667 7.08333C31.1667 4.74583 29.2542 2.83333 26.9167 2.83333C24.5792 2.83333 22.6667 4.74583 22.6667 7.08333V11.3333H26.9167C29.2542 11.3333 31.1667 9.42083 31.1667 7.08333Z"/><path d="M26.9167 22.6667H22.6667V26.9167C22.6667 29.2542 24.5792 31.1667 26.9167 31.1667C29.2542 31.1667 31.1667 29.2542 31.1667 26.9167C31.1667 24.5792 29.2542 22.6667 26.9167 22.6667Z"/></svg>
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      {agentName && (
                        <span className="text-xs font-semibold text-foreground truncate">{agentName}</span>
                      )}
                      {agentCompany && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{agentCompany}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold">{agentName}</p>
                    {agentCompany && (
                      <p className="text-sm text-muted-foreground">{agentCompany}</p>
                    )}
                    {agentPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4" />
                        <span>{agentPhone}</span>
                      </div>
                    )}
                    {agentEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4" />
                        <span>{agentEmail}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
        
        {/* Listing broker attribution for compliance */}
        {!clientPrimaryAgent && (agentName || agentCompany) && (
          <p className="text-xs text-muted-foreground mb-3">
            Listing courtesy of {agentName || agentCompany}
          </p>
        )}
        
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
