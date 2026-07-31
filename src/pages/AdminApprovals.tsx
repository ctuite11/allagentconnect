import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
  FileText,
  MoreHorizontal,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SetTempPasswordDialog } from "@/components/admin/SetTempPasswordDialog";
import { AgentDetailsDrawer } from "@/components/admin/AgentDetailsDrawer";
import {
  PreviouslyDeletedAgentDialog,
  type PreviouslyDeletedAgentMatch,
} from "@/components/admin/PreviouslyDeletedAgentDialog";
import {
  checkDeletedAgent,
  logDeletedAgentOverride,
} from "@/lib/previouslyDeletedAgent";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { UserPlus } from "lucide-react";
import { AgentStatusBadge } from "@/components/ui/status-badge";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Pill, type PillVariant } from "@/components/ui/pill";
import { Seo } from "@/components/Seo";
import { normalizeSearchText } from "@/lib/agentNetworkSearch";
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
  approval_email_sent?: boolean | null;
  invite_email?: EmailStatusInfo | null;
  license_verified_email?: EmailStatusInfo | null;
  last_reminder?: {
    sent_at: string;
    template: string;
    status: string;
  } | null;
  profile_complete?: boolean;
  headshot_url?: string | null;
  // Historical signal — this email ever had a pending_verifications row,
  // even after it was processed/deleted. Used by the drawer so
  // Requested Access doesn't flip back to No after verification.
  ever_requested?: boolean;
  requested_access_at?: string | null;
  /**
   * Lifecycle fields — server-authoritative (admin-list-agents).
   * `requested_at` comes ONLY from pending_verifications.created_at.
   * A profile/auth creation timestamp is never used as a request time.
   */
  requested_at?: string | null;
  rejected_at?: string | null;
  lifecycle_status?: AdminDerivedStatus;
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

type SortField =
  | "name"
  | "status"
  | "created_at"
  | "company"
  | "last_sign_in_at"
  | "verified"
  | "verified_at"
  | "account_created"
  | "profile_complete"
  | "online"
  | "last_reminder";
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

// The approval lifecycle has exactly four stages. Profile completeness,
// headshot, brokerage, preferences, email delivery, invitation state and
// last sign-in MUST NOT influence lifecycle status or counts.
//
// Historical `restricted` values still exist in the database enum, but are
// invisible here: they fail safe into the blocked (rejected) bucket rather
// than masquerading as an active stage.
type AdminDerivedStatus = "pending" | "verified" | "activated" | "rejected";

function deriveAdminStatus(a: Agent): AdminDerivedStatus {
  // Server-computed value wins — it is derived from the same rules with
  // full pending_verifications visibility.
  if (a.lifecycle_status) return a.lifecycle_status;
  const status = (a.agent_status || "").toLowerCase();
  if (status === "rejected" || status === "restricted") return "rejected";
  if (a.account_activated_at) return "activated";
  if (a.verified_at) return "verified";
  return "pending";
}

const LIFECYCLE_LABELS: Record<AdminDerivedStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  activated: "Activated",
  rejected: "Rejected",
};

function formatAgentDisplayName(a: Pick<Agent, "first_name" | "last_name">): string {
  return [a.first_name, a.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Status Select values must match pills / deriveAdminStatus — not raw DB statuses. */
const ADMIN_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "activated", label: "Activated" },
  { value: "rejected", label: "Rejected" },
  // Utility indicator only — not a lifecycle stage.
  { value: "online", label: "Online" },
];

// Row-level "usable account" signal. Verified AND (activated OR headshot).
// Kept independent from `deriveAdminStatus` so the Profile Complete tab
// count stays tied to real profile completeness.
function isAccountActive(a: Agent): boolean {
  if (a.agent_status !== "verified") return false;
  const hasHeadshot = !!(a.headshot_url && String(a.headshot_url).trim());
  const hasActivation = !!a.account_activated_at;
  return hasActivation || hasHeadshot;
}

// Verified by admin but the agent hasn't completed the password-setup
// (activation) step yet. This is the cohort that benefits from an
// activation reminder email.
function isAwaitingActivation(a: Agent): boolean {
  if (!a.verified_at) return false;
  if (a.account_activated_at) return false;
  if (a.agent_status === "rejected" || a.agent_status === "restricted") return false;
  return true;
}

// Strictly activated: agent completed activation/password setup, regardless
// of profile completeness. Excludes rejected/restricted accounts.
function isActivatedAgent(a: Agent): boolean {
  if (!a.account_activated_at) return false;
  if (a.agent_status === "rejected" || a.agent_status === "restricted") return false;
  return true;
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

function YesNoCell({
  yes,
  iso,
  extra,
  title,
}: {
  yes: boolean;
  iso?: string | null;
  extra?: string | null;
  title?: string;
}) {
  return (
    <td className="px-3 py-3 align-top" title={title}>
      <div className="flex flex-col">
        <span
          className={
            yes
              ? "inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
              : "inline-flex w-fit items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
          }
        >
          {yes ? "Yes" : "No"}
        </span>
        {yes && (iso || extra) && (
          <span className="mt-0.5 text-[10px] text-zinc-400">
            {extra ? extra : new Date(iso!).toLocaleDateString()}
          </span>
        )}
      </div>
    </td>
  );
}

export default function AdminApprovals() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuthRole();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [licenseUploadAgentIds, setLicenseUploadAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sendingSetupLinkFor, setSendingSetupLinkFor] = useState<Set<string>>(new Set());
  const [isSendingCommsPreview, setIsSendingCommsPreview] = useState(false);
  const [isSendingForwardInvite, setIsSendingForwardInvite] = useState(false);
  const [pendingEmailAction, setPendingEmailAction] = useState<null | "forward-invite" | "comms-preview">(null);

  const sendForwardableInvite = async () => {
    if (isSendingForwardInvite) return;
    setIsSendingForwardInvite(true);
    toast.message("Sending forwardable invite to your inbox…");
    try {
      const { data, error } = await supabase.functions.invoke(
        'send-personal-forward-invite',
        { body: { to: ['chris@allagentconnect.com'] } },
      );
      if (error || !data?.success) {
        toast.error(`Failed to send: ${error?.message ?? data?.error ?? 'Unknown error'}`);
      } else {
        toast.success("Sent to chris@allagentconnect.com — forward from your inbox.");
      }
    } finally {
      setIsSendingForwardInvite(false);
    }
  };

  const sendCommsGuidePreview = async (adminEmail?: string | null) => {
    if (!adminEmail) {
      toast.error("No admin email on session");
      return;
    }
    if (isSendingCommsPreview) return;
    setIsSendingCommsPreview(true);
    toast.message("Sending Comms Center guide preview to your inbox…");
    try {
      const { data, error } = await supabase.functions.invoke(
        'send-comms-guide-email',
        { body: { to: [adminEmail], preview: true } },
      );
      if (error || !data?.success) {
        toast.error(`Failed: ${error?.message ?? data?.error ?? 'Unknown error'}`);
      } else {
        toast.success(`Preview sent to ${adminEmail}`);
      }
    } finally {
      setIsSendingCommsPreview(false);
    }
  };
  const [lastSetupLinkSentAt, setLastSetupLinkSentAt] = useState<Map<string, number>>(new Map());
  const [pendingTeamsCount, setPendingTeamsCount] = useState<number>(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingTeamsCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);
  
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
  // Explicit failure signal for pending_verifications (lifecycle history).
  // A load failure must never render as "no request" / zero rows.
  const [lifecycleDataError, setLifecycleDataError] = useState<string | null>(null);
  
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
  const [showTempPasswordDialog, setShowTempPasswordDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  // The details drawer is driven by the `?agent=<id>` search param so that
  // opening a card pushes a history entry. Browser Back then simply closes
  // the drawer and keeps the admin list on screen (instead of popping the
  // whole page off the stack and landing on the home page).
  const [searchParams, setSearchParams] = useSearchParams();
  const detailsAgentId = searchParams.get("agent");
  const detailsAgent = useMemo(
    () => (detailsAgentId ? agents.find((a) => a.id === detailsAgentId) ?? null : null),
    [agents, detailsAgentId],
  );

  const setDetailsAgent = useCallback(
    (agent: Agent | null) => {
      if (agent) {
        const next = new URLSearchParams(searchParams);
        next.set("agent", agent.id);
        setSearchParams(next); // push → Back closes the drawer
        return;
      }
      if (!searchParams.has("agent")) return;
      const next = new URLSearchParams(searchParams);
      next.delete("agent");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Row was processed/removed on refresh (e.g. pending request converted to a
  // verified agent). Drop the stale param instead of pointing at a phantom.
  useEffect(() => {
    if (!detailsAgentId || loading) return;
    if (!agents.some((a) => a.id === detailsAgentId)) {
      const next = new URLSearchParams(searchParams);
      next.delete("agent");
      setSearchParams(next, { replace: true });
    }
  }, [agents, detailsAgentId, loading, searchParams, setSearchParams]);

  // Phase 4 guardrail — shared "previously deleted" gate. When set, the
  // dialog is open and `resolve` is awaited by whichever action opened it
  // (single verify, bulk verify iteration, email setup link, etc.).
  const [deletedGate, setDeletedGate] = useState<{
    match: PreviouslyDeletedAgentMatch;
    actionLabel: string;
    resolve: (proceed: boolean) => void;
  } | null>(null);
  const [deletedGateBusy, setDeletedGateBusy] = useState(false);
  // Synchronous mirror of `deletedGateBusy` for the onCancel / onContinue
  // handlers on the dialog. React state updates aren't visible until the
  // next render, so without this ref an onOpenChange(false) firing in the
  // same tick as onContinue would still see busy=false and cancel the gate.
  const deletedGateBusyRef = useRef(false);

  /**
   * Returns true if the caller may proceed with the action:
   *   - No matching deleted_users row → true immediately.
   *   - Matching row → opens the dialog; resolves to true if the admin clicks
   *     "Continue anyway" (and writes an audit_logs override row); false on
   *     Cancel or dismiss.
   */
  const guardDeletedAgent = async (
    email: string,
    actionLabel: string,
  ): Promise<boolean> => {
    const match = await checkDeletedAgent(email);
    if (!match) return true;
    return await new Promise<boolean>((resolve) => {
      // Single-shot resolver — Cancel and Continue both call this; only the
      // first call wins, so any stray double-fire (e.g. dialog auto-close
      // firing onCancel after onContinue) is a harmless no-op instead of
      // silently dropping the retry.
      let settled = false;
      const once = (proceed: boolean) => {
        if (settled) return;
        settled = true;
        resolve(proceed);
      };
      setDeletedGate({ match, actionLabel, resolve: once });
    });
  };

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
        .filter(
          (p: any) =>
            p?.status === "pending" &&
            !p?.user_id &&
            !p?.converted_user_id &&
            p?.processed !== true,
        )
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

      // Enrich merged rows with email delivery status + historical
      // request-access signal so the drawer's Lifecycle indicators
      // reflect reality. Frontend-only, read-only, bounded to the
      // rendered list.
      const normEmails = Array.from(
        new Set(
          merged
            .map((a) => (a.email || "").trim().toLowerCase())
            .filter((e) => e.length > 0),
        ),
      );

      const licenseByEmail = new Map<string, EmailStatusInfo>();
      const inviteByEmail = new Map<string, EmailStatusInfo>();
      const everRequested = new Map<string, string>(); // email -> earliest created_at

      if (normEmails.length > 0) {
        // Note: license_verified_email, invite_email and last_reminder are
        // enriched server-side in admin-list-agents (email_jobs is RLS-locked
        // to service_role). The browser trusts those fields directly.
        try {
          const { data: pvRows } = await supabase
            .from("pending_verifications")
            .select("email, created_at")
            .in("email", normEmails);
          for (const row of (pvRows ?? []) as any[]) {
            const em = String(row.email || "").trim().toLowerCase();
            if (!em) continue;
            const existing = everRequested.get(em);
            if (!existing || new Date(row.created_at) < new Date(existing)) {
              everRequested.set(em, row.created_at);
            }
          }
        } catch (e) {
          console.warn("[AdminApprovals] pending_verifications enrichment failed:", e);
        }
      }

      const enriched: Agent[] = merged.map((a) => {
        const em = (a.email || "").trim().toLowerCase();
        const lic = a.license_verified_email ?? licenseByEmail.get(em) ?? null;
        const inv = a.invite_email ?? inviteByEmail.get(em) ?? null;
        const reqAt = everRequested.get(em) ?? null;
        const rem = a.last_reminder ?? null;
        return {
          ...a,
          license_verified_email: lic,
          invite_email: inv,
          last_reminder: rem,
          ever_requested: !!reqAt || a.ever_requested === true,
          requested_access_at: reqAt ?? a.requested_access_at ?? null,
        };
      });

      setAgents(enriched);
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

  type AdminVerifyResult = {
    success?: boolean;
    jobId?: string;
    emailSkipped?: boolean;
    error?: string;
    code?: string;
    match?: PreviouslyDeletedAgentMatch | null;
  };

  /** Parse admin-verify-agent invoke; non-2xx bodies must not look like success. */
  const invokeAdminVerify = async (body: Record<string, unknown>): Promise<AdminVerifyResult> => {
    // Route through the shared helper (force-refreshes session, sends
    // Authorization: Bearer + apikey explicitly). The helper attaches
    // `code` and `match` from the response payload onto thrown errors,
    // preserving the 409 previously_deleted acknowledge flow.
    return invokeEdgeFunction<AdminVerifyResult>("admin-verify-agent", body);
  };

  const toastVerifySuccess = (agent: Agent, verifyData: AdminVerifyResult): boolean => {
    if (verifyData.emailSkipped) {
      toast.success(`Verified ${agent.email} (already activated — no activation email)`);
      return true;
    }
    if (!verifyData.jobId) {
      // Server should never return success without jobId when email is required.
      toast.error(
        `Verification incomplete for ${agent.email}: missing activation job id. Agent was not left verified without a job — check email_jobs and retry.`,
      );
      return false;
    }
    toast.success(`Verified — activation email queued for ${agent.email}`);
    return true;
  };

  // Handle status change with upsert - branches for early access vs real agents.
  // Returns true on success (bulk verify uses this — errors are toasted, not swallowed as ok).
  const handleStatusChange = async (
    agent: Agent,
    newStatus: string,
    acknowledgeDeleted: boolean = false,
  ): Promise<boolean> => {
    // Safety guard — invited (admin-created) agents must never enter the
    // pending/verify flow. They complete /agent-setup and self-activate.
    if (agent.agent_status === "invited" && newStatus === "verified") {
      toast.error(
        "Admin-created agents are already verified. They activate by completing /agent-setup — no manual verify.",
      );
      return false;
    }

    // Phase 4 guardrail — for every verify action, if this email was
    // previously deleted as an agent, require an explicit admin ack before
    // recreating the account and re-sending the License Verified email.
    // Rejection paths are unaffected — they never create or email anyone.
    if (newStatus === "verified" && !acknowledgeDeleted) {
      const proceed = await guardDeletedAgent(agent.email, "verify this agent");
      if (!proceed) return false;
      acknowledgeDeleted = true;
    }

    setProcessingIds((prev) => new Set(prev).add(agent.id));

    try {
      // Phase 3 pending_verifications leads — reject stays local; verify uses
      // the canonical admin-verify-agent path (same as early access / existing).
      if (agent.source === "pending_verification") {
        if (newStatus === "verified") {
          const verifyData = await invokeAdminVerify({
            agentId: agent.id,
            email: agent.email,
            firstName: agent.first_name || undefined,
            lastName: agent.last_name || undefined,
            phone: agent.phone || undefined,
            licenseState: agent.license_state || undefined,
            licenseNumber: agent.license_number || undefined,
            company: agent.company || undefined,
            source: "pending_verification",
            pendingVerificationId: agent.pending_verification_id ?? agent.id,
            ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
          });
          const ok = toastVerifySuccess(agent, verifyData);
          if (!ok) return false;
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
          await fetchAgents();
          return true;
        }
        if (newStatus === "rejected") {
          const pvId = agent.pending_verification_id ?? agent.id;
          const { data: rejRows, error: rejErr } = await supabase
            .from("pending_verifications")
            .update({ status: "rejected" })
            .eq("id", pvId)
            .select("id");
          if (rejErr) throw rejErr;
          if (!rejRows || rejRows.length === 0) {
            throw new Error(
              "Reject did not update any row. You may not have admin permission, or the record was already handled. Refresh and try again."
            );
          }
          toast.success("Request rejected");
          setAgents((prev) => prev.filter((a) => a.id !== agent.id));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
          return true;
        }
        // Any other status change on a Phase 2 lead is a no-op — they have
        // no auth account yet, so restricted/pending etc. don't apply.
        return false;
      }

      // Canonical server-side verify: account ensure → license-verified job → verified.
      // Never marks verified without a durable email_jobs row (unless already activated).
      if (newStatus === "verified") {
        const verifyData = await invokeAdminVerify({
          agentId: agent.id,
          email: agent.email,
          firstName: agent.first_name || undefined,
          lastName: agent.last_name || undefined,
          phone: agent.phone || undefined,
          licenseState: agent.license_state || undefined,
          licenseNumber: agent.license_number || undefined,
          company: agent.company || undefined,
          source: agent.source || undefined,
          pendingVerificationId: agent.pending_verification_id ?? undefined,
          isEarlyAccess: Boolean(agent.is_early_access),
          earlyAccessId: agent.is_early_access ? agent.id : undefined,
          ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
        });

        const ok = toastVerifySuccess(agent, verifyData);
        if (!ok) return false;
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
      return true;
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Failed to update status");
      return false;
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
      pending: 0,
      verified: 0,
      activated: 0,
      rejected: 0,
    };
    agents.forEach((a) => {
      buckets[deriveAdminStatus(a)]++;
    });
    counts.pending = buckets.pending;
    counts.verified = buckets.verified;
    counts.activated = buckets.activated;
    counts.rejected = buckets.rejected;
    return counts;
  }, [agents]);

  // Helper to map status to Pill variant
  const variantForStatus = (status: string): PillVariant => {


    switch (status) {
      case "pending": return "warning";
      case "verified": return "primary";
      case "activated": return "success";
      case "rejected": return "danger";
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

    // Search — identity fields only (not brokerage, status, notes, etc.)
    // Tokenize so "First Last", "Last First", and double spaces all work.
    if (searchQuery.trim()) {
      const tokens = normalizeSearchText(searchQuery).split(" ").filter(Boolean);
      result = result.filter((a) => {
        const haystack = normalizeSearchText(
          [a.first_name, a.last_name, a.email, a.aac_id].filter(Boolean).join(" "),
        );
        return tokens.every((token) => haystack.includes(token));
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = formatAgentDisplayName(a).localeCompare(formatAgentDisplayName(b));
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
        case "verified": {
          const av = a.agent_status === "verified" ? 1 : 0;
          const bv = b.agent_status === "verified" ? 1 : 0;
          comparison = av - bv;
          break;
        }
        case "verified_at": {
          // Nulls always last in both directions
          if (!a.verified_at && !b.verified_at) { comparison = 0; break; }
          if (!a.verified_at) return 1;
          if (!b.verified_at) return -1;
          comparison =
            new Date(a.verified_at).getTime() - new Date(b.verified_at).getTime();
          break;
        }
        case "account_created": {
          const av = a.account_activated_at ? 1 : 0;
          const bv = b.account_activated_at ? 1 : 0;
          comparison = av - bv;
          break;
        }
        case "profile_complete": {
          const av = a.profile_complete ? 1 : 0;
          const bv = b.profile_complete ? 1 : 0;
          comparison = av - bv;
          break;
        }
        case "online": {
          const av = presenceMap.get(a.id)?.isOnline ? 1 : 0;
          const bv = presenceMap.get(b.id)?.isOnline ? 1 : 0;
          comparison = av - bv;
          break;
        }
        case "last_reminder": {
          // Nulls always last in both directions so "Never" surfaces as the
          // most-overdue bucket when the admin flips to ascending.
          const at = a.last_reminder?.sent_at
            ? new Date(a.last_reminder.sent_at).getTime()
            : null;
          const bt = b.last_reminder?.sent_at
            ? new Date(b.last_reminder.sent_at).getTime()
            : null;
          if (at === null && bt === null) { comparison = 0; break; }
          if (at === null) return 1;
          if (bt === null) return -1;
          comparison = at - bt;
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
        const succeeded = await handleStatusChange(agent, "verified");
        if (succeeded) ok++;
        else fail++;
      } catch (err) {
        if (isRateLimit(err)) {
          toast.loading("Rate limited — pausing 60s before continuing", { id: toastId });
          await sleep(60_000);
          try {
            const succeeded = await handleStatusChange(agent, "verified");
            if (succeeded) ok++;
            else fail++;
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

  const handleEmailSetupLink = async (
    agent: Agent,
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    if (sendingSetupLinkFor.has(agent.id)) return false;

    const lastSent = lastSetupLinkSentAt.get(agent.email.toLowerCase());
    if (lastSent && Date.now() - lastSent < 60 * 60 * 1000) {
      if (opts?.silent) return false;
      const minsAgo = Math.max(1, Math.round((Date.now() - lastSent) / 60000));
      const ok = window.confirm(
        `A setup email was already sent to ${agent.email} ${minsAgo} minute(s) ago. Send another one?`,
      );
      if (!ok) return false;
    }

    // Phase 4 guardrail — same "previously deleted" check as Verify.
    const proceed = await guardDeletedAgent(
      agent.email,
      "email a setup link to this agent",
    );
    if (!proceed) return false;

    setSendingSetupLinkFor((prev) => new Set(prev).add(agent.id));
    try {
      const setupUrl = await generateSetupLink(agent);
      if (!setupUrl) return false;
      const { error } = await supabase.functions.invoke("send-license-verified-email", {
        body: {
          to: agent.email,
          agentName: agent.first_name || undefined,
          ctaUrl: setupUrl,
          // Gate already passed above → allow the send even for a
          // previously-deleted email.
          acknowledgeDeleted: true,
        },
      });
      if (error) {
        console.error("Send license-verified email failed:", error);
        if (!opts?.silent) toast.error("Could not send setup email");
        return false;
      }
      setLastSetupLinkSentAt((prev) => {
        const next = new Map(prev);
        next.set(agent.email.toLowerCase(), Date.now());
        return next;
      });
      if (!opts?.silent) toast.success(`Setup link emailed to ${agent.email}`);
      return true;
    } finally {
      setSendingSetupLinkFor((prev) => {
        const next = new Set(prev);
        next.delete(agent.id);
        return next;
      });
    }
  };

  // Bulk activation reminders — sends the same setup-link email to every
  // selected agent that is verified-but-not-activated. Sequential to
  // respect the edge function's rate limits and the per-agent throttle.
  const [bulkRemindingActivation, setBulkRemindingActivation] = useState(false);
  const handleBulkActivationReminder = async () => {
    const eligible = filteredAgents.filter(
      (a) => effectiveSelectedIds.has(a.id) && isAwaitingActivation(a),
    );
    const skipped = effectiveSelectedIds.size - eligible.length;
    if (eligible.length === 0) {
      toast.info("No selected agents are awaiting activation");
      return;
    }
    setBulkRemindingActivation(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const agent of eligible) {
        const ok = await handleEmailSetupLink(agent, { silent: true });
        if (ok) sent++;
        else failed++;
      }
    } finally {
      setBulkRemindingActivation(false);
    }
    const parts = [`Sent ${sent} reminder${sent === 1 ? "" : "s"}`];
    if (skipped > 0) parts.push(`skipped ${skipped} ineligible`);
    if (failed > 0) parts.push(`${failed} failed`);
    toast.success(parts.join(" · "));
  };

  // Downloadable CSV of every agent whose account is not activated yet.
  // Read-only report — no emails sent, no rows written. Used to review
  // Bucket A (verified, License Verified email never sent) and Bucket B
  // (email sent but agent hasn't completed /agent-setup) before any
  // remediation runs.
  const handleExportActivationAudit = () => {
    const rows = agents.filter(isAwaitingActivation);
    if (rows.length === 0) {
      toast.info("No agents currently awaiting activation");
      return;
    }
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const now = Date.now();
    const daysSince = (iso: string | null | undefined): string => {
      if (!iso) return "";
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return "";
      return String(Math.max(0, Math.floor((now - t) / (24 * 60 * 60 * 1000))));
    };
    const header = [
      "email",
      "first_name",
      "last_name",
      "aac_id",
      "agent_status",
      "verified_at",
      "days_since_verified",
      "approval_email_sent",
      "license_verified_email_status",
      "license_verified_email_created_at",
      "license_verified_email_event_at",
      "license_verified_email_attempts",
      "license_verified_email_last_error",
      "bucket",
    ];
    const lines: string[] = [header.join(",")];
    for (const a of rows) {
      const lic = a.license_verified_email ?? null;
      // Bucket A: License Verified email never enqueued for this agent.
      // Bucket B: enqueued at least once but agent hasn't activated.
      const bucket = lic ? "B_email_sent_not_activated" : "A_no_email_sent";
      lines.push([
        esc(a.email),
        esc(a.first_name),
        esc(a.last_name),
        esc(a.aac_id),
        esc(a.agent_status),
        esc(a.verified_at ?? ""),
        esc(daysSince(a.verified_at)),
        esc(a.approval_email_sent === null || a.approval_email_sent === undefined ? "" : a.approval_email_sent),
        esc(lic?.status ?? ""),
        esc(lic?.created_at ?? ""),
        esc(lic?.event_at ?? ""),
        esc(lic?.attempts ?? ""),
        esc(lic?.last_error ?? ""),
        esc(bucket),
      ].join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activation-audit-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    const bucketA = rows.filter((a) => !a.license_verified_email).length;
    const bucketB = rows.length - bucketA;
    toast.success(
      `Exported ${rows.length} awaiting-activation agents · Bucket A: ${bucketA} · Bucket B: ${bucketB}`,
    );
  };

  // CSV of agent emails from the current filtered list (or the selection
  // when any rows are checked). Skips rows with no email.
  const handleExportEmails = () => {
    const source =
      effectiveSelectedIds.size > 0
        ? filteredAgents.filter((a) => effectiveSelectedIds.has(a.id))
        : filteredAgents;
    const rows = source.filter((a) => (a.email ?? "").trim());
    if (rows.length === 0) {
      toast.info(
        effectiveSelectedIds.size > 0
          ? "No emails on the selected agents"
          : "No emails in the current filtered list",
      );
      return;
    }
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["email", "first_name", "last_name", "aac_id", "agent_status", "company"];
    const lines: string[] = [header.join(",")];
    for (const a of rows) {
      lines.push(
        [
          esc((a.email ?? "").trim()),
          esc(a.first_name),
          esc(a.last_name),
          esc(a.aac_id),
          esc(a.agent_status),
          esc(a.company),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-emails-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(
      effectiveSelectedIds.size > 0
        ? `Exported ${rows.length} selected email${rows.length === 1 ? "" : "s"}`
        : `Exported ${rows.length} email${rows.length === 1 ? "" : "s"} from current filter`,
    );
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


        <div className="mb-4 flex flex-col gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2">
          <span className="text-sm text-slate-600 break-words">
            Signed in as: <span className="font-medium text-slate-900">{user?.email}</span>
          </span>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/consumers')}
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              Consumers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/team-approvals')}
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              Team Approvals
              {pendingTeamsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {pendingTeamsCount}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSendingForwardInvite}
              onClick={() => setPendingEmailAction("forward-invite")}
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              {isSendingForwardInvite ? "Sending…" : "Email me forwardable invite"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSendingCommsPreview}
              onClick={() => setPendingEmailAction("comms-preview")}
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              {isSendingCommsPreview ? "Sending…" : "Preview Comms guide email"}
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              variant="outline"
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
            <Button
              onClick={() => setShowTempPasswordDialog(true)}
              size="sm"
              variant="outline"
              className="w-full justify-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:w-auto sm:justify-center"
            >
              Set temp password
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth');
              }}
              className="w-full justify-start text-sm text-slate-500 hover:text-slate-700 sm:w-auto sm:justify-center"
            >
              Switch Account
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, AAC ID…"
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
                  {ADMIN_STATUS_FILTER_OPTIONS.map((opt) => (
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

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportEmails}
                disabled={loading || filteredAgents.length === 0}
                className="rounded-xl border-slate-300 bg-white"
                title="Download a CSV of emails from the current filtered list. If agents are selected, only those are exported."
              >
                <Download className="h-4 w-4 mr-2" />
                {effectiveSelectedIds.size > 0
                  ? `Export emails (${effectiveSelectedIds.size})`
                  : "Export emails"}
              </Button>
              <div className="text-sm text-muted-foreground">
                {filteredAgents.length} of {agents.length} agents
              </div>
            </div>
          </div>

        </div>

        {/* Lifecycle pills — Pending / Verified / Activated / Rejected only.
            Clicking a pill clears the search so the count always matches the
            visible rows. Online is a utility indicator, not a lifecycle stage. */}
        <div className="flex flex-wrap gap-2 mb-2">
          <Pill
            label={`All (${statusCounts.all})`}
            variant="neutral"
            active={statusFilter === "all"}
            onClick={() => selectLifecycleFilter("all")}
          />
          <Pill
            label={`Pending (${statusCounts.pending || 0})`}
            variant="warning"
            active={statusFilter === "pending"}
            onClick={() => selectLifecycleFilter("pending")}
          />
          <Pill
            label={`Verified (${statusCounts.verified || 0})`}
            variant="primary"
            active={statusFilter === "verified"}
            onClick={() => selectLifecycleFilter("verified")}
          />
          <Pill
            label={`Activated (${statusCounts.activated || 0})`}
            variant="success"
            active={statusFilter === "activated"}
            onClick={() => selectLifecycleFilter("activated")}
          />
          <Pill
            label={`Rejected (${statusCounts.rejected || 0})`}
            variant="danger"
            active={statusFilter === "rejected"}
            onClick={() => selectLifecycleFilter("rejected")}
          />
          <Pill
            label={`Online (${onlineCount})`}
            variant="neutral"
            active={statusFilter === "online"}
            onClick={() => selectLifecycleFilter("online")}
          />
        </div>
        <div className="mb-6 text-sm text-muted-foreground">
          {filteredAgents.length} of{" "}
          {statusFilter === "all"
            ? statusCounts.all
            : statusFilter === "online"
              ? onlineCount
              : statusCounts[statusFilter] ?? 0}{" "}
          {statusFilter === "all" ? "agents" : `${statusFilter} rows`}
        </div>
        {lifecycleDataError && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-medium text-rose-700">
              Unable to load access-request history — Requested dates and Rejected
              rows may be incomplete. This is an error, not an empty result.
            </p>
            <Button variant="outline" size="sm" onClick={() => void fetchAgents()}>
              Retry
            </Button>
          </div>
        )}

        {/* Agent Cards */}
        {loading ? (
          <AacMonogramLoader variant="section" message="Loading agents…" className="py-12 sm:py-14" />
        ) : agents.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 shadow-[0_10px_30px_rgba(0,0,0,0.08)] text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No agents found</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 shadow-[0_10px_30px_rgba(0,0,0,0.08)] text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No agents match this search or status filter</p>
            {(searchQuery.trim() || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Clear search & filters
              </Button>
            )}
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
                {(() => {
                  const eligibleCount = filteredAgents.filter(
                    (a) => effectiveSelectedIds.has(a.id) && isAwaitingActivation(a),
                  ).length;
                  if (effectiveSelectedIds.size === 0 && statusFilter !== "awaiting_activation") {
                    return null;
                  }
                  return (
                    <>
                      <button
                        onClick={handleBulkActivationReminder}
                        disabled={eligibleCount === 0 || bulkRemindingActivation}
                        className={
                          eligibleCount === 0 || bulkRemindingActivation
                            ? "text-zinc-300 cursor-not-allowed"
                            : "text-amber-600 hover:text-amber-800 hover:underline transition-colors font-medium"
                        }
                      >
                        {bulkRemindingActivation
                          ? "Sending reminders…"
                          : `Send activation reminders (${eligibleCount})`}
                      </button>
                      <span className="text-zinc-300">•</span>
                    </>
                  );
                })()}
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
                <span className="text-zinc-300">•</span>
                <button
                  onClick={handleExportEmails}
                  className="font-medium text-[#0E56F5] hover:text-[#0A3FB8] hover:underline transition-colors"
                  title="Download a CSV of emails from the current filtered list. If agents are selected, only those are exported."
                >
                  {effectiveSelectedIds.size > 0
                    ? `Export emails (${effectiveSelectedIds.size})`
                    : "Export emails"}
                </button>
                <span className="text-zinc-300">•</span>
                <button
                  onClick={handleExportActivationAudit}
                  className="text-zinc-500 hover:text-zinc-900 hover:underline transition-colors"
                  title="Download a CSV of every verified agent who hasn't completed setup, split into Bucket A (email never sent) and Bucket B (email sent, not activated)."
                >
                  Export activation audit
                </button>
              </div>
            </div>
            <EmailDeliveryLegend />
            <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 shadow-[0_1px_0_0_rgb(228_228_231)]">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("name")} className="inline-flex items-center hover:text-zinc-900">
                        Agent<SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("verified")} className="inline-flex items-center hover:text-zinc-900">
                        Verified<SortIcon field="verified" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("verified_at")} className="inline-flex items-center hover:text-zinc-900">
                        Verified On<SortIcon field="verified_at" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("last_reminder")} className="inline-flex items-center hover:text-zinc-900">
                        Last Reminder<SortIcon field="last_reminder" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("account_created")} className="inline-flex items-center hover:text-zinc-900">
                        Activated<SortIcon field="account_created" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("profile_complete")} className="inline-flex items-center hover:text-zinc-900">
                        Profile<SortIcon field="profile_complete" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("online")} className="inline-flex items-center hover:text-zinc-900">
                        Online<SortIcon field="online" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" onClick={() => handleSort("last_sign_in_at")} className="inline-flex items-center hover:text-zinc-900">
                        Last Login<SortIcon field="last_sign_in_at" />
                      </button>
                    </th>
                    <th className="w-12 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredAgents.map((agent) => {
                    const isProcessing = processingIds.has(agent.id);
                    const derived = deriveAdminStatus(agent);
                    const isSelected = selectedIds.has(agent.id);
                    const verified = agent.agent_status === "verified";
                    const activated = !!agent.account_activated_at;
                    const profileDone = agent.profile_complete === true;
                    const isOnline = !agent.is_early_access && !!presenceMap.get(agent.id)?.isOnline;
                    const yesTitle = (iso: string | null | undefined) =>
                      iso ? new Date(iso).toLocaleString() : undefined;

                    return (
                      <tr
                        key={agent.id}
                        className={
                          isSelected
                            ? "bg-emerald-50/40"
                            : "hover:bg-zinc-50/60"
                        }
                      >
                        <td className="px-3 py-3 align-top">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(agent.id)}
                            aria-label={`Select ${formatAgentDisplayName(agent) || agent.email || "agent"}`}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => setDetailsAgent(agent)}
                            className="flex flex-col gap-0.5 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-[#0E56F5] hover:underline">
                                {formatAgentDisplayName(agent) || "—"}
                              </span>
                              {agent.source === "pending_verification" && (
                                <span
                                  className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200"
                                  title="Submitted via the Request Access form"
                                >
                                  Request Access
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500">{agent.aac_id}</span>
                          </button>
                        </td>
                        <YesNoCell yes={verified} iso={agent.verified_at} title={yesTitle(agent.verified_at)} />
                        <td
                          className="px-3 py-3 align-top text-xs text-zinc-600"
                          title={agent.verified_at ? new Date(agent.verified_at).toLocaleString() : undefined}
                        >
                          {agent.verified_at ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-zinc-900">
                                {new Date(agent.verified_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {(() => {
                                  const days = Math.floor(
                                    (Date.now() - new Date(agent.verified_at).getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  if (days <= 0) return "today";
                                  if (days === 1) return "1 day ago";
                                  return `${days} days ago`;
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-3 align-top text-xs text-zinc-600"
                          title={
                            agent.last_reminder
                              ? `${agent.last_reminder.template} • ${agent.last_reminder.status} • ${new Date(agent.last_reminder.sent_at).toLocaleString()}`
                              : "No reminder email on record"
                          }
                        >
                          {agent.last_reminder ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-zinc-900">
                                {new Date(agent.last_reminder.sent_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {(() => {
                                  const days = Math.floor(
                                    (Date.now() - new Date(agent.last_reminder.sent_at).getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  if (days <= 0) return "today";
                                  if (days === 1) return "1 day ago";
                                  return `${days} days ago`;
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">Never</span>
                          )}
                        </td>
                        <YesNoCell
                          yes={activated}
                          iso={agent.account_activated_at ?? agent.last_sign_in_at ?? null}
                        />
                        <YesNoCell yes={profileDone} />
                        <td className="px-3 py-3 align-top">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="text-[11px] font-medium">Yes</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">—</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-3 align-top text-xs text-zinc-500"
                          title={
                            agent.last_sign_in_at
                              ? `Last sign-in: ${new Date(agent.last_sign_in_at).toLocaleString()}`
                              : "Never signed in"
                          }
                        >
                          {agent.last_sign_in_at ? (
                            formatRelativeSignIn(agent.last_sign_in_at)
                          ) : (
                            <span className="text-zinc-400">Never</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                aria-label="Row actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onSelect={() => setDetailsAgent(agent)}>
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {agent.agent_status === "invited" ? (
                                <>
                                  <DropdownMenuItem
                                    disabled={resendingInviteFor.has(agent.id)}
                                    onSelect={() => handleResendInvite(agent)}
                                  >
                                    {resendingInviteFor.has(agent.id) ? "Sending…" : "Resend Invite"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleCopySetupLink(agent)}>
                                    Copy Setup Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setEditAgent(agent)}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-700"
                                    onSelect={() => setDeleteAgent(agent)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    disabled={isProcessing || agent.agent_status === "verified"}
                                    onSelect={() => {
                                      const risks = risksForAgent(agent);
                                      if (hasRedFlag(risks) && agent.agent_status !== "verified") {
                                        setConfirmText("");
                                        setVerifyConfirm({ agent, risks });
                                      } else {
                                        handleStatusChange(agent, "verified");
                                      }
                                    }}
                                  >
                                    {agent.agent_status === "verified" ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Check className="h-3.5 w-3.5 text-aacSuccess" />
                                        Verified
                                      </span>
                                    ) : (
                                      "Verify"
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setEditAgent(agent)}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleEmailAgent(agent)}>
                                    Email
                                  </DropdownMenuItem>
                                  {!agent.is_early_access && agent.source !== "pending_verification" && (
                                    <DropdownMenuItem onSelect={() => handleSendPasswordReset(agent)}>
                                      Reset Password
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onSelect={() => handleCopySetupLink(agent)}>
                                    Copy setup link
                                  </DropdownMenuItem>
                                  {isAwaitingActivation(agent) && (
                                    <DropdownMenuItem
                                      disabled={sendingSetupLinkFor.has(agent.id)}
                                      onSelect={() => handleEmailSetupLink(agent)}
                                    >
                                      {sendingSetupLinkFor.has(agent.id)
                                        ? "Sending…"
                                        : "Send activation reminder"}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    disabled={sendingSetupLinkFor.has(agent.id)}
                                    onSelect={() => handleEmailSetupLink(agent)}
                                  >
                                    {sendingSetupLinkFor.has(agent.id) ? "Sending..." : "Email setup link"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={isProcessing || agent.agent_status === "rejected"}
                                    onSelect={() => handleStatusChange(agent, "rejected")}
                                  >
                                    Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-700"
                                    onSelect={() => setDeleteAgent(agent)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        onSent={() => setSelectedIds(new Set())}
      />

      <CreateAgentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchAgents}
      />

      <SetTempPasswordDialog
        open={showTempPasswordDialog}
        onOpenChange={setShowTempPasswordDialog}
        defaultEmail="lev.borinski@cbrealty.com"
      />

      <AgentDetailsDrawer
        agent={detailsAgent as any}
        open={!!detailsAgent}
        onOpenChange={(open) => !open && setDetailsAgent(null)}
        hasLicenseUpload={detailsAgent ? licenseUploadAgentIds.has(detailsAgent.id) : false}
        isInvited={detailsAgent ? detailsAgent.agent_status === "invited" : false}
        isProcessing={detailsAgent ? processingIds.has(detailsAgent.id) : false}
        isResendingInvite={detailsAgent ? resendingInviteFor.has(detailsAgent.id) : false}
        isSendingSetupLink={detailsAgent ? sendingSetupLinkFor.has(detailsAgent.id) : false}
        onVerify={() => {
          if (!detailsAgent) return;
          const risks = risksForAgent(detailsAgent);
          if (hasRedFlag(risks) && detailsAgent.agent_status !== "verified") {
            setConfirmText("");
            setVerifyConfirm({ agent: detailsAgent, risks });
          } else {
            handleStatusChange(detailsAgent, "verified");
          }
        }}
        onReject={() => detailsAgent && handleStatusChange(detailsAgent, "rejected")}
        onEdit={() => detailsAgent && setEditAgent(detailsAgent)}
        onEmail={() => detailsAgent && handleEmailAgent(detailsAgent)}
        onResetPassword={() => detailsAgent && handleSendPasswordReset(detailsAgent)}
        onCopySetupLink={() => detailsAgent && handleCopySetupLink(detailsAgent)}
        onEmailSetupLink={() => detailsAgent && handleEmailSetupLink(detailsAgent)}
        onResendInvite={() => detailsAgent && handleResendInvite(detailsAgent)}
        onDelete={() => detailsAgent && setDeleteAgent(detailsAgent)}
      />

      <PreviouslyDeletedAgentDialog
        open={Boolean(deletedGate)}
        match={deletedGate?.match ?? null}
        actionLabel={deletedGate?.actionLabel ?? "proceed"}
        loading={deletedGateBusy}
        onCancel={() => {
          if (deletedGateBusy || deletedGateBusyRef.current) return;
          const gate = deletedGate;
          setDeletedGate(null);
          gate?.resolve(false);
        }}
        onContinue={async () => {
          if (!deletedGate || deletedGateBusy || deletedGateBusyRef.current) return;
          // Flip the ref synchronously so any onCancel that fires in this
          // same tick (e.g. from Radix auto-close) bails out immediately.
          deletedGateBusyRef.current = true;
          setDeletedGateBusy(true);
          try {
            await logDeletedAgentOverride(deletedGate.match);
          } finally {
            const gate = deletedGate;
            setDeletedGate(null);
            setDeletedGateBusy(false);
            deletedGateBusyRef.current = false;
            gate.resolve(true);
          }
        }}
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

      <AlertDialog
        open={pendingEmailAction !== null}
        onOpenChange={(open) => { if (!open) setPendingEmailAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this email?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEmailAction === "forward-invite"
                ? "The forwardable Join Invitation will be sent to chris@allagentconnect.com."
                : `The Comms Center guide preview will be sent to ${user?.email ?? "your admin email"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSendingForwardInvite || isSendingCommsPreview}
              onClick={async (e) => {
                e.preventDefault();
                const action = pendingEmailAction;
                if (action === "forward-invite") {
                  await sendForwardableInvite();
                } else if (action === "comms-preview") {
                  await sendCommsGuidePreview(user?.email);
                }
                setPendingEmailAction(null);
              }}
            >
              {isSendingForwardInvite || isSendingCommsPreview ? "Sending…" : "Send email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
