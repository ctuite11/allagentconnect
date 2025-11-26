import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, Mail, DollarSign, Info } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface PropertyDetailRightColumnProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
}

export const PropertyDetailRightColumn = ({ listing, agent, isAgentView }: PropertyDetailRightColumnProps) => {
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

  // Format arrays for display
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

  return (
    <div className="space-y-6">
      {/* Listing Agent Card */}
      {agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Listing Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                {agent.headshot_url ? (
                  <AvatarImage src={agent.headshot_url} />
                ) : (
                  <AvatarFallback>
                    {agent.first_name[0]}{agent.last_name[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {agent.first_name} {agent.last_name}
                </p>
                {agent.title && (
                  <p className="text-sm text-muted-foreground">{agent.title}</p>
                )}
                {agent.company && (
                  <p className="text-sm text-muted-foreground">{agent.company}</p>
                )}
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
                  <span>
                    {formatPhoneNumber(agent.cell_phone || agent.phone)}
                  </span>
                </a>
              )}
              {agent.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="break-all">{agent.email}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buyer Agent Compensation */}
      {(listing.commission_rate || listing.commission_type || listing.commission_notes) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5" />
              Buyer Agent Compensation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {listing.commission_rate && listing.commission_type && (
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {listing.commission_type === 'percentage' 
                      ? `${listing.commission_rate}%`
                      : `$${listing.commission_rate.toLocaleString()}`
                    }
                  </p>
                </div>
              )}
              {listing.commission_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-foreground/90">{listing.commission_notes}</p>
                </div>
              )}
            </div>
            {!isAgentView && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                Ask your agent for details
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Office / Agent Information */}
      {agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Office & Agent Information</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Listing Agent" value={`${agent.first_name} ${agent.last_name}`} />
              {agent.title && <DetailRow label="Title" value={agent.title} />}
              {agent.company && <DetailRow label="Company" value={agent.company} />}
              {agent.office_name && <DetailRow label="Office" value={agent.office_name} />}
              {agent.office_phone && <DetailRow label="Office Phone" value={formatPhoneNumber(agent.office_phone)} />}
              {agent.office_address && <DetailRow label="Office Address" value={agent.office_address} />}
              {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                <DetailRow label="Agreement Type" value={formatArray(listing.listing_agreement_types)} />
              )}
            </DetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Agent-Only: Showing Instructions */}
      {isAgentView && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100 text-lg">
              <Info className="w-5 h-5" />
              Showing Instructions
              <Badge variant="outline" className="ml-2">Agent Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Appointment Required" value={listing.appointment_required ? 'Yes' : 'No'} />
              <DetailRow label="Entry Only" value={listing.entry_only ? 'Yes' : 'No'} />
              {listing.showing_instructions && (
                <div className="py-2 border-t mt-2">
                  <p className="text-sm font-medium mb-1">Instructions:</p>
                  <p className="text-sm whitespace-pre-wrap">{listing.showing_instructions}</p>
                </div>
              )}
              {listing.lockbox_code && <DetailRow label="Lockbox Code" value={listing.lockbox_code} />}
              {listing.showing_contact_name && <DetailRow label="Contact Name" value={listing.showing_contact_name} />}
              {listing.showing_contact_phone && <DetailRow label="Contact Phone" value={listing.showing_contact_phone} />}
            </DetailGrid>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

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
