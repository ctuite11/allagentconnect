import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, Mail, DollarSign, Info, Users, Activity, Eye, Send, TrendingUp, MessageSquare } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface PropertyDetailRightColumnProps {
  listing: any;
  agent?: any;
  isAgentView: boolean;
  stats?: { matches: number; views: number };
}

export const PropertyDetailRightColumn = ({ listing, agent, isAgentView, stats }: PropertyDetailRightColumnProps) => {
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
      {/* Agent-Only: Matches & Buyers Intel Card */}
      {isAgentView && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/20 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-purple-900 dark:text-purple-100">
              <Users className="w-5 h-5" />
              Matches & Buyers
              <Badge variant="outline" className="ml-auto text-xs">Intel</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-purple-100 dark:border-purple-800">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {stats?.matches || 0}
                </div>
                <div className="text-xs text-muted-foreground">Matching Agents</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-purple-100 dark:border-purple-800">
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                  {stats?.views || 0}
                </div>
                <div className="text-xs text-muted-foreground">Total Views</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-white/50 dark:bg-white/5">
                <Eye className="w-4 h-4" />
                View Matching Agents
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-white/50 dark:bg-white/5">
                <Send className="w-4 h-4" />
                Email Matching Agents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent-Only: Activity & Engagement Card */}
      {isAgentView && (
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 dark:from-teal-950/30 dark:to-emerald-950/20 dark:border-teal-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-teal-900 dark:text-teal-100">
              <Activity className="w-5 h-5" />
              Activity & Engagement
              <Badge variant="outline" className="ml-auto text-xs">Stats</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-teal-100 dark:border-teal-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  Listing Views
                </div>
                <span className="font-semibold text-foreground">{stats?.views || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-teal-100 dark:border-teal-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="w-4 h-4" />
                  Emails Sent
                </div>
                <span className="font-semibold text-foreground">—</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-teal-100 dark:border-teal-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  Lead Inquiries
                </div>
                <span className="font-semibold text-foreground">—</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  Favorites
                </div>
                <span className="font-semibold text-foreground">—</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Buyer Agent Compensation - Agent Only */}
      {isAgentView && (listing.commission_rate || listing.commission_type || listing.commission_notes) && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-900 dark:text-green-100">
              <DollarSign className="w-5 h-5" />
              Buyer Agent Compensation
              <Badge variant="outline" className="ml-2">Agent Only</Badge>
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
          </CardContent>
        </Card>
      )}

      {/* Consumer-facing: Contact CTA when not in agent view */}
      {!isAgentView && !agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interested in this property?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact the listing agent for more information, schedule a showing, or ask about buyer agent compensation.
            </p>
            <Button className="w-full">Contact Agent</Button>
          </CardContent>
        </Card>
      )}

      {/* Office / Agent Information (Expanded) - Agent Only */}
      {isAgentView && agent && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-blue-900 dark:text-blue-100">
              Office / Agent Information
              <Badge variant="outline" className="ml-2">Agent Only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              {/* Listing Agreement Type */}
              {listing.listing_agreement_types && formatArray(listing.listing_agreement_types) && (
                <DetailRow label="Listing Agreement Type" value={formatArray(listing.listing_agreement_types)} />
              )}
              
              {/* Buyer Agent Compensation */}
              {listing.commission_rate && listing.commission_type && (
                <DetailRow 
                  label="Buyer Agent Compensation" 
                  value={
                    listing.commission_type === 'percentage' 
                      ? `${listing.commission_rate}%`
                      : `$${listing.commission_rate.toLocaleString()} flat fee`
                  } 
                />
              )}
              
              {/* Team Members - Placeholder for future */}
              <DetailRow label="Team Member(s)" value="None" />
              
              {/* Showing Instructions - Expanded */}
              <div className="py-3 border-t mt-3">
                <p className="text-sm font-semibold mb-3 text-foreground">Showing Instructions</p>
                <div className="space-y-2 pl-2">
                  <DetailRow label="Appointment Required" value={listing.appointment_required ? 'Yes' : 'No'} />
                  <DetailRow label="Entry Only" value={listing.entry_only ? 'Yes' : 'No'} />
                  {listing.showing_instructions && (
                    <div className="py-2">
                      <p className="text-xs text-muted-foreground mb-1">Instructions:</p>
                      <p className="text-sm whitespace-pre-wrap text-foreground">{listing.showing_instructions}</p>
                    </div>
                  )}
                  {listing.lockbox_code && <DetailRow label="Lockbox Code" value={listing.lockbox_code} />}
                  {listing.showing_contact_name && <DetailRow label="Showing Contact" value={listing.showing_contact_name} />}
                  {listing.showing_contact_phone && <DetailRow label="Showing Phone" value={formatPhoneNumber(listing.showing_contact_phone)} />}
                </div>
              </div>
              
              {/* Additional Comments */}
              {listing.additional_notes && (
                <div className="py-3 border-t mt-3">
                  <p className="text-sm font-semibold mb-2 text-foreground">Additional Comments</p>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90 pl-2">{listing.additional_notes}</p>
                </div>
              )}
              
              {/* Market History */}
              <div className="py-3 border-t mt-3">
                <p className="text-sm font-semibold mb-3 text-foreground">Market History</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Event</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listing.created_at && (
                        <tr className="border-b">
                          <td className="py-2 px-2 text-foreground">{new Date(listing.created_at).toLocaleDateString()}</td>
                          <td className="py-2 px-2 text-foreground">Listing Created</td>
                          <td className="py-2 px-2 text-foreground">—</td>
                        </tr>
                      )}
                      {listing.active_date && listing.active_date !== listing.created_at && (
                        <tr className="border-b">
                          <td className="py-2 px-2 text-foreground">{new Date(listing.active_date).toLocaleDateString()}</td>
                          <td className="py-2 px-2 text-foreground">Status Changed</td>
                          <td className="py-2 px-2 text-foreground">Active</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className="py-2 px-2 text-xs text-muted-foreground italic">
                          Additional history will appear as changes are made
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </DetailGrid>
          </CardContent>
        </Card>
      )}

      {/* Agent-Only: Showing Instructions (Original - Keep for Non-Expanded View) */}
      {isAgentView && !agent && (
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
