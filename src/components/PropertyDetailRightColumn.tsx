import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Mail, 
  DollarSign, 
  KeyRound, 
  FileText, 
  ClipboardList,
  Activity, 
  Edit2, 
  Copy, 
  Send,
  Calendar,
  Globe,
  MessageSquare
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { BuyerAgentShowcase } from "./BuyerAgentShowcase";
import { BuyerCompensationInfoModal } from "./BuyerCompensationInfoModal";
import { useAuthRole } from "@/hooks/useAuthRole";
import { buildMessageReturnState } from "@/lib/messageNavigation";
import {
  ListingMessageDialog,
  listingMessageRecipientFromProfile,
} from "@/components/ListingMessageDialog";
import { canMessageListingAgent as viewerCanMessageListingAgent } from "@/lib/canMessageListingAgent";
import { syncStickyFromDB } from "@/utils/agentTracking";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

interface PropertyDetailRightColumnProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
  stats?: { matches: number; views: number };
}

export const PropertyDetailRightColumn = ({ listing, agent, isAgentView, stats }: PropertyDetailRightColumnProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuthRole();
  const [listingMessageOpen, setListingMessageOpen] = useState(false);
  const [listingMessageVariant, setListingMessageVariant] = useState<"agent" | "buyer">("agent");
  
  // Can current user message the listing agent?
  const viewerId = user?.id;
  const listingAgentId = agent?.id;
  const canMessageListingAgent = viewerCanMessageListingAgent(viewerId, listingAgentId);

  const openAgentListingMessage = () => {
    if (!viewerId) {
      navigate("/auth");
      return;
    }
    if (!listingAgentId) {
      toast.error("No listing agent is available to message.");
      return;
    }
    setListingMessageVariant("agent");
    setListingMessageOpen(true);
  };

  const DetailRow = ({ label, value }: { label: string; value: any }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between py-2 border-b last:border-0">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="font-medium text-right text-sm text-foreground">{value}</span>
      </div>
    );
  };

  const DetailGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-0">{children}</div>
  );

  const formatArray = (arr: any[] | null | undefined) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  };

  const getCompensationDisplay = () => {
    if (!listing.commission_rate) return null;
    if (listing.commission_type === 'percentage') {
      return `${listing.commission_rate}%`;
    }
    return `$${listing.commission_rate.toLocaleString()}`;
  };

  const handleCopyConsumerLink = () => {
    const url = `${window.location.origin}/property/${listing.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Consumer link copied!");
  };

  const compensationDisplay = getCompensationDisplay();

  // ========== Sticky agent resolution for buyer masking ==========
  const [stickyAgent, setStickyAgent] = useState<{ id: string; first_name: string; last_name: string; headshot_url: string | null; company: string | null; email: string; phone: string | null; cell_phone: string | null } | null>(null);
  const [stickyLoaded, setStickyLoaded] = useState(false);
  const isBuyer = role === "buyer" && !isAgentView;

  const listingMessageRecipient =
    listingMessageVariant === "agent" && agent
      ? listingMessageRecipientFromProfile(agent)
      : listingMessageVariant === "buyer" && stickyAgent
        ? listingMessageRecipientFromProfile(stickyAgent)
        : null;

  const listingMessageDialog = listing?.id ? (
    <ListingMessageDialog
      open={listingMessageOpen}
      onOpenChange={setListingMessageOpen}
      listingId={listing.id}
      variant={listingMessageVariant}
      recipient={listingMessageRecipient}
      role={role}
      returnState={buildMessageReturnState(location.pathname, location.search)}
    />
  ) : null;

  useEffect(() => {
    if (!isBuyer || isAgentView) {
      setStickyLoaded(true);
      return;
    }
    const resolve = async () => {
      const agentId = await syncStickyFromDB();
      if (agentId) {
        const { data } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, headshot_url, company, email, phone, cell_phone")
          .eq("id", agentId)
          .maybeSingle();
        if (data) setStickyAgent(data);
      }
      setStickyLoaded(true);
    };
    resolve();
  }, [isBuyer, isAgentView]);

  // ========== AGENT VIEW: Sticky Agent Panel ==========
  if (isAgentView) {
    return (
      <div className="sticky top-24 space-y-4">
        {/* 1. Listing Agent Contact Card */}
        {agent && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <AgentAvatar
                  name={`${agent.first_name} ${agent.last_name}`}
                  headshotUrl={agent.headshot_url ?? null}
                  userId={agent.id}
                  size="lg"
                  avatarClassName="w-12 h-12"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base">
                    {agent.first_name} {agent.last_name}
                  </p>
                  {agent.title && <p className="text-xs text-muted-foreground">{agent.title}</p>}
                  <p className="text-xs text-muted-foreground">{agent.company || "Brokerage"}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                {(agent.cell_phone || agent.phone) && (
                  <a href={`tel:${agent.cell_phone || agent.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{formatPhoneNumber(agent.cell_phone || agent.phone)}</span>
                  </a>
                )}
                {agent.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="break-all">{agent.email}</span>
                  </div>
                )}
                {agent.social_links?.website && (
                  <a href={agent.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Visit Website</span>
                  </a>
                )}
              </div>
              {canMessageListingAgent && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={openAgentListingMessage}
                >
                  <MessageSquare className="w-4 h-4" />
                  Message about this listing
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* 2. Agent Actions Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => navigate(`/agent/listings/edit/${listing.id}`, { state: { from: location.pathname + location.search } })}
                className="w-full justify-start gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Listing
              </Button>
              <Button
                variant="outline"
                disabled
                className="w-full justify-start gap-2 opacity-50 cursor-not-allowed"
                title="Coming soon in Communications Center"
              >
                <Send className="w-4 h-4" />
                Send to Matching Agents
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyConsumerLink}
                className="w-full justify-start gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Consumer Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Showing Instructions - Agent Only */}
        <Card className="border-border bg-muted/50 dark:bg-muted/20 border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <KeyRound className="w-5 h-5 text-primary" />
              Showing Instructions
              <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">Agent Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailGrid>
              <DetailRow label="Appointment Required" value={listing.appointment_required ? 'Yes' : 'No'} />
              <DetailRow label="Entry Only" value={listing.entry_only ? 'Yes' : 'No'} />
              {listing.lockbox_code && <DetailRow label="Lockbox Code" value={listing.lockbox_code} />}
            </DetailGrid>
            {listing.showing_instructions && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                <p className="text-sm whitespace-pre-wrap">{listing.showing_instructions}</p>
              </div>
            )}
            {canMessageListingAgent && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-2"
                onClick={openAgentListingMessage}
              >
                <Phone className="w-3.5 h-3.5" />
                Contact Listing Agent
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 4. Disclosures - Agent Only */}
        {listing.disclosures && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-100">
                <FileText className="w-5 h-5" />
                Disclosures
                <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Disclosures:</p>
                <p className="text-sm">
                  {typeof listing.disclosures === 'string' 
                    ? listing.disclosures 
                    : formatArray(listing.disclosures) || 'None specified'}
                </p>
              </div>
              {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Documents Available:</p>
                  <p className="text-sm text-primary">{listing.documents.length} document(s)</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 5. Listing Agreement Type - Agent Only */}
        {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
          <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-purple-900 dark:text-purple-100">
                <ClipboardList className="w-5 h-5" />
                Listing Agreement
                <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{formatArray(listing.listing_agreement_types)}</p>
            </CardContent>
          </Card>
        )}

        {/* 6. Activity Stats - Agent Only */}
        <Card className="border-teal-200 bg-teal-50/50 dark:bg-teal-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-teal-900 dark:text-teal-100">
              <Activity className="w-5 h-5" />
              Activity & Stats
              <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border">
                <div className="text-xl font-bold text-teal-700 dark:text-teal-300">
                  {stats?.matches || 0}
                </div>
                <div className="text-xs text-muted-foreground">Matches</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border">
                <div className="text-xl font-bold text-teal-700 dark:text-teal-300">
                  {stats?.views || 0}
                </div>
                <div className="text-xs text-muted-foreground">Views</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Buyer Agent Compensation - Moved to bottom */}
        {compensationDisplay && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-green-900 dark:text-green-100">
                <DollarSign className="w-5 h-5" />
                Buyer Agent Compensation
              </CardTitle>
              <p className="text-xs text-muted-foreground">Visible to consumers</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {compensationDisplay}
              </p>
              {listing.commission_notes && (
                <p className="text-sm text-foreground/80 mt-2 border-t pt-2">
                  {listing.commission_notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {listingMessageDialog}
      </div>
    );
  }

  // ========== CLIENT/PUBLIC VIEW ==========

  // Loading guard — prevent listing-agent flash while sticky resolves
  if (isBuyer && !stickyLoaded) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-14 w-14 rounded-full mx-auto mb-4" />
            <Skeleton className="h-4 w-32 mx-auto mb-2" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const openBuyerListingMessage = () => {
    if (!viewerId) {
      navigate("/auth");
      return;
    }
    setListingMessageVariant("buyer");
    setListingMessageOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Agent Card — three-way branch */}
      {isBuyer && stickyAgent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
               <AgentAvatar
                  name={`${stickyAgent.first_name} ${stickyAgent.last_name}`}
                  headshotUrl={stickyAgent.headshot_url}
                  userId={stickyAgent.id}
                  size="xl"
                  avatarClassName="w-14 h-14"
                />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg">
                  {stickyAgent.first_name} {stickyAgent.last_name}
                </p>
                {stickyAgent.company && (
                  <p className="text-sm text-muted-foreground">{stickyAgent.company}</p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              {(stickyAgent.cell_phone || stickyAgent.phone) && (
                <a
                  href={`tel:${stickyAgent.cell_phone || stickyAgent.phone}`}
                  className="flex items-center gap-3 text-sm hover:text-primary transition"
                >
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{formatPhoneNumber(stickyAgent.cell_phone || stickyAgent.phone)}</span>
                </a>
              )}
              {stickyAgent.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="break-all">{stickyAgent.email}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <Button className="w-full" onClick={openBuyerListingMessage}>
                {`Message ${stickyAgent.first_name}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isBuyer ? (
        /* Generic fallback — buyer has no sticky agent, still hide listing agent */
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <AgentAvatar
              name="?"
              headshotUrl={null}
              showPresence={false}
              size="xl"
              avatarClassName="w-14 h-14"
              className="mx-auto"
            />
            <p className="font-semibold text-lg">Need help with this property?</p>
            <p className="text-sm text-muted-foreground">
              Message your agent through the platform for details or to schedule a showing.
            </p>
            <Button className="w-full" onClick={openBuyerListingMessage}>
              Message Your Agent
            </Button>
          </CardContent>
        </Card>
      ) : agent && (
        <Card>
          {/* Logo Section - Top of Panel */}
          <div className="p-4 border-b flex justify-center">
            <div className="w-32 h-16 flex items-center justify-center">
              <img
                src={agent.logo_url || DEFAULT_BROKERAGE_LOGO_URL}
                alt={`${agent.company || 'Brokerage'} logo`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BROKERAGE_LOGO_URL;
                }}
              />
            </div>
          </div>
          
          {/* Brokerage Name under logo */}
          <div className="px-4 pt-3 pb-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {agent.company || "Brokerage"}
            </p>
          </div>

          <CardHeader className="pt-2">
            <CardTitle className="text-lg">Listing Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
               <AgentAvatar
                  name={`${agent.first_name} ${agent.last_name}`}
                  headshotUrl={agent.headshot_url ?? null}
                  userId={agent.id}
                  size="xl"
                  avatarClassName="w-14 h-14"
                />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg">
                  {agent.first_name} {agent.last_name}
                </p>
                {agent.title && (
                  <p className="text-sm text-muted-foreground">{agent.title}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {agent.company || "Brokerage"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              {(agent.cell_phone || agent.phone) && (
                <a
                  href={`tel:${agent.cell_phone || agent.phone}`}
                  className="flex items-center gap-3 text-sm hover:text-primary transition"
                >
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{formatPhoneNumber(agent.cell_phone || agent.phone)}</span>
                </a>
              )}
              {agent.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="break-all">{agent.email}</span>
                </div>
              )}
              {/* Agent Website */}
              {agent.social_links?.website && (
                <a
                  href={agent.social_links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-primary hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  <span>Visit Website</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button className="w-full" onClick={openAgentListingMessage}>
                Request a Tour
              </Button>
              <Button variant="outline" className="w-full" onClick={openAgentListingMessage}>
                Contact Agent
              </Button>
            </div>

            {canMessageListingAgent && (
              <Button
                variant="outline"
                className="w-full mt-2 gap-2"
                onClick={openAgentListingMessage}
              >
                <MessageSquare className="w-4 h-4" />
                {listing?.id ? "Message about this listing" : "Message"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buyer Agent Compensation - Public Version */}
      {compensationDisplay && (
        <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Buyer Agent Compensation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {compensationDisplay}
              </p>
              <BuyerCompensationInfoModal compensationDisplay={compensationDisplay} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This is the compensation offered by the listing brokerage to a buyer's agent.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Buyer Agent Showcase */}
      <BuyerAgentShowcase 
        listingZip={listing.zip_code} 
        listingId={listing.id} 
      />

      {/* ATTRIBUTION MASKING: No "Contact listing agent" fallback.
          Buyers redirect to /consumer-property/:id; non-agents see agent-only UI. */}
      {listingMessageDialog}
    </div>
  );
};
