import { useEffect, useState, useMemo } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
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
  Check,
  FileText
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
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { AGENT_STATUS_OPTIONS, AGENT_STATUS_CONFIG, getStatusConfig } from "@/constants/status";
import { Pill, type PillVariant } from "@/components/ui/pill";
import { Seo } from "@/components/Seo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assessRisks, hasRedFlag, type Risk } from "@/lib/agentSignupValidation";
import { useAgentPresenceBatch } from "@/hooks/useAgentLastSeen";
import { AgentOnlinePresenceBadge } from "@/components/ui/AgentOnlinePresenceBadge";
import {
  EmailDeliveryBadge,
  EmailDeliveryLegend,
  type EmailStatusInfo,
} from "@/components/admin/EmailDeliveryBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  has_auth_account?: boolean;
  last_sign_in_at?: string | null;
  account_activated_at?: string | null;
  invite_email?: EmailStatusInfo | null;
  license_verified_email?: EmailStatusInfo | null;
  // Phase 3: identifies where this row originated so Verify/Reject can
  // branch. Absent = legacy profile row (default behaviour).
  source?: "profile" | "early_access" | "pending_verification";
  // Present only when source === 'pending_verification'. The
  // pending_verifications.id used by convert-pending-verification-to-agent.
  pending_verification_id?: string;
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

type SortField = "name" | "status" | "created_at" | "company" | "last_sign_in_at";
type SortDirection = "asc" | "desc";

function risksForAgent(a: Agent): Risk[] {
  return assessRisks({
    firstName: a.first_name,
    lastName: a.last_name,
    email: a.email,
    phone: a.phone,
    licenseState: a.license_state || "",
    licenseNumber: a.license_number || "",
    company: a.company,
  });
}

// User-facing admin status buckets. There is intentionally no "unverified"
// label — agents without an auth account are surfaced as Pending. Internal
// flows may still branch on `!has_auth_account` to decide whether the Verify
// action needs to create the account first.
type AdminDerivedStatus =
  | "invited"
  | "pending"
  | "active"
  | "rejected"
  | "restricted";

function deriveAdminStatus(a: Agent): AdminDerivedStatus {
  if (a.agent_status === "rejected") return "rejected";
  if (a.agent_status === "restricted") return "restricted";
  // DB "verified" = admin approved → user-facing "Active".
  if (a.agent_status === "verified") return "active";
  // Admin-created but agent hasn't finished /agent-setup yet.
  if (a.agent_status === "invited") return "invited";
  // Everything else (pending, legacy unverified, early-access leads,
  // approval-queue agents) surfaces as Pending review.
  return "pending";
}

function RiskBadges({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {risks.map((r) => (
        <span
          key={r.code}
          className={
            r.severity === "red"
              ? "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200"
              : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
          }
        >
          {r.severity === "red" ? "⚠" : "•"} {r.label}
        </span>
      ))}
    </div>
  );
}

function formatRelativeSignIn(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Never";
  const diffMs = Date.now() - t;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminApprovals() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuthRole();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [licenseUploadAgentIds, setLicenseUploadAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sendingSetupLinkFor, setSendingSetupLinkFor] = useState<Set<string>>(new Set());
  const [lastSetupLinkSentAt, setLastSetupLinkSentAt] = useState<Map<string, number>>(new Map());
  
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
  
  // Filters & Search - default to "pending" to show approval queue
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

  // Risk-flagged verification confirmation dialog
  const [verifyConfirm, setVerifyConfirm] = useState<{
    agent: Agent;
    risks: Risk[];
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Online presence for real (non-early-access) agents
  const realAgentIds = useMemo(
    () => agents
      .filter((a) => !a.is_early_access && a.source !== "pending_verification")
      .map((a) => a.id),
    [agents]
  );
  const presenceMap = useAgentPresenceBatch(realAgentIds);

  // How many real agents are currently online (used for header counter + filter pill)
  const onlineCount = useMemo(
    () =>
      realAgentIds.reduce(
        (n, id) => (presenceMap.get(id)?.isOnline ? n + 1 : n),
        0
      ),
    [presenceMap, realAgentIds]
  );

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
        // Fall through so Phase 2 leads can still surface even when the
        // main agent list is empty.
      }

      // Fetch which agents have uploaded license docs
      const { data: uploads } = await supabase
        .from("agent_license_uploads")
        .select("user_id")
        .eq("status", "pending_review");
      if (uploads) {
        setLicenseUploadAgentIds(new Set(uploads.map((u: any) => u.user_id)));
      }

      // Fetch pending verifications (backup notifications)
      const { data: pendingData } = await supabase
        .from("pending_verifications")
        .select("*")
        .eq("processed", false)
        .order("created_at", { ascending: false });

      if (pendingData) {
        setPendingVerifications(pendingData);
      }

      // Phase 3: surface Phase 2 "Request Access" leads
      // (status='pending' AND user_id IS NULL) as first-class rows in the
      // Unverified/Pending list so admins can Verify them via the new
      // convert-pending-verification-to-agent flow.
      const existingEmails = new Set(
        (agentList ?? []).map((a: Agent) => (a.email || "").toLowerCase())
      );
      const phase2Leads: Agent[] = (pendingData ?? [])
        .filter((p: any) => p?.status === "pending" && !p?.user_id)
        .filter((p: any) => !existingEmails.has(String(p.email || "").toLowerCase()))
        .map((p: any): Agent => ({
          id: p.id,
          aac_id: `REQ-${String(p.id).slice(0, 4).toUpperCase()}`,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          email: p.email,
          phone: p.phone ?? null,
          company: p.company ?? null,
          bio: null,
          license_number: p.license_number ?? null,
          license_state: p.license_state ?? null,
          agent_status: "pending",
          verified_at: null,
          created_at: p.created_at,
          is_early_access: false,
          has_auth_account: false,
          last_sign_in_at: null,
          account_activated_at: null,
          invite_email: null,
          license_verified_email: null,
          source: "pending_verification",
          pending_verification_id: p.id,
        }));

      const merged: Agent[] = [...phase2Leads, ...((agentList ?? []) as Agent[])];
      setAgents(merged);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void fetchAgents();
    }
  }, [authLoading, isAdmin]);

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
    // Safety guard — invited (admin-created) agents must never enter the
    // pending/verify flow. They complete /agent-setup and self-activate.
    if (agent.agent_status === "invited" && newStatus === "verified") {
      toast.error(
        "Admin-created agents are already verified. They activate by completing /agent-setup — no manual verify.",
      );
      return;
    }
    setProcessingIds((prev) => new Set(prev).add(agent.id));

    try {
      // Phase 3: Request-Access leads (pending_verifications rows with no
      // auth user yet). Route through convert-pending-verification-to-agent
      // which is idempotent + collision-safe, then send the existing
      // License Verified email. Rejection just flips the pending row.
      if (agent.source === "pending_verification") {
        if (newStatus === "verified") {
          const { data: convData, error: convErr } = await supabase.functions.invoke(
            "convert-pending-verification-to-agent",
            { body: { pendingVerificationId: agent.pending_verification_id ?? agent.id } },
          );
          if (convErr || !convData?.ok || !convData?.userId) {
            console.error("[AdminApprovals] convert failed:", convErr || convData);
            throw new Error(
              (convErr as any)?.message ||
                (convData as any)?.error ||
                "Failed to convert pending verification",
            );
          }
          const newUserId = convData.userId as string;
          const { error: emailError } = await supabase.functions.invoke(
            "send-license-verified-email",
            {
              body: {
                to: agent.email,
                agentName: agent.first_name || undefined,
                idempotencyKey: `license-verified:verify:${newUserId}`,
              },
            },
          );
          if (emailError) {
            console.error("send-license-verified-email failed:", emailError);
            toast.error(
              `Verified ${agent.email}, but activation email failed. Use Email setup link to retry.`,
            );
          } else {
            toast.success(`Verified — activation email sent to ${agent.email}`);
          }
          // Refetch so the synthetic row is replaced by the real converted
          // agent row (with auth user id, presence, email badges, etc.).
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
          await fetchAgents();
          return;
        }
        if (newStatus === "rejected") {
          const pvId = agent.pending_verification_id ?? agent.id;
          const { error: rejErr } = await supabase
            .from("pending_verifications")
            .update({ status: "rejected" })
            .eq("id", pvId);
          if (rejErr) throw rejErr;
          toast.success("Request rejected");
          setAgents((prev) => prev.filter((a) => a.id !== agent.id));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
          return;
        }
        // Any other status change on a Phase 2 lead is a no-op — they have
        // no auth account yet, so restricted/pending etc. don't apply.
        return;
      }

      // Unified verification path — every Unverified row ends here regardless
      // of origin (Early Access lead, backfilled orphan, or existing auth account).
      // 1) Ensure an auth account / agent_settings row exists.
      // 2) Mark agent_status = 'verified'.
      // 3) Send the License Verified email (CTA → /agent-setup).
      if (newStatus === "verified") {
        if (agent.is_early_access) {
          console.log(`Converting early access user to full account: ${agent.email}`);
          const { error: convertError } = await supabase.functions.invoke(
            "convert-early-access-to-account",
            {
              body: {
                earlyAccessId: agent.id,
                email: agent.email,
                firstName: agent.first_name,
                lastName: agent.last_name,
                phone: agent.phone,
                licenseState: agent.license_state,
                licenseNumber: agent.license_number,
                brokerage: agent.company,
                skipEmail: true,
              },
            },
          );
          if (convertError) {
            console.error("Conversion error:", convertError);
            throw new Error("Failed to create account for early access user");
          }

          const { error: eaUpdateError } = await supabase
            .from("agent_early_access")
            .update({
              status: "verified",
              verified_at: new Date().toISOString(),
            })
            .eq("id", agent.id);
          if (eaUpdateError) {
            console.error("Error updating early access status:", eaUpdateError);
          }
        } else {
          const { error: settingsError } = await supabase
            .from("agent_settings")
            .upsert(
              [{
                user_id: agent.id,
                agent_status: "verified" as any,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }],
              { onConflict: "user_id" },
            );
          if (settingsError) throw settingsError;
        }

        // Single email for every verified agent. Per-agent idempotency key
        // dedupes double-clicks and bulk-verify retries.
        const { error: emailError } = await supabase.functions.invoke(
          "send-license-verified-email",
          {
            body: {
              to: agent.email,
              agentName: agent.first_name || undefined,
              idempotencyKey: `license-verified:verify:${agent.id}`,
            },
          },
        );
        if (emailError) {
          console.error("send-license-verified-email failed:", emailError);
          toast.error(
            `Verified ${agent.email}, but activation email failed. Use Email setup link to retry.`,
          );
        } else {
          toast.success(`Verified — activation email sent to ${agent.email}`);
        }
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
        // Real agents non-verify status change (rejected/restricted/pending).
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

        // Verified is handled by the unified path above; only rejection mails here.
        if (newStatus === "rejected") {
          await supabase.functions.invoke("send-agent-approval-email", {
            body: {
              userId: agent.id,
              email: agent.email,
              firstName: agent.first_name,
              approved: false,
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

  // Status counts for the filter bar
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length };
    // User-facing buckets only — no "unverified" surface area.
    // Pending  = early-access leads + agents waiting on approval
    // Verified = approved + setup email sent, but setup not completed yet
    // Active   = setup completed (account_activated_at present)
    //
    // SAFEGUARD (2026-06-29): Never backfill auth users with the `buyer` role into
    // `agent_early_access`. A prior one-shot backfill ("source = 'backfill_unverified'")
    // inserted any auth user that had an `agent_settings` row, which polluted the
    // Pending tab with 8 buyer/test accounts. Future backfills MUST filter out users
    // who hold the `buyer` role in `user_roles`.
    const buckets: Record<AdminDerivedStatus, number> = {
      invited: 0,
      pending: 0,
      active: 0,
      rejected: 0,
      restricted: 0,
    };
    agents.forEach((a) => {
      buckets[deriveAdminStatus(a)]++;
    });
    counts.invited = buckets.invited;
    counts.pending = buckets.pending;
    counts.active = buckets.active;
    counts.rejected = buckets.rejected;
    counts.restricted = buckets.restricted;
    return counts;
  }, [agents]);

  // Helper to map status to Pill variant
  const variantForStatus = (status: string): PillVariant => {
    switch (status) {
      case "pending": return "warning";
      case "invited": return "primary";
      case "active": return "success";
      case "rejected":
      case "restricted": return "danger";
      default: return "neutral";
    }
  };

  // Filter + Search + Sort
  const filteredAgents = useMemo(() => {
    let result = agents;

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "online") {
        result = result.filter(
          (a) => !a.is_early_access && presenceMap.get(a.id)?.isOnline
        );
      } else {
        result = result.filter((a) => deriveAdminStatus(a) === statusFilter);
      }
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
        case "last_sign_in_at": {
          // Most-recent first when desc; nulls always last
          const at = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : null;
          const bt = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : null;
          if (at === null && bt === null) comparison = 0;
          else if (at === null) return 1;
          else if (bt === null) return -1;
          else comparison = at - bt;
          break;
        }
        case "created_at":
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [agents, statusFilter, searchQuery, sortField, sortDirection, presenceMap]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (effectiveSelectedIds.size === filteredAgents.length) {
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

  // Reconcile selection with the currently visible (filtered) agents.
  // Prevents stale "N selected" counters and bulk actions targeting
  // rows that aren't visible after a tab/search/refresh.
  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    const visible = new Set(filteredAgents.map((a) => a.id));
    const next = new Set<string>();
    selectedIds.forEach((id) => {
      if (visible.has(id)) next.add(id);
    });
    return next;
  }, [selectedIds, filteredAgents]);

  // Prune the underlying state when the visible set shrinks so that
  // hidden ids can never leak into bulk actions or re-appear later.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    if (effectiveSelectedIds.size === selectedIds.size) return;
    setSelectedIds(effectiveSelectedIds);
  }, [effectiveSelectedIds, selectedIds]);

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
      .filter((a) => effectiveSelectedIds.has(a.id))
      .map((a) => ({ id: a.id, email: a.email, name: `${a.first_name} ${a.last_name}` }));
    setEmailRecipients(recipients);
  };

  // Bulk verify (Unverified tab) — sequential to keep edge-function load steady
  // and to make per-row errors easy to surface. Per-agent idempotency keys in
  // send-license-verified-email prevent double-sends on retry.
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [resendingInviteFor, setResendingInviteFor] = useState<Set<string>>(new Set());

  // Resend the admin-created setup invite (Chris personal note).
  // Used only for Invited-tab agents. Reuses the same idempotency-guarded
  // send-admin-created-invite edge function fired at create time.
  const handleResendInvite = async (agent: Agent) => {
    if (resendingInviteFor.has(agent.id)) return;
    setResendingInviteFor((prev) => new Set(prev).add(agent.id));
    try {
      const { error } = await supabase.functions.invoke("send-admin-created-invite", {
        body: {
          to: agent.email,
          firstName: agent.first_name || undefined,
          // Force a fresh send (bypass 10-min recency dedupe) when admin
          // explicitly resends.
          idempotencyKey: `admin-created-invite:${agent.id}:${Date.now()}`,
        },
      });
      if (error) {
        console.error("[AdminApprovals] Resend invite failed:", error);
        toast.error("Could not resend invite");
        return;
      }
      toast.success(`Invite resent to ${agent.email}`);
    } finally {
      setResendingInviteFor((prev) => {
        const next = new Set(prev);
        next.delete(agent.id);
        return next;
      });
    }
  };
  const handleBulkVerify = async () => {
    const targets = filteredAgents.filter(
      (a) => effectiveSelectedIds.has(a.id) && a.agent_status !== "verified",
    );
    if (targets.length === 0) {
      toast.error("No eligible agents selected");
      return;
    }
    setBulkVerifying(true);
    const toastId = toast.loading(`Verifying 0 of ${targets.length}…`);
    let ok = 0;
    let fail = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const isRateLimit = (err: any) => {
      const status = err?.status ?? err?.context?.status ?? err?.response?.status;
      if (status === 429) return true;
      const msg = String(err?.message ?? err ?? "").toLowerCase();
      return msg.includes("429") || msg.includes("too many requests") || msg.includes("rate limit");
    };
    // Backend caps convert-early-access-to-account at 5/min per IP.
    // ~13s between agents keeps us under the limit.
    const THROTTLE_MS = 13_000;
    for (let i = 0; i < targets.length; i++) {
      const agent = targets[i];
      toast.loading(`Verifying ${i + 1} of ${targets.length}: ${agent.email}`, {
        id: toastId,
      });
      try {
        await handleStatusChange(agent, "verified");
        ok++;
      } catch (err) {
        if (isRateLimit(err)) {
          toast.loading("Rate limited — pausing 60s before continuing", { id: toastId });
          await sleep(60_000);
          try {
            await handleStatusChange(agent, "verified");
            ok++;
          } catch (retryErr) {
            console.error("[bulk verify] retry failed for", agent.email, retryErr);
            fail++;
          }
        } else {
          console.error("[bulk verify] failed for", agent.email, err);
          fail++;
        }
      }
      if (i < targets.length - 1) {
        await sleep(THROTTLE_MS);
      }
    }
    toast.dismiss(toastId);
    if (fail === 0) {
      toast.success(`Verified ${ok} of ${targets.length} agents`);
    } else {
      toast.error(`${ok} verified, ${fail} failed`);
    }
    setSelectedIds(new Set());
    setBulkVerifying(false);
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

  // Generate a one-time password setup link via the service-role edge function.
  const generateSetupLink = async (agent: Agent): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("generate-agent-setup-link", {
      body: { userId: agent.is_early_access ? undefined : agent.id, email: agent.email },
    });
    if (error || !data?.setupUrl) {
      console.error("Setup link generation failed:", error);
      toast.error("Could not generate setup link");
      return null;
    }
    return data.setupUrl as string;
  };

  const handleCopySetupLink = async (agent: Agent) => {
    const setupUrl = await generateSetupLink(agent);
    if (!setupUrl) return;
    try {
      await navigator.clipboard.writeText(setupUrl);
      toast.success("Setup link copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleEmailSetupLink = async (agent: Agent) => {
    if (sendingSetupLinkFor.has(agent.id)) return;

    const lastSent = lastSetupLinkSentAt.get(agent.email.toLowerCase());
    if (lastSent && Date.now() - lastSent < 60 * 60 * 1000) {
      const minsAgo = Math.max(1, Math.round((Date.now() - lastSent) / 60000));
      const ok = window.confirm(
        `A setup email was already sent to ${agent.email} ${minsAgo} minute(s) ago. Send another one?`,
      );
      if (!ok) return;
    }

    setSendingSetupLinkFor((prev) => new Set(prev).add(agent.id));
    try {
      const setupUrl = await generateSetupLink(agent);
      if (!setupUrl) return;
      const { error } = await supabase.functions.invoke("send-license-verified-email", {
        body: {
          to: agent.email,
          agentName: agent.first_name || undefined,
          ctaUrl: setupUrl,
        },
      });
      if (error) {
        console.error("Send license-verified email failed:", error);
        toast.error("Could not send setup email");
        return;
      }
      setLastSetupLinkSentAt((prev) => {
        const next = new Map(prev);
        next.set(agent.email.toLowerCase(), Date.now());
        return next;
      });
      toast.success(`Setup link emailed to ${agent.email}`);
    } finally {
      setSendingSetupLinkFor((prev) => {
        const next = new Set(prev);
        next.delete(agent.id);
        return next;
      });
    }
  };

  if (authLoading) {
    return (
      <>
        <Seo
          title="Admin | All Agent Connect"
          description="Review approvals, manage access, and oversee administrative workflows inside All Agent Connect."
          canonical="https://allagentconnect.com/admin/approvals"
          noindex
        />
        <LoadingScreen message="Checking admin access..." />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Seo
          title="Admin | All Agent Connect"
          description="Review approvals, manage access, and oversee administrative workflows inside All Agent Connect."
          canonical="https://allagentconnect.com/admin/approvals"
          noindex
        />
        <Navigate to="/auth" replace />
      </>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pt-6 px-6 pb-6 flex items-center justify-center h-full">
        <Seo
          title="Admin | All Agent Connect"
          description="Review approvals, manage access, and oversee administrative workflows inside All Agent Connect."
          canonical="https://allagentconnect.com/admin/approvals"
          noindex
        />
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
    <div className="pt-6 px-6 pb-6">
      <Seo
        title="Admin | All Agent Connect"
        description="Review approvals, manage access, and oversee administrative workflows inside All Agent Connect."
        canonical="https://allagentconnect.com/admin/approvals"
        noindex
      />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Admin Tools"
          subtitle="Manage all agents, update info, control access"
          className="mb-8"
        />


        <div className="mb-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
          <span className="text-sm text-slate-600">
            Signed in as: <span className="font-medium text-slate-900">{user?.email}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/consumers')}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-4 w-4 mr-2" />
              Consumers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                toast.message("Sending forwardable invite to your inbox…");
                const { data, error } = await supabase.functions.invoke(
                  'send-personal-forward-invite',
                  { body: { to: ['chris@allagentconnect.com'] } },
                );
                if (error || !data?.success) {
                  toast.error(`Failed to send: ${error?.message ?? data?.error ?? 'Unknown error'}`);
                } else {
                  toast.success("Sent to chris@allagentconnect.com — forward from your inbox.");
                }
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Email me forwardable invite
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
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
                  <SelectItem value="last_sign_in_at-desc">Last sign-in (recent)</SelectItem>
                  <SelectItem value="last_sign_in_at-asc">Last sign-in (oldest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              {filteredAgents.length} of {agents.length} agents
            </div>
          </div>

        </div>

        {/* Status Count Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Pill
            label={`All (${statusCounts.all})`}
            variant="neutral"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <Pill
            label={`Pending (${statusCounts.pending || 0})`}
            variant="neutral"
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <Pill
            label={`Invited (${statusCounts.invited || 0})`}
            variant="neutral"
            active={statusFilter === "invited"}
            onClick={() => setStatusFilter("invited")}
          />
          <Pill
            label={`Active (${statusCounts.active || 0})`}
            variant="neutral"
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          />
          <Pill
            label={`Rejected (${statusCounts.rejected || 0})`}
            variant="neutral"
            active={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
          />
          <Pill
            label={`Restricted (${statusCounts.restricted || 0})`}
            variant="neutral"
            active={statusFilter === "restricted"}
            onClick={() => setStatusFilter("restricted")}
          />
          <Pill
            label={`Online (${onlineCount})`}
            variant="neutral"
            active={statusFilter === "online"}
            onClick={() => setStatusFilter("online")}
          />
        </div>

        {/* Agent Cards */}
        {loading ? (
          <AacMonogramLoader variant="section" message="Loading agents…" className="py-12 sm:py-14" />
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
                  checked={effectiveSelectedIds.size === filteredAgents.length && filteredAgents.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all agents"
                />
                <span className="text-sm text-zinc-600">
                  {effectiveSelectedIds.size > 0 
                    ? `${effectiveSelectedIds.size} of ${filteredAgents.length} selected` 
                    : "Select all"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {statusFilter === "pending" && (
                  <>
                    <button
                      onClick={() => setShowVerifyConfirm(true)}
                      disabled={effectiveSelectedIds.size === 0 || bulkVerifying}
                      className={
                        effectiveSelectedIds.size === 0 || bulkVerifying
                          ? "text-zinc-300 cursor-not-allowed"
                          : "text-emerald-600 hover:text-emerald-800 hover:underline transition-colors font-medium"
                      }
                    >
                      {bulkVerifying
                        ? "Verifying…"
                        : `Verify Selected (${effectiveSelectedIds.size})`}
                    </button>
                    <span className="text-zinc-300">•</span>
                  </>
                )}
                {statusFilter !== "pending" && (
                  <>
                <button
                  onClick={handleBulkEmail}
                  disabled={effectiveSelectedIds.size === 0}
                  className={effectiveSelectedIds.size === 0 
                    ? "text-zinc-300 cursor-not-allowed" 
                    : "text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"}
                >
                  Email Selected
                </button>
                <span className="text-zinc-300">•</span>
                  </>
                )}
                <button
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={effectiveSelectedIds.size === 0}
                  className={effectiveSelectedIds.size === 0 
                    ? "text-zinc-300 cursor-not-allowed" 
                    : "text-rose-500 hover:text-rose-700 hover:underline transition-colors"}
                >
                  Delete Selected
                </button>
                {effectiveSelectedIds.size > 0 && (
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
            <EmailDeliveryLegend />
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
                        {agent.source === "pending_verification" && (
                          <span
                            className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200"
                            title="Submitted via the Request Access form"
                          >
                            Request Access
                          </span>
                        )}
                        {!agent.is_early_access && presenceMap.get(agent.id)?.isOnline && (
                          <AgentOnlinePresenceBadge />
                        )}
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
                            <span className="text-zinc-500">{formatPhoneNumber(agent.phone ?? "")}</span>
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
                        {licenseUploadAgentIds.has(agent.id) && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                              <FileText className="h-3 w-3" />
                              License uploaded
                            </span>
                          </>
                        )}
                      </div>
                      {agent.agent_status === "pending" && (
                        <RiskBadges risks={risksForAgent(agent)} />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {(() => {
                        const derived = deriveAdminStatus(agent);
                        if (derived === "rejected" || derived === "restricted") {
                          return <AgentStatusBadge status={derived as any} />;
                        }
                        if (derived === "active") {
                          return (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                              title={
                                agent.account_activated_at
                                  ? `Account activated: ${new Date(agent.account_activated_at).toLocaleString()}`
                                  : "Account active"
                              }
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active · {formatRelativeSignIn(agent.account_activated_at)}
                            </span>
                          );
                        }
                        if (derived === "invited") {
                          return (
                            <span
                              className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200"
                              title="Invite sent — agent has not completed setup yet"
                            >
                              Invited
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                            Pending
                          </span>
                        );
                      })()}
                      <span
                        className="text-xs text-zinc-500"
                        title={
                          agent.last_sign_in_at
                            ? `Last sign-in: ${new Date(agent.last_sign_in_at).toLocaleString()}`
                            : "Never signed in"
                        }
                      >
                        {agent.last_sign_in_at ? (
                          <>Last sign-in: {formatRelativeSignIn(agent.last_sign_in_at)}</>
                        ) : (
                          <span className="text-zinc-400">Never signed in</span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Email delivery status — read-only surfacing from email_jobs */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                    <EmailDeliveryBadge label="Invite" info={agent.invite_email} />
                    <EmailDeliveryBadge
                      label="License Verified"
                      info={agent.license_verified_email}
                    />
                  </div>

                  {/* Row 2: Actions */}
                  <div className="mt-3 flex items-center gap-2 text-sm">
                  {deriveAdminStatus(agent) === "invited" ? (
                    <>
                      <button
                        onClick={() => handleResendInvite(agent)}
                        disabled={resendingInviteFor.has(agent.id)}
                        className={
                          resendingInviteFor.has(agent.id)
                            ? "text-zinc-300 cursor-not-allowed"
                            : "text-emerald-600 hover:text-emerald-800 hover:underline transition-colors font-medium"
                        }
                      >
                        {resendingInviteFor.has(agent.id) ? "Sending…" : "Resend Invite"}
                      </button>
                      <span className="text-zinc-300">•</span>
                      <button
                        onClick={() => handleCopySetupLink(agent)}
                        className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                      >
                        Copy Setup Link
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
                        onClick={() => setDeleteAgent(agent)}
                        className="text-rose-600 hover:text-rose-700 hover:underline transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                  <>
                    <button 
                      onClick={() => {
                        const risks = risksForAgent(agent);
                        if (hasRedFlag(risks) && agent.agent_status !== "verified") {
                          setConfirmText("");
                          setVerifyConfirm({ agent, risks });
                        } else {
                          handleStatusChange(agent, "verified");
                        }
                      }}
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
                    {!agent.is_early_access && agent.source !== "pending_verification" && (
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
                      onClick={() => handleCopySetupLink(agent)}
                      className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                    >
                      Copy setup link
                    </button>
                    <span className="text-zinc-300">•</span>
                    <button
                      onClick={() => handleEmailSetupLink(agent)}
                      disabled={sendingSetupLinkFor.has(agent.id)}
                      className={
                        sendingSetupLinkFor.has(agent.id)
                          ? "text-zinc-300 cursor-not-allowed"
                          : "text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                      }
                    >
                      {sendingSetupLinkFor.has(agent.id) ? "Sending..." : "Email setup link"}
                    </button>
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
                  </>
                  )}
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
        agents={filteredAgents.filter((a) => effectiveSelectedIds.has(a.id))}
        onDeleted={() => {
          setSelectedIds(new Set());
          fetchAgents();
        }}
      />

      <AlertDialog open={showVerifyConfirm} onOpenChange={setShowVerifyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify {effectiveSelectedIds.size} agent{effectiveSelectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will verify {effectiveSelectedIds.size} agent{effectiveSelectedIds.size === 1 ? "" : "s"} and send each one an individual License Verified setup email. Emails are sent one at a time using a per-agent idempotency key — no custom subject or message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowVerifyConfirm(false);
                void handleBulkVerify();
              }}
            >
              Verify &amp; Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={verifyConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVerifyConfirm(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm verification — flagged submission</DialogTitle>
            <DialogDescription>
              This agent's submission has data that looks suspicious. Review carefully before approving.
            </DialogDescription>
          </DialogHeader>
          {verifyConfirm && (
            <div className="space-y-4">
              <div className="rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
                <div className="text-sm font-medium text-rose-900">
                  {verifyConfirm.agent.first_name} {verifyConfirm.agent.last_name} — {verifyConfirm.agent.email}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-rose-800">
                  {verifyConfirm.risks.map((r) => (
                    <li key={r.code}>• {r.label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Type <span className="font-mono">VERIFY</span> to confirm:
                </label>
                <Input
                  className="mt-1"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="VERIFY"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVerifyConfirm(null);
                    setConfirmText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={confirmText.trim() !== "VERIFY"}
                  onClick={() => {
                    const a = verifyConfirm.agent;
                    setVerifyConfirm(null);
                    setConfirmText("");
                    handleStatusChange(a, "verified");
                  }}
                >
                  Approve anyway
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
