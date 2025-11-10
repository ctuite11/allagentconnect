import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, MousePointer, Users } from "lucide-react";
import { format } from "date-fns";

interface EmailAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Campaign {
  id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  opens: number;
  clicks: number;
  unique_opens: number;
  unique_clicks: number;
}

export function EmailAnalyticsDialog({ open, onOpenChange }: EmailAnalyticsDialogProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadCampaigns();
    }
  }, [open]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("agent_id", user.id)
        .order("sent_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Get analytics for each campaign
      const campaignsWithAnalytics = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          // Get email sends for this campaign
          const { data: sends } = await supabase
            .from("email_sends")
            .select("id")
            .eq("campaign_id", campaign.id);

          const sendIds = sends?.map(s => s.id) || [];

          if (sendIds.length === 0) {
            return {
              ...campaign,
              opens: 0,
              clicks: 0,
              unique_opens: 0,
              unique_clicks: 0,
            };
          }

          // Get opens
          const { data: opens } = await supabase
            .from("email_opens")
            .select("email_send_id")
            .in("email_send_id", sendIds);

          const uniqueOpens = new Set(opens?.map(o => o.email_send_id) || []).size;

          // Get clicks
          const { data: clicks } = await supabase
            .from("email_clicks")
            .select("email_send_id")
            .in("email_send_id", sendIds);

          const uniqueClicks = new Set(clicks?.map(c => c.email_send_id) || []).size;

          return {
            ...campaign,
            opens: opens?.length || 0,
            clicks: clicks?.length || 0,
            unique_opens: uniqueOpens,
            unique_clicks: uniqueClicks,
          };
        })
      );

      setCampaigns(campaignsWithAnalytics);
    } catch (error: any) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load email analytics");
    } finally {
      setLoading(false);
    }
  };

  const calculateOpenRate = (campaign: Campaign) => {
    if (campaign.recipient_count === 0) return "0.0";
    return ((campaign.unique_opens / campaign.recipient_count) * 100).toFixed(1);
  };

  const calculateClickRate = (campaign: Campaign) => {
    if (campaign.recipient_count === 0) return "0.0";
    return ((campaign.unique_clicks / campaign.recipient_count) * 100).toFixed(1);
  };

  const totalSent = campaigns.reduce((sum, c) => sum + c.recipient_count, 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + c.unique_opens, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.unique_clicks, 0);
  const avgOpenRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : "0";
  const avgClickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : "0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Analytics</DialogTitle>
          <DialogDescription>
            Track the performance of your bulk email campaigns
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading analytics...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No email campaigns sent yet
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Total Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalSent}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Avg Open Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgOpenRate}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MousePointer className="h-4 w-4" />
                    Avg Click Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgClickRate}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{campaigns.length}</div>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {campaign.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(campaign.sent_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.recipient_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.unique_opens}
                        {campaign.opens > campaign.unique_opens && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({campaign.opens})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={parseFloat(calculateOpenRate(campaign)) > 20 ? "default" : "secondary"}>
                          {calculateOpenRate(campaign)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.unique_clicks}
                        {campaign.clicks > campaign.unique_clicks && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({campaign.clicks})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={parseFloat(calculateClickRate(campaign)) > 2 ? "default" : "secondary"}>
                          {calculateClickRate(campaign)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
