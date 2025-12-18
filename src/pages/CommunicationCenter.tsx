import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Send, 
  Users, 
  Eye, 
  MousePointer, 
  Info,
  Calendar,
  Filter,
  Loader2
} from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { EmailDetailDrawer } from "@/components/communication-center/EmailDetailDrawer";
import { SendEmailDialog } from "@/components/communication-center/SendEmailDialog";
import { SectionCard } from "@/components/ui/section-card";
import { PageHeader } from "@/components/ui/page-header";

interface Campaign {
  id: string;
  subject: string;
  message: string;
  sent_at: string;
  recipient_count: number;
  opens: number;
  clicks: number;
  unique_opens: number;
  unique_clicks: number;
}

const CommunicationCenter = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<string>("30");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCampaigns();
  }, [dateFilter]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const daysAgo = parseInt(dateFilter) || 30;
      const startDate = subDays(new Date(), daysAgo).toISOString();

      // Get campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("agent_id", user.id)
        .gte("sent_at", startDate)
        .order("sent_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Get analytics for each campaign
      const campaignsWithAnalytics = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
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

          const { data: opens } = await supabase
            .from("email_opens")
            .select("email_send_id")
            .in("email_send_id", sendIds);

          const uniqueOpens = new Set(opens?.map(o => o.email_send_id) || []).size;

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
      toast.error("Failed to load email history");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDrawerOpen(true);
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (searchTerm && !campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const totalSent = campaigns.reduce((sum, c) => sum + c.recipient_count, 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + c.unique_opens, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.unique_clicks, 0);
  const avgOpenRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : "0";
  const avgClickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20">
        <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">
          {/* Page Header */}
          <PageHeader
            title="Communication Center"
            subtitle="Send targeted listing emails to users based on their saved preferences. Replies go to your email inbox."
            className="mb-6"
            actions={
              <Button onClick={() => setSendDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            }
          />

          {/* Info Banner */}
          <SectionCard 
            icon={<Info className="h-5 w-5" />}
          >
            <div className="text-sm">
              <p className="font-medium text-foreground">This is an outbound email hub, not an inbox.</p>
              <p className="text-muted-foreground mt-1">
                Replies to your emails will be delivered directly to your email address (Gmail/Outlook), not back into DirectConnectMLS.
              </p>
            </div>
          </SectionCard>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SectionCard className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Mail className="h-4 w-4" />
                Total Sent
              </div>
              <div className="text-2xl font-bold">{totalSent}</div>
            </SectionCard>

            <SectionCard className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Users className="h-4 w-4" />
                Campaigns
              </div>
              <div className="text-2xl font-bold">{campaigns.length}</div>
            </SectionCard>

            <SectionCard className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Eye className="h-4 w-4" />
                Avg Open Rate
              </div>
              <div className="text-2xl font-bold">{avgOpenRate}%</div>
            </SectionCard>

            <SectionCard className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <MousePointer className="h-4 w-4" />
                Avg Click Rate
              </div>
              <div className="text-2xl font-bold">{avgClickRate}%</div>
            </SectionCard>
          </div>

          {/* Email Log Section */}
          <SectionCard 
            title="Email Log"
            rightSlot={
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Input 
                    placeholder="Search by subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[200px] h-9 pl-3 pr-3 text-sm"
                  />
                </div>
                
                {/* Date Filter */}
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No emails sent yet</p>
                  <p className="text-sm mt-1">Click "Send Email" to get started</p>
                </div>
              ) : (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/50">
                        <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date/Time</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</TableHead>
                        <TableHead className="w-[120px] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipients</TableHead>
                        <TableHead className="w-[100px] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opens</TableHead>
                        <TableHead className="w-[100px] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clicks</TableHead>
                        <TableHead className="w-[100px] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((campaign) => (
                        <TableRow 
                          key={campaign.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors group"
                          onClick={() => handleRowClick(campaign)}
                        >
                          <TableCell className="text-sm text-muted-foreground relative">
                            {/* Left indicator rail for visual anchor */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                            {format(new Date(campaign.sent_at), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground max-w-[300px] truncate">
                            {campaign.subject}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-medium bg-muted text-foreground">
                              {campaign.recipient_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-foreground">
                              {campaign.unique_opens}
                            </span>
                            {campaign.recipient_count > 0 && (
                              <span className="text-muted-foreground text-xs ml-1">
                                ({((campaign.unique_opens / campaign.recipient_count) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-foreground">
                              {campaign.unique_clicks}
                            </span>
                            {campaign.recipient_count > 0 && (
                              <span className="text-muted-foreground text-xs ml-1">
                                ({((campaign.unique_clicks / campaign.recipient_count) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                            >
                              Sent
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </SectionCard>
        </div>
      </main>

      {/* Email Detail Drawer */}
      <EmailDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        campaign={selectedCampaign}
        onResend={() => {
          setDrawerOpen(false);
          setSendDialogOpen(true);
        }}
      />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        onSuccess={loadCampaigns}
      />
    </div>
  );
};

export default CommunicationCenter;
