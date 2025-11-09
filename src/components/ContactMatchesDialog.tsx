import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ContactMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchCount: number;
  filters: {
    stateFilter: string;
    cityFilter: string;
    propertyTypeFilter: string;
    minPriceFilter: string;
    maxPriceFilter: string;
    startDate?: Date;
    endDate?: Date;
  };
}

export function ContactMatchesDialog({
  open,
  onOpenChange,
  matchCount,
  filters,
}: ContactMatchesDialogProps) {
  const [sending, setSending] = useState(false);
  const [listingAddress, setListingAddress] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [message, setMessage] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (!agentName.trim() || !agentEmail.trim()) {
      toast.error("Please enter your name and email");
      return;
    }

    try {
      setSending(true);

      // Fetch matching client needs
      let query = supabase
        .from("client_needs")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply same filters as the dashboard
      if (filters.stateFilter) {
        query = query.eq("state", filters.stateFilter);
      }
      if (filters.cityFilter) {
        query = query.ilike("city", `%${filters.cityFilter}%`);
      }
      if (filters.propertyTypeFilter && filters.propertyTypeFilter.trim()) {
        query = query.eq("property_type", filters.propertyTypeFilter as any);
      }
      if (filters.minPriceFilter) {
        query = query.gte("max_price", parseFloat(filters.minPriceFilter));
      }
      if (filters.maxPriceFilter) {
        query = query.lte("max_price", parseFloat(filters.maxPriceFilter));
      }
      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate.toISOString());
      }
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data: clientNeeds, error } = await query;

      if (error) throw error;

      if (!clientNeeds || clientNeeds.length === 0) {
        toast.error("No matching client needs found");
        return;
      }

      // Get unique emails from client needs (from profiles)
      const userIds = [...new Set(clientNeeds.map(need => need.submitted_by))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Call edge function to send emails
      const { error: sendError } = await supabase.functions.invoke("send-reverse-prospecting", {
        body: {
          recipients: profiles,
          agentName,
          agentEmail,
          agentPhone: agentPhone || null,
          message,
          listingAddress: listingAddress || null,
          listingPrice: listingPrice || null,
          filters: {
            state: filters.stateFilter,
            city: filters.cityFilter,
            propertyType: filters.propertyTypeFilter,
          },
        },
      });

      if (sendError) throw sendError;

      toast.success(`Message sent to ${profiles?.length || 0} potential buyers!`);
      onOpenChange(false);
      
      // Reset form
      setListingAddress("");
      setListingPrice("");
      setMessage("");
      setAgentName("");
      setAgentEmail("");
      setAgentPhone("");
    } catch (error: any) {
      console.error("Error sending messages:", error);
      toast.error("Failed to send messages: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact {matchCount} Potential Buyers</DialogTitle>
          <DialogDescription>
            Send a personalized message to all buyers whose needs match your listing criteria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agentName">Your Name *</Label>
              <Input
                id="agentName"
                placeholder="John Doe"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="agentEmail">Your Email *</Label>
              <Input
                id="agentEmail"
                type="email"
                placeholder="agent@example.com"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agentPhone">Your Phone (Optional)</Label>
            <FormattedInput
              id="agentPhone"
              format="phone"
              placeholder="5555555555"
              value={agentPhone}
              onChange={(value) => setAgentPhone(value)}
            />
          </div>

          <div>
            <Label htmlFor="listingAddress">Listing Address (Optional)</Label>
            <Input
              id="listingAddress"
              placeholder="123 Main St, Boston, MA"
              value={listingAddress}
              onChange={(e) => setListingAddress(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="listingPrice">Listing Price (Optional)</Label>
            <Input
              id="listingPrice"
              placeholder="$500,000"
              value={listingPrice}
              onChange={(e) => setListingPrice(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="message">Your Message *</Label>
            <Textarea
              id="message"
              placeholder="Hello! I have a property that matches your criteria..."
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Introduce yourself and your listing. Be professional and concise.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              `Send to ${matchCount} Buyers`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
