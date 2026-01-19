import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LoadingScreen } from "@/components/LoadingScreen";
import { toast } from "sonner";
import { 
  Search, 
  Phone, 
  Calendar, 
  Archive, 
  Eye, 
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore, startOfToday } from "date-fns";
import { AddOutcomeDialog } from "@/components/admin/AddOutcomeDialog";
import { SetFollowupDialog } from "@/components/admin/SetFollowupDialog";
import { ArchiveMatchDialog } from "@/components/admin/ArchiveMatchDialog";

// Outcome display config
const OUTCOME_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-slate-100 text-slate-700", icon: <Clock className="h-3 w-3" /> },
  no_response: { label: "No Response", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
  not_a_fit: { label: "Not a Fit", color: "bg-gray-100 text-gray-600", icon: <XCircle className="h-3 w-3" /> },
  connected: { label: "Connected", color: "bg-blue-100 text-blue-700", icon: <MessageSquare className="h-3 w-3" /> },
  showing_scheduled: { label: "Showing Scheduled", color: "bg-indigo-100 text-indigo-700", icon: <Calendar className="h-3 w-3" /> },
  offer_submitted: { label: "Offer Submitted", color: "bg-purple-100 text-purple-700", icon: <CheckCircle className="h-3 w-3" /> },
  offer_accepted: { label: "Offer Accepted", color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" /> },
  closed_won: { label: "Closed (Won)", color: "bg-green-100 text-green-700", icon: <CheckCircle className="h-3 w-3" /> },
  closed_lost: { label: "Closed (Lost)", color: "bg-red-100 text-red-700", icon: <XCircle className="h-3 w-3" /> },
  duplicate: { label: "Duplicate", color: "bg-gray-100 text-gray-500", icon: <Archive className="h-3 w-3" /> },
  invalid: { label: "Invalid", color: "bg-red-50 text-red-600", icon: <XCircle className="h-3 w-3" /> },
};

interface SellerMatch {
  id: string;
  submission_id: string;
  agent_id: string;
  delivery_id: string | null;
  contact_attempts: number;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  last_contact_note: string | null;
  next_followup_at: string | null;
  followup_reason: string | null;
  latest_outcome: string;
  latest_outcome_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  created_at: string;
  // Joined data
  submission: {
    address: string;
    city: string;
    state: string;
    asking_price: number;
    seller_name: string | null;
    seller_email: string;
    property_type: string;
    bedrooms: number;
    bathrooms: number;
  };
  agent: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    brokerage: string | null;
  };
  delivery: {
    viewed_at: string | null;
    responded_at: string | null;
    notified_agent_at: string | null;
  } | null;
}

type FilterStatus = "all" | "unreported" | "reported" | "followup_due" | "archived";
type SortField = "created_at" | "latest_outcome_at" | "next_followup_at" | "contact_attempts";

export default function AdminMatches() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [matches, setMatches] = useState<SellerMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  
  // Dialog states
  const [selectedMatch, setSelectedMatch] = useState<SellerMatch | null>(null);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [followupDialogOpen, setFollowupDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Check admin access
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: hasAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!hasAdminRole) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await fetchMatches();
      setLoading(false);
    }

    checkAdmin();
  }, [navigate]);

  async function fetchMatches() {
    const { data, error } = await supabase
      .from("seller_matches")
      .select(`
        *,
        submission:agent_match_submissions(
          address, city, state, asking_price, seller_name, seller_email, property_type, bedrooms, bathrooms
        ),
        agent:profiles!seller_matches_agent_id_fkey(
          id, first_name, last_name, email
        ),
        delivery:agent_match_deliveries(
          viewed_at, responded_at, notified_agent_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching matches:", error);
      toast.error("Failed to load matches");
      return;
    }

    const enrichedMatches = (data || []).map(match => ({
      ...match,
      agent: {
        ...(match.agent as any),
        brokerage: null, // Brokerage lookup can be added later if needed
      },
      delivery: Array.isArray(match.delivery) ? match.delivery[0] || null : match.delivery,
    }));

    setMatches(enrichedMatches as SellerMatch[]);
  }

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    let result = [...matches];

    // Apply status filter
    if (statusFilter === "unreported") {
      result = result.filter(m => m.latest_outcome === "pending" && !m.archived_at);
    } else if (statusFilter === "reported") {
      result = result.filter(m => m.latest_outcome !== "pending" && !m.archived_at);
    } else if (statusFilter === "followup_due") {
      const today = startOfToday();
      result = result.filter(m => 
        m.next_followup_at && 
        isBefore(new Date(m.next_followup_at), today) && 
        !m.archived_at
      );
    } else if (statusFilter === "archived") {
      result = result.filter(m => m.archived_at);
    } else {
      result = result.filter(m => !m.archived_at);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.submission?.address?.toLowerCase().includes(q) ||
        m.submission?.city?.toLowerCase().includes(q) ||
        m.agent?.first_name?.toLowerCase().includes(q) ||
        m.agent?.last_name?.toLowerCase().includes(q) ||
        m.agent?.email?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "created_at":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "latest_outcome_at":
          aVal = a.latest_outcome_at ? new Date(a.latest_outcome_at).getTime() : 0;
          bVal = b.latest_outcome_at ? new Date(b.latest_outcome_at).getTime() : 0;
          break;
        case "next_followup_at":
          aVal = a.next_followup_at ? new Date(a.next_followup_at).getTime() : Infinity;
          bVal = b.next_followup_at ? new Date(b.next_followup_at).getTime() : Infinity;
          break;
        case "contact_attempts":
          aVal = a.contact_attempts;
          bVal = b.contact_attempts;
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }

      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [matches, statusFilter, searchQuery, sortField, sortAsc]);

  // Stats
  const stats = useMemo(() => {
    const active = matches.filter(m => !m.archived_at);
    const pending = active.filter(m => m.latest_outcome === "pending");
    const reported = active.filter(m => m.latest_outcome !== "pending");
    const closed = active.filter(m => ["closed_won", "closed_lost"].includes(m.latest_outcome));
    const won = active.filter(m => m.latest_outcome === "closed_won");

    return {
      total: active.length,
      pending: pending.length,
      reported: reported.length,
      conversionRate: closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0,
    };
  }, [matches]);

  // Mark contacted action
  async function handleMarkContacted(match: SellerMatch) {
    const { error } = await supabase
      .from("seller_matches")
      .update({
        contact_attempts: match.contact_attempts + 1,
        last_contacted_at: new Date().toISOString(),
        first_contacted_at: match.first_contacted_at || new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      toast.error("Failed to mark as contacted");
      return;
    }

    toast.success("Marked as contacted");
    fetchMatches();
  }

  // Toggle sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
            <Button onClick={() => navigate("/")} className="mt-4">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PageHeader
        title="Match Tracker"
        subtitle="Track seller-agent match outcomes"
      />

      <div className="container py-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Matches</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending / Unreported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.reported}</div>
              <div className="text-sm text-muted-foreground">Reported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.conversionRate}%</div>
              <div className="text-sm text-muted-foreground">Conversion Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address or agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Active</SelectItem>
              <SelectItem value="unreported">Unreported</SelectItem>
              <SelectItem value="reported">Reported</SelectItem>
              <SelectItem value="followup_due">Follow-up Due</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchMatches}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center gap-1">
                    Created
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Delivery Signals</TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("contact_attempts")}
                >
                  <div className="flex items-center gap-1">
                    Contact
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("next_followup_at")}
                >
                  <div className="flex items-center gap-1">
                    Follow-up
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No matches found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((match) => {
                  const outcomeConfig = OUTCOME_CONFIG[match.latest_outcome] || OUTCOME_CONFIG.pending;
                  const isFollowupDue = match.next_followup_at && 
                    isBefore(new Date(match.next_followup_at), new Date());

                  return (
                    <TableRow key={match.id} className={match.archived_at ? "opacity-50" : ""}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(match.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{match.submission?.address}</div>
                        <div className="text-sm text-muted-foreground">
                          {match.submission?.city}, {match.submission?.state} • ${match.submission?.asking_price?.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {match.agent?.first_name} {match.agent?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {match.agent?.brokerage || match.agent?.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {match.delivery?.notified_agent_at && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-blue-500" />
                              <span>Notified {formatDistanceToNow(new Date(match.delivery.notified_agent_at), { addSuffix: true })}</span>
                            </div>
                          )}
                          {match.delivery?.viewed_at && (
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-green-500" />
                              <span>Viewed {formatDistanceToNow(new Date(match.delivery.viewed_at), { addSuffix: true })}</span>
                            </div>
                          )}
                          {match.delivery?.responded_at && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                              <span>Responded</span>
                            </div>
                          )}
                          {!match.delivery?.notified_agent_at && !match.delivery?.viewed_at && (
                            <span className="text-muted-foreground">No signals</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{match.contact_attempts}</span> attempts
                        </div>
                        {match.last_contacted_at && (
                          <div className="text-xs text-muted-foreground">
                            Last: {formatDistanceToNow(new Date(match.last_contacted_at), { addSuffix: true })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${outcomeConfig.color} gap-1`}>
                          {outcomeConfig.icon}
                          {outcomeConfig.label}
                        </Badge>
                        {match.latest_outcome_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(match.latest_outcome_at), { addSuffix: true })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.next_followup_at ? (
                          <div className={isFollowupDue ? "text-red-600" : ""}>
                            <div className="text-sm font-medium">
                              {format(new Date(match.next_followup_at), "MMM d, h:mm a")}
                            </div>
                            {match.followup_reason && (
                              <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {match.followup_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkContacted(match)}
                            title="Mark contacted"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMatch(match);
                              setOutcomeDialogOpen(true);
                            }}
                            title="Add outcome"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMatch(match);
                              setFollowupDialogOpen(true);
                            }}
                            title="Set follow-up"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMatch(match);
                              setArchiveDialogOpen(true);
                            }}
                            title={match.archived_at ? "Unarchive" : "Archive"}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialogs */}
      <AddOutcomeDialog
        open={outcomeDialogOpen}
        onOpenChange={setOutcomeDialogOpen}
        match={selectedMatch}
        onSuccess={fetchMatches}
      />

      <SetFollowupDialog
        open={followupDialogOpen}
        onOpenChange={setFollowupDialogOpen}
        match={selectedMatch}
        onSuccess={fetchMatches}
      />

      <ArchiveMatchDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        match={selectedMatch}
        onSuccess={fetchMatches}
      />
    </div>
  );
}
