import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { usNeighborhoodsByCityState } from "@/data/usNeighborhoodsData";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
  categoryTitle: string;
  defaultSubject?: string;
}

export const SendMessageDialog = ({ open, onOpenChange, category, categoryTitle, defaultSubject }: SendMessageDialogProps) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  
  // Additional fields for buyer_need and renter_need
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");

  // Set default subject when dialog opens
  useEffect(() => {
    if (open && defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [open, defaultSubject]);

  const showLocationFields = category === "buyer_need" || category === "renter_need";
  
  // Get available counties and cities based on selection
  const availableCounties = state ? COUNTIES_BY_STATE[state] || [] : [];
  const availableCities = state 
    ? (county && hasCountyCityMapping(state) 
        ? getCitiesForCounty(state, county) 
        : usCitiesByState[state] || [])
    : [];
  const availableNeighborhoods = (city && state) 
    ? usNeighborhoodsByCityState[`${city}-${state}`] || [] 
    : [];

  // Reset dependent fields when state, county, or city changes
  const handleStateChange = (newState: string) => {
    setState(newState);
    setCounty("");
    setCity("");
    setNeighborhood("");
  };

  const handleCountyChange = (newCounty: string) => {
    setCounty(newCounty);
    setCity("");
    setNeighborhood("");
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    setNeighborhood("");
  };

  const fetchRecipientCount = async () => {
    setLoadingCount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch agents with this preference enabled (excluding self)
      const query = supabase
        .from("notification_preferences")
        .select("user_id")
        .neq("user_id", user.id);

      // Type assertion to handle dynamic column name
      const { data, error } = await (query as any).eq(category, true);

      if (error) throw error;

      setRecipientCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching recipient count:", error);
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecipientCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (showLocationFields && !state) {
      toast.error("Please select a state");
      return;
    }

    setSending(true);
    try {
      const requestBody: any = {
        category,
        subject: subject.trim(),
        message: message.trim(),
      };

      // Add location and price criteria for buyer_need and renter_need
      if (showLocationFields) {
        requestBody.criteria = {
          state,
          county: county.trim() || undefined,
          city: city.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          propertyType: propertyType || undefined,
        };
      }

      const { data, error } = await supabase.functions.invoke("send-client-need-notification", {
        body: requestBody,
      });

      if (error) throw error;

      if (data?.recipientCount === 0) {
        toast.info("No agents match the specified criteria");
      } else {
        toast.success(
          `Message sent successfully to ${data.successCount} agent${data.successCount !== 1 ? "s" : ""}!`
        );
      }

      onOpenChange(false);
      setSubject("");
      setMessage("");
      setState("");
      setCounty("");
      setCity("");
      setNeighborhood("");
      setMinPrice("");
      setMaxPrice("");
      setPropertyType("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Send {categoryTitle} Message</DialogTitle>
          <DialogDescription>
            Compose your message to send to agents interested in {categoryTitle.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        
        {/* Recipient Count Preview */}
        {!loadingCount && recipientCount !== null && (
          <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {recipientCount === 0 ? (
                "No agents will receive this message"
              ) : (
                <>
                  This message will be sent to <strong className="text-foreground">{recipientCount}</strong> agent{recipientCount !== 1 ? "s" : ""}
                </>
              )}
            </span>
          </div>
        )}
        <div className="space-y-4 py-4">
          {showLocationFields && (
            <>
              {/* Location Fields */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-sm font-medium">Location & Price Criteria</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={state} onValueChange={handleStateChange}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state && availableCounties.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="county">County (Optional)</Label>
                    <Select value={county} onValueChange={handleCountyChange}>
                      <SelectTrigger id="county">
                        <SelectValue placeholder="Select county" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCounties.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {state && availableCities.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="city">City/Town (Optional)</Label>
                    <Select value={city} onValueChange={handleCityChange}>
                      <SelectTrigger id="city">
                        <SelectValue placeholder="Select city or town" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {city && availableNeighborhoods.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Neighborhood/Area (Optional)</Label>
                    <Select value={neighborhood} onValueChange={setNeighborhood}>
                      <SelectTrigger id="neighborhood">
                        <SelectValue placeholder="Select neighborhood" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableNeighborhoods.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="propertyType">Property Type (Optional)</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger id="propertyType">
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_family">Single Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="multi_family">Multi Family</SelectItem>
                      <SelectItem value="land">Land</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Min Price (Optional)</Label>
                    <Input
                      id="minPrice"
                      type="number"
                      placeholder="100000"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Max Price (Optional)</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      placeholder="500000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Message Fields */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
