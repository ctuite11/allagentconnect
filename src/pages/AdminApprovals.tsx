import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdminRole } from "@/lib/auth/roles";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ExternalLink, 
  Search, 
  Pencil, 
  Trash2, 
  Mail, 
  ChevronUp, 
  ChevronDown,
  CheckCircle,
  XCircle,
  Users,
  KeyRound,
  Check
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentEditDrawer } from "@/components/admin/AgentEditDrawer";
import { DeleteAgentDialog } from "@/components/admin/DeleteAgentDialog";
import { BulkDeleteAgentsDialog } from "@/components/admin/BulkDeleteAgentsDialog";
import { EmailAgentDialog } from "@/components/admin/EmailAgentDialog";
import { CreateAgentDialog } from "@/components/admin/CreateAgentDialog";
import { UserPlus } from "lucide-react";
import { AgentStatusBadge } from "@/components/ui/status-badge";
import { AGENT_STATUS_OPTIONS, AGENT_STATUS_CONFIG, getStatusConfig } from "@/constants/status";

interface Agent {
  id: string;
  aac_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  bio: string | null;
  license_number: string | null;
  license_state: string | null;
  agent_status: string;
  verified_at: string | null;
  created_at: string;
  is_early_access?: boolean;
}

const stateLicenseLookupUrls: Record<string, string> = {
  MA: "https://www.mass.gov/orgs/board-of-registration-of-real-estate-brokers-and-salespersons",
  CT: "https://www.elicense.ct.gov/",
  RI: "https://dbr.ri.gov/divisions/commercial-licensing",
  NH: "https://www.oplc.nh.gov/real-estate-commission",
  ME: "https://www.maine.gov/pfr/professionallicensing/",
  VT: "https://sos.vermont.gov/opr/",
  NY: "https://appext20.dos.ny.gov/nydos/selSearchType.do",
  NJ: "https://newjersey.mylicense.com/verification/",
  PA: "https://www.pals.pa.gov/",
};

const stateNames: Record<string, string> = {
  MA: "Massachusetts",
  CT: "Connecticut",
  RI: "Rhode Island",
  NH: "New Hampshire",
  ME: "Maine",
  VT: "Vermont",
  NY: "New York",
  NJ: "New Jersey",
  PA: "Pennsylvania",
};

type SortField = "name" | "status" | "created_at" | "company";
type SortDirection = "asc" | "desc";

export default function AdminApprovals() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // DIAGNOSTIC: Debug state for on-page panel
  const [debugInfo, setDebugInfo] = useState<{
    profilesCount: number | null;
    profilesError: string | null;
    settingsCount: number | null;
    settingsError: string | null;
    mergedCount: number | null;
    statusDistribution: Record<string, number>;
    stateCount: number | null;
  }>({
    profilesCount: null,
    profilesError: null,
    settingsCount: null,
    settingsError: null,
    mergedCount: null,
    statusDistribution: {},
    stateCount: null,
  });
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [pendingVerifications, setPendingVerifications] = useState<Array<{
    id: string;
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    license_state: string | null;
    license_number: string | null;
    created_at: string;
  }>>([]);
  
  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Check admin role using has_role RPC - loading → allow → deny pattern
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setUser(null);
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      setUser({ id: userId, email: session?.user?.email });
      const ok = await checkIsAdminRole(userId);
      setIsAdmin(ok);
      setIsChecking(false);
    })();
  }, []);

  // Fetch all agents via edge function (bypasses RLS issues)
  const fetchAgents = async () => {
    if (!isAdmin) return;

    setLoading(true);
    
    try {
      // Use edge function for bulletproof admin data fetching
      const { data, error } = await supabase.functions.invoke('admin-list-agents');

      if (error) {
        console.error("[AdminApprovals] Edge function error:", error);
        toast.error("Failed to load agents - please refresh");
        setLoading(false);
        return;
      }

      const { agents: agentList, profilesCount, settingsCount, statusDistribution } = data;

      // DIAGNOSTIC: Log results
      console.log("[AdminApprovals] Edge function response:", {
        profilesCount,
        settingsCount,
        agentCount: agentList?.length ?? 0,
        statusDistribution,
      });
      
      // DIAGNOSTIC: Update debug state
      setDebugInfo({
        profilesCount: profilesCount ?? 0,
        profilesError: null,
        settingsCount: settingsCount ?? 0,
        settingsError: null,
        mergedCount: agentList?.length ?? 0,
        statusDistribution: statusDistribution ?? {},
        stateCount: agentList?.length ?? 0,
      });

      // Check for settings mismatch and warn
      if (profilesCount > 0 && settingsCount < profilesCount) {
        const missing = profilesCount - settingsCount;
        console.warn(`[AdminApprovals] ${missing} agents missing settings records`);
        toast.warning(`${missing} agent(s) missing settings - status shown as "unknown"`);
      }

      if (!agentList || agentList.length === 0) {
        console.log("[AdminApprovals] No agents found");
        setAgents([]);
        setLoading(false);
        return;
      }

      setAgents(agentList);

      // Fetch pending verifications (backup notifications)
      const { data: pendingData } = await supabase
        .from("pending_verifications")
        .select("*")
        .eq("processed", false)
        .order("created_at", { ascending: false });

      if (pendingData) {
        setPendingVerifications(pendingData);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAgents();
    }
  }, [isAdmin]);

  // DIAGNOSTIC: Log when agents state changes and update debug panel
  useEffect(() => {
    console.log("[AdminApprovals] agents state updated:", {
      count: agents.length,
      statuses: agents.reduce((acc, a) => {
        acc[a.agent_status] = (acc[a.agent_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
    setDebugInfo(prev => ({ ...prev, stateCount: agents.length }));
  }, [agents]);

  // Handle status change with upsert - branches for early access vs real agents
  const handleStatusChange = async (agent: Agent, newStatus: string) => {
    setProcessingIds((prev) => new Set(prev).add(agent.id));

    try {
      // Branch: Early access agents being verified - convert to full account
      if (agent.is_early_access && newStatus === "verified") {
        console.log(`Converting early access user to full account: ${agent.email}`);
        
        // Call the conversion edge function which creates auth user + sends password setup email
        const { data, error } = await supabase.functions.invoke("convert-early-access-to-account", {
          body: {
            earlyAccessId: agent.id,
            email: agent.email,
            firstName: agent.first_name,
            lastName: agent.last_name,
            phone: agent.phone,
            licenseState: agent.license_state,
            licenseNumber: agent.license_number,
            brokerage: agent.company,
          },
        });

        if (error) {
          console.error("Conversion error:", error);
          throw new Error("Failed to create account for early access user");
        }

        console.log("Conversion result:", data);

        // Update early access record status
        const { error: updateError } = await supabase
          .from("agent_early_access")
          .update({ 
            status: "verified",
            verified_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        if (updateError) {
          console.error("Error updating early access status:", updateError);
        }

        toast.success(`Account created and welcome email sent to ${agent.email}`);
      } else if (agent.is_early_access) {
        // Early access non-verify status change (e.g., rejected)
        const { error } = await supabase
          .from("agent_early_access")
          .update({ 
            status: newStatus,
            verified_at: null,
          })
          .eq("id", agent.id);

        if (error) throw error;

        // Send rejection email
        if (newStatus === "rejected") {
          await supabase.functions.invoke("send-agent-approval-email", {
            body: {
              userId: null,
              email: agent.email,
              firstName: agent.first_name,
              approved: false,
              isEarlyAccess: true,
            },
          });
        }

        toast.success(`Status updated to ${newStatus}`);
      } else {
        // Real agents: update agent_settings table
        const { error } = await supabase
          .from("agent_settings")
          .upsert(
            [{
              user_id: agent.id,
              agent_status: newStatus as any,
              verified_at: newStatus === "verified" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            }],
            { onConflict: "user_id" }
          );

        if (error) throw error;

        // Send email for approval/rejection for real agents
        if (newStatus === "verified" || newStatus === "rejected") {
          await supabase.functions.invoke("send-agent-approval-email", {
            body: {
              userId: agent.id,
              email: agent.email,
              firstName: agent.first_name,
              approved: newStatus === "verified",
              isEarlyAccess: false,
            },
          });
        }

        toast.success(`Status updated to ${newStatus}`);
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                agent_status: newStatus,
                verified_at: newStatus === "verified" ? new Date().toISOString() : a.verified_at,
              }
            : a
        )
      );
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Failed to update status");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(agent.id);
        return newSet;
      });
    }
  };

  // Filter + Search + Sort
  const filteredAgents = useMemo(() => {
    let result = agents;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((a) => a.agent_status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.company && a.company.toLowerCase().includes(q)) ||
          a.aac_id.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case "status":
          comparison = a.agent_status.localeCompare(b.agent_status);
          break;
        case "company":
          comparison = (a.company || "").localeCompare(b.company || "");
          break;
        case "created_at":
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [agents, statusFilter, searchQuery, sortField, sortDirection]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAgents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAgents.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Column sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 inline" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 inline" />
    );
  };

  // Bulk email
  const handleBulkEmail = () => {
    const recipients = filteredAgents
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ id: a.id, email: a.email, name: `${a.first_name} ${a.last_name}` }));
    setEmailRecipients(recipients);
  };

  // Single email
  const handleEmailAgent = (agent: Agent) => {
    setEmailRecipients([{ id: agent.id, email: agent.email, name: `${agent.first_name} ${agent.last_name}` }]);
  };

  // Send password reset email
  const handleSendPasswordReset = async (agent: Agent) => {
    try {
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { 
          email: agent.email,
          redirectUrl: `${window.location.origin}/auth?mode=reset`
        },
      });

      if (error) {
        console.error("Password reset error:", error);
        toast.error("Failed to send password reset");
        return;
      }

      toast.success(`Password reset email sent to ${agent.email}`);
    } catch (err: any) {
      console.error("Password reset error:", err);
      toast.error("Failed to send password reset");
    }
  };

  if (isChecking) {
    return <LoadingScreen message="Checking admin access..." />;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] pt-20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Admin Access Required
          </h2>
          <p className="text-slate-600 mb-2">
            You're signed in as <span className="font-medium">{user?.email}</span>
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Please sign in with your admin account to access this page.
          </p>
          <Button 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/auth');
            }}
            className="bg-slate-900 hover:bg-slate-800"
          >
            Switch Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pt-20">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Admin Tools"
          subtitle="Manage all agents, update info, control access"
          className="mb-8"
        />

        {/* DIAGNOSTIC DEBUG PANEL - REMOVE AFTER FIX */}
        <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl font-mono text-sm">
          <div className="font-bold text-yellow-800 mb-2">🔍 DEBUG PANEL (remove after fix)</div>
          <div className="grid grid-cols-2 gap-2 text-yellow-900">
            <div>isChecking: <span className="font-bold">{String(isChecking)}</span></div>
            <div>isAdmin: <span className="font-bold">{String(isAdmin)}</span></div>
            <div>user?.email: <span className="font-bold">{user?.email ?? 'null'}</span></div>
            <div>SUPABASE_URL: <span className="font-bold text-xs break-all">{import.meta.env.VITE_SUPABASE_URL ?? 'undefined'}</span></div>
            <div>Profiles Query: <span className="font-bold">{debugInfo.profilesCount ?? 'pending...'}</span> {debugInfo.profilesError && <span className="text-red-600">ERROR: {debugInfo.profilesError}</span>}</div>
            <div>Settings Query: <span className="font-bold">{debugInfo.settingsCount ?? 'pending...'}</span> {debugInfo.settingsError && <span className="text-red-600">ERROR: {debugInfo.settingsError}</span>}</div>
            <div>Merged Agents: <span className="font-bold">{debugInfo.mergedCount ?? 'pending...'}</span></div>
            <div>State Count: <span className="font-bold">{debugInfo.stateCount ?? 'pending...'}</span></div>
            <div className="col-span-2">Status Distribution: <span className="font-bold">{JSON.stringify(debugInfo.statusDistribution)}</span></div>
            <div className="col-span-2">filteredAgents.length: <span className="font-bold">{filteredAgents.length}</span> | agents.length: <span className="font-bold">{agents.length}</span></div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
          <span className="text-sm text-slate-600">
            Signed in as: <span className="font-medium text-slate-900">{user?.email}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth');
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Switch Account
            </Button>
          </div>
        </div>

        {/* Pending Verifications Banner (fallback notifications) */}
        {pendingVerifications.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-amber-900 mb-1">
                  Pending Verification Requests
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  These registrations were saved but admin email notification may have failed.
                </p>
                <div className="space-y-2">
                  {pendingVerifications.map((pv) => (
                    <div key={pv.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200">
                      <div className="text-sm">
                        <span className="font-medium text-slate-900">{pv.first_name} {pv.last_name}</span>
                        <span className="text-slate-500 ml-2">{pv.email}</span>
                        {pv.license_state && (
                          <span className="text-slate-400 ml-2">• {pv.license_state} #{pv.license_number}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-700 hover:text-amber-900"
                        onClick={async () => {
                          await supabase.from('pending_verifications').update({
                            processed: true,
                            processed_at: new Date().toISOString(),
                            processed_by: user?.id
                          }).eq('id', pv.id);
                          setPendingVerifications(prev => prev.filter(p => p.id !== pv.id));
                          toast.success("Marked as processed");
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, company, AAC ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-0 bg-[#FAFAF8] rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 outline-none"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] border-0 bg-[#FAFAF8] rounded-xl focus:ring-0 outline-none data-[state=open]:bg-[#FAFAF8]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {AGENT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Dropdown */}
              <Select 
                value={`${sortField}-${sortDirection}`} 
                onValueChange={(val) => {
                  const [field, dir] = val.split("-") as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(dir);
                }}
              >
                <SelectTrigger className="w-[140px] border-0 bg-[#FAFAF8] rounded-xl focus:ring-0 outline-none data-[state=open]:bg-[#FAFAF8]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="created_at-desc">Newest first</SelectItem>
                  <SelectItem value="created_at-asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              {filteredAgents.length} of {agents.length} agents
            </div>
          </div>

        </div>

        {/* Agent Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 shadow-[0_10px_30px_rgba(0,0,0,0.08)] text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No agents found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All Header */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.size === filteredAgents.length && filteredAgents.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all agents"
                />
                <span className="text-sm text-zinc-600">
                  {selectedIds.size > 0 
                    ? `${selectedIds.size} of ${filteredAgents.length} selected` 
                    : "Select all"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={handleBulkEmail}
                  disabled={selectedIds.size === 0}
                  className={selectedIds.size === 0 
                    ? "text-zinc-300 cursor-not-allowed" 
                    : "text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"}
                >
                  Email Selected
                </button>
                <span className="text-zinc-300">•</span>
                <button
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={selectedIds.size === 0}
                  className={selectedIds.size === 0 
                    ? "text-zinc-300 cursor-not-allowed" 
                    : "text-rose-500 hover:text-rose-700 hover:underline transition-colors"}
                >
                  Delete Selected
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-zinc-300">•</span>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
            {filteredAgents.map((agent) => {
              const isProcessing = processingIds.has(agent.id);

              return (
                <div 
                  key={agent.id} 
                  className={`relative bg-white border rounded-xl px-4 py-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                    selectedIds.has(agent.id) ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {/* Row 1: Checkbox + Agent Info + Status/Date (right) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedIds.has(agent.id)}
                        onCheckedChange={() => toggleSelect(agent.id)}
                        aria-label={`Select ${agent.first_name}`}
                      />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-mono text-xs text-black">{agent.aac_id}</span>
                        <span className="text-zinc-300">•</span>
                        <span className="font-semibold text-[#0E56F5]">{agent.first_name} {agent.last_name}</span>
                        <span className="text-zinc-300">•</span>
                        <span className="text-zinc-600">{agent.email}</span>
                        {agent.company && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="text-zinc-500">{agent.company}</span>
                          </>
                        )}
                        {agent.phone && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="text-zinc-500">{agent.phone}</span>
                          </>
                        )}
                        {agent.license_state && agent.license_number && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <a 
                              href={stateLicenseLookupUrls[agent.license_state]} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {agent.license_state} #{agent.license_number}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <Select
                        value={agent.agent_status}
                        onValueChange={(val) => handleStatusChange(agent, val)}
                        disabled={isProcessing}
                      >
                        <SelectTrigger className="w-auto h-auto rounded-lg border-0 bg-transparent p-0 [&>svg]:hidden">
                          <AgentStatusBadge status={agent.agent_status} />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-zinc-500">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Actions */}
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <button 
                      onClick={() => handleStatusChange(agent, "verified")}
                      disabled={isProcessing || agent.agent_status === "verified"}
                      className={agent.agent_status === "verified" 
                        ? "text-zinc-500 cursor-not-allowed flex items-center gap-1" 
                        : "text-aacSuccess hover:text-aacSuccess/80 hover:underline transition-colors"}
                    >
                      {agent.agent_status === "verified" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-aacSuccess" />
                          Verified
                        </>
                      ) : "Verify"}
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button 
                      onClick={() => setEditAgent(agent)} 
                      className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                    >
                      Edit
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button 
                      onClick={() => handleEmailAgent(agent)} 
                      className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                    >
                      Email
                    </button>
                    {!agent.is_early_access && (
                      <>
                        <span className="text-zinc-300">•</span>
                        <button 
                          onClick={() => handleSendPasswordReset(agent)} 
                          className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                        >
                          Reset Password
                        </button>
                      </>
                    )}
                    <span className="text-zinc-300">•</span>
                    <button 
                      onClick={() => handleStatusChange(agent, "rejected")}
                      disabled={isProcessing || agent.agent_status === "rejected"}
                      className={agent.agent_status === "rejected" 
                        ? "text-zinc-300 cursor-not-allowed" 
                        : "text-zinc-500 hover:text-rose-600 hover:underline transition-colors"}
                    >
                      Reject
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button 
                      onClick={() => setDeleteAgent(agent)} 
                      className="text-rose-600 hover:text-rose-700 hover:underline transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AgentEditDrawer
        open={!!editAgent}
        onOpenChange={(open) => !open && setEditAgent(null)}
        agent={editAgent}
        onSaved={fetchAgents}
      />

      <DeleteAgentDialog
        open={!!deleteAgent}
        onOpenChange={(open) => !open && setDeleteAgent(null)}
        agent={deleteAgent}
        onDeleted={fetchAgents}
      />

      <EmailAgentDialog
        open={emailRecipients.length > 0}
        onOpenChange={(open) => !open && setEmailRecipients([])}
        recipients={emailRecipients}
      />

      <CreateAgentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchAgents}
      />

      <BulkDeleteAgentsDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        agents={filteredAgents.filter((a) => selectedIds.has(a.id))}
        onDeleted={() => {
          setSelectedIds(new Set());
          fetchAgents();
        }}
      />
    </div>
  );
}
