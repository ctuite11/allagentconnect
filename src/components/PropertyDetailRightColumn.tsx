import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Globe
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BuyerAgentShowcase } from "./BuyerAgentShowcase";
import { BuyerCompensationInfoModal } from "./BuyerCompensationInfoModal";

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

interface PropertyDetailRightColumnProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
  stats?: { matches: number; views: number };
}

export const PropertyDetailRightColumn = ({ listing, agent, isAgentView, stats }: PropertyDetailRightColumnProps) => {
  const navigate = useNavigate();

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

  // ========== AGENT VIEW: Sticky Agent Panel ==========
  if (isAgentView) {
    return (
      <div className="sticky top-24 space-y-4">
        {/* Agent Actions Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => navigate(`/agent/listings/edit/${listing.id}`)}
                className="w-full justify-start gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Listing
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/communication-center?listing=${listing.id}`)}
                className="w-full justify-start gap-2"
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

        {/* Buyer Agent Compensation - Visible to Both */}
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
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
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

        {/* Showing Instructions - Agent Only */}
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
              {listing.showing_contact_name && <DetailRow label="Showing Contact" value={listing.showing_contact_name} />}
              {listing.showing_contact_phone && <DetailRow label="Showing Phone" value={formatPhoneNumber(listing.showing_contact_phone)} />}
            </DetailGrid>
            {listing.showing_instructions && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                <p className="text-sm whitespace-pre-wrap">{listing.showing_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disclosures & Exclusions - Agent Only */}
        {(listing.disclosures || listing.listing_exclusions) && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-100">
                <FileText className="w-5 h-5" />
                Disclosures & Exclusions
                <Badge variant="outline" className="ml-auto text-xs">Agent Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {listing.disclosures && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Disclosures:</p>
                  <p className="text-sm">
                    {typeof listing.disclosures === 'string' 
                      ? listing.disclosures 
                      : formatArray(listing.disclosures) || 'None specified'}
                  </p>
                </div>
              )}
              {listing.listing_exclusions && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Exclusions:</p>
                  <p className="text-sm">{listing.listing_exclusions}</p>
                </div>
              )}
              {listing.documents && Array.isArray(listing.documents) && listing.documents.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Documents Available:</p>
                  <p className="text-sm text-primary">{listing.documents.length} document(s)</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Listing Agreement Type - Agent Only */}
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

        {/* Activity Stats - Agent Only */}
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
      </div>
    );
  }

  // ========== CLIENT/PUBLIC VIEW ==========
  return (
    <div className="space-y-6">
      {/* Listing Agent Card */}
      {agent && (
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
              <Avatar className="w-14 h-14">
                {agent.headshot_url ? (
                  <AvatarImage src={agent.headshot_url} />
                ) : (
                  <AvatarFallback className="text-lg">
                    {agent.first_name[0]}{agent.last_name[0]}
                  </AvatarFallback>
                )}
              </Avatar>
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
              <Button className="w-full">Request a Tour</Button>
              <Button variant="outline" className="w-full">Contact Agent</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buyer Agent Compensation - Public Version */}
      {compensationDisplay && (
        <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-green-600" />
              Buyer Agent Compensation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
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

      {/* Fallback if no agent */}
      {!agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interested in this property?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact the listing agent for more information or to schedule a showing.
            </p>
            <Button className="w-full">Contact Agent</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
