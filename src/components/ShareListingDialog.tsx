import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShareListingDialogProps {
  listingId: string;
  listingAddress: string;
}

export const ShareListingDialog = ({ listingId, listingAddress }: ShareListingDialogProps) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadAgentProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('first_name, last_name, email, cell_phone, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        setAgentName(`${profile.first_name} ${profile.last_name}`);
        setAgentEmail(profile.email);
        setAgentPhone(profile.cell_phone || profile.phone || '');
      }
    };

    if (open) {
      loadAgentProfile();
    }
  }, [open]);

  const handleShare = async () => {
    if (!recipientName || !recipientEmail || !agentName || !agentEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-listing-share', {
        body: {
          listingId,
          recipientName,
          recipientEmail,
          agentName,
          agentEmail,
          agentPhone,
          message
        }
      });

      if (error) throw error;

      toast.success(`Listing shared with ${recipientName}`);
      setOpen(false);
      setRecipientName("");
      setRecipientEmail("");
      setMessage("");
    } catch (error) {
      console.error('Error sharing listing:', error);
      toast.error("Failed to share listing");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share Listing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground mb-4">
            <strong>Property:</strong> {listingAddress}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientName">Recipient Name *</Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientEmail">Recipient Email *</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Your Contact Information</h4>
            
            <div className="space-y-2">
              <Label htmlFor="agentName">Your Name *</Label>
              <Input
                id="agentName"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2 mt-3">
              <Label htmlFor="agentEmail">Your Email *</Label>
              <Input
                id="agentEmail"
                type="email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2 mt-3">
              <Label htmlFor="agentPhone">Your Phone</Label>
              <FormattedInput
                id="agentPhone"
                format="phone"
                value={agentPhone}
                onChange={(value) => setAgentPhone(value)}
                placeholder="5555555555"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message for the recipient..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={sending}>
              {sending ? "Sending..." : "Share Listing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
