import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Phone, Mail, MessageSquare, MapPin, Building2, CheckCircle2, Star } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const contactMessageSchema = z.object({
  sender_name: z.string().trim().min(1, "Please enter your name").max(100),
  sender_email: z.string().trim().email("Invalid email address").max(255),
  sender_phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
  subject: z.string().trim().min(1, "Please enter a subject").max(200),
});

interface AgentDirectoryCardProps {
  agent: {
    id: string;
    first_name: string;
    last_name: string;
    title?: string;
    company?: string;
    email: string;
    phone?: string;
    cell_phone?: string;
    headshot_url?: string;
    office_name?: string;
    office_city?: string;
    office_state?: string;
    buyer_incentives?: string;
    updated_at?: string;
    created_at?: string;
    social_links?: {
      website?: string;
      instagram?: string;
      linkedin?: string;
    };
    activeListingsCount?: number;
    comingSoonCount?: number;
    offMarketCount?: number;
    last12MonthsSales?: number;
    buyerMatchCount?: number;
    serviceAreas?: string[];
    specialties?: string[];
  };
  isAgentMode: boolean;
  onMessage?: (agentId: string) => void;
  agentIndex?: number;
}

const AgentDirectoryCard = ({ agent, isAgentMode, onMessage, agentIndex = 999 }: AgentDirectoryCardProps) => {
  const navigate = useNavigate();
  const fullName = `${agent.first_name} ${agent.last_name}`;
  const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();
  const phoneNumber = agent.cell_phone || agent.phone;
  
  // Location display: prefer office city/state, fallback to primary service area
  const locationDisplay = agent.office_city && agent.office_state 
    ? `${agent.office_city}, ${agent.office_state}`
    : agent.serviceAreas?.[0] || null;

  // Verified badge logic: has photo, brokerage, location, and contact method
  const hasPhoto = !!agent.headshot_url;
  const hasBrokerage = !!(agent.company || agent.office_name);
  const hasLocation = !!locationDisplay;
  const hasContact = !!(phoneNumber || agent.email);
  const isVerified = hasPhoto && hasBrokerage && hasLocation && hasContact;
  
  // Founding Member: first 100 agents (index 0-99)
  const isFoundingMember = agentIndex < 100;

  // Contact dialog state
  const [contactOpen, setContactOpen] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactForm, setContactForm] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    subject: "",
    message: "",
  });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const openContactDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContactOpen(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactErrors({});

    try {
      const validatedData = contactMessageSchema.parse(contactForm);
      setContactLoading(true);

      await supabase.functions.invoke("send-agent-profile-contact", {
        body: {
          agentEmail: agent.email,
          agentName: fullName,
          senderName: validatedData.sender_name,
          senderEmail: validatedData.sender_email,
          senderPhone: validatedData.sender_phone,
          message: validatedData.message,
          subject: validatedData.subject,
        },
      });

      toast.success("Message sent successfully!");
      setContactOpen(false);
      setContactForm({
        sender_name: "",
        sender_email: "",
        sender_phone: "",
        subject: "",
        message: "",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setContactErrors(newErrors);
      } else {
        toast.error("Failed to send message. Please try again.");
      }
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <Card className="group overflow-hidden border bg-card transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1.5 hover:border-neutral-300">
      <div className="p-5">
        {/* Large Profile Photo with Halo Ring - NO badges on photo */}
        <div className="flex justify-center mb-4 relative">
          <div className="relative">
            {/* Halo ring */}
            <div className="absolute inset-0 rounded-full bg-muted blur-sm scale-110" />
            <Avatar className="h-24 w-24 border-2 border-border shadow-sm relative z-10 ring-2 ring-border ring-offset-2 ring-offset-background">
              <AvatarImage src={agent.headshot_url} alt={fullName} />
              <AvatarFallback className="bg-muted text-foreground font-semibold text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Full Name + Inline Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <h3 className="font-semibold text-lg text-foreground leading-tight">
            {fullName}
          </h3>
          {isVerified && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified
            </span>
          )}
          {isVerified && isFoundingMember && (
            <span className="text-muted-foreground text-xs">·</span>
          )}
          {isFoundingMember && (
            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-xs font-medium">
              <Star className="h-3.5 w-3.5 fill-current" />
              Founding Member
            </span>
          )}
        </div>

        {/* Brokerage */}
        {(agent.company || agent.office_name) && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-center">{agent.company || agent.office_name}</span>
          </div>
        )}

        {/* City, State Location */}
        {locationDisplay && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{locationDisplay}</span>
          </div>
        )}

        {/* Colored Contact Icons with Micro-Animations */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {phoneNumber && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-200/50 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900 dark:hover:shadow-emerald-900/50 transition-all duration-200 cursor-pointer"
              onClick={handlePhoneClick}
              title={formatPhoneNumber(phoneNumber)}
            >
              <Phone className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-200/50 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900 dark:hover:shadow-blue-900/50 transition-all duration-200 cursor-pointer"
            onClick={openContactDialog}
            title={agent.email}
          >
            <Mail className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-200/50 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900 dark:hover:shadow-purple-900/50 transition-all duration-200 cursor-pointer"
            onClick={openContactDialog}
            title="Send Message"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>

        {/* View Profile Button */}
        <div className="mt-5">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(`/agent/${agent.id}`)}
          >
            View Profile
          </Button>
        </div>
      </div>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Contact {fullName}</DialogTitle>
            <DialogDescription>
              Send a message to this agent about their services
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${agent.id}`}>Name</Label>
              <Input
                id={`name-${agent.id}`}
                value={contactForm.sender_name}
                onChange={(e) => setContactForm({ ...contactForm, sender_name: e.target.value })}
                placeholder="Your full name"
                maxLength={100}
              />
              {contactErrors.sender_name && <p className="text-sm text-destructive">{contactErrors.sender_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`email-${agent.id}`}>Email</Label>
              <Input
                id={`email-${agent.id}`}
                type="email"
                value={contactForm.sender_email}
                onChange={(e) => setContactForm({ ...contactForm, sender_email: e.target.value })}
                placeholder="your@email.com"
                maxLength={255}
              />
              {contactErrors.sender_email && <p className="text-sm text-destructive">{contactErrors.sender_email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`phone-${agent.id}`}>Phone</Label>
              <FormattedInput
                id={`phone-${agent.id}`}
                format="phone"
                value={contactForm.sender_phone}
                onChange={(value) => setContactForm({ ...contactForm, sender_phone: value })}
                placeholder="1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`subject-${agent.id}`}>Subject</Label>
              <Input
                id={`subject-${agent.id}`}
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="What's this about?"
                maxLength={200}
              />
              {contactErrors.subject && <p className="text-sm text-destructive">{contactErrors.subject}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`message-${agent.id}`}>Message</Label>
              <Textarea
                id={`message-${agent.id}`}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="I'm interested in working with you..."
                rows={5}
                maxLength={1000}
              />
              {contactErrors.message && <p className="text-sm text-destructive">{contactErrors.message}</p>}
              <p className="text-xs text-muted-foreground">{contactForm.message.length}/1000</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={contactLoading}>
                {contactLoading ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AgentDirectoryCard;