import { Check, FileText, Mail, ExternalLink } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  EmailDeliveryBadge,
  type EmailStatusInfo,
} from "@/components/admin/EmailDeliveryBadge";
import { AgentEmailHistory } from "@/components/admin/AgentEmailHistory";

const STATE_LICENSE_LOOKUP: Record<string, string> = {
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

export interface AgentDetailsAgent {
  id: string;
  aac_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  license_number: string | null;
  license_state: string | null;
  agent_status: string;
  verified_at: string | null;
  created_at: string;
  is_early_access?: boolean;
  has_auth_account?: boolean;
  profile_complete?: boolean;
  last_sign_in_at?: string | null;
  account_activated_at?: string | null;
  invite_email?: EmailStatusInfo | null;
  license_verified_email?: EmailStatusInfo | null;
  source?: "profile" | "early_access" | "pending_verification";
  ever_requested?: boolean;
  requested_access_at?: string | null;
}

interface AgentDetailsDrawerProps {
  agent: AgentDetailsAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasLicenseUpload: boolean;
  isInvited: boolean;
  isProcessing: boolean;
  isResendingInvite: boolean;
  isSendingSetupLink: boolean;
  onVerify: () => void;
  onReject: () => void;
  onEdit: () => void;
  onEmail: () => void;
  onResetPassword: () => void;
  onCopySetupLink: () => void;
  onEmailSetupLink: () => void;
  onResendInvite: () => void;
  onDelete: () => void;
}

function LifecycleRow({
  label,
  yes,
  detail,
}: {
  label: string;
  yes: boolean;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-zinc-100 py-2 last:border-b-0">
      <span className="text-sm text-zinc-600">{label}</span>
      <div className="text-right">
        <span
          className={
            yes
              ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
              : "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
          }
        >
          {yes ? "Yes" : "No"}
        </span>
        {detail && <div className="mt-0.5 text-[11px] text-zinc-500">{detail}</div>}
      </div>
    </div>
  );
}

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleString();
}

export function AgentDetailsDrawer({
  agent,
  open,
  onOpenChange,
  hasLicenseUpload,
  isInvited,
  isProcessing,
  isResendingInvite,
  isSendingSetupLink,
  onVerify,
  onReject,
  onEdit,
  onEmail,
  onResetPassword,
  onCopySetupLink,
  onEmailSetupLink,
  onResendInvite,
  onDelete,
}: AgentDetailsDrawerProps) {
  if (!agent) return null;

  // Lifecycle is timestamp-driven: Requested -> License Verified ->
  // Account Activated, plus an explicit Rejected terminal state. Profile
  // completeness is deliberately NOT part of the lifecycle.
  const requestedAt = agent.requested_at ?? agent.requested_access_at ?? null;
  const requested = !!requestedAt;
  const rejectedAt = agent.rejected_at ?? null;
  const isRejected =
    agent.lifecycle_status === "rejected" ||
    agent.agent_status === "rejected" ||
    agent.agent_status === "restricted";
  const verified = !!agent.verified_at;
  const activated = !!agent.account_activated_at;
  const setupEmail = agent.license_verified_email || agent.invite_email;
  const setupSent = !!setupEmail || agent.agent_status === "invited";
  const setupSentDetail = setupEmail
    ? `${setupEmail.status} · ${fmt(setupEmail.event_at ?? setupEmail.created_at) ?? ""}`
    : null;
  const profileComplete = agent.profile_complete === true;
  const canPasswordReset = !agent.is_early_access && agent.source !== "pending_verification";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-left">
            <span className="text-lg font-semibold text-[#0E56F5]">
              {agent.first_name} {agent.last_name}
            </span>
            {agent.source === "pending_verification" && (
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                Request Access
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-left">
            <span className="font-mono text-xs text-zinc-500">{agent.aac_id}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Contact
            </h4>
            <div className="rounded-md border border-zinc-100 bg-zinc-50/50 p-3 text-sm">
              <div className="flex items-center gap-2 text-zinc-700">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <a href={`mailto:${agent.email}`} className="hover:underline">
                  {agent.email}
                </a>
              </div>
              {agent.phone && (
                <div className="mt-1 text-zinc-600">
                  {formatPhoneNumber(agent.phone)}
                </div>
              )}
              {agent.company && (
                <div className="mt-1 text-zinc-600">Brokerage: {agent.company}</div>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              License
            </h4>
            <div className="rounded-md border border-zinc-100 bg-zinc-50/50 p-3 text-sm">
              {agent.license_state && agent.license_number ? (
                <a
                  href={STATE_LICENSE_LOOKUP[agent.license_state] ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {agent.license_state} #{agent.license_number}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-zinc-400">No license on file</span>
              )}
              {hasLicenseUpload && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <FileText className="h-3 w-3" />
                  License document uploaded
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Lifecycle
            </h4>
            <div className="rounded-md border border-zinc-100 bg-white p-3">
              <LifecycleRow
                label="Requested"
                yes={requested}
                detail={requested ? fmt(requestedAt) : "No request on record"}
              />
              <LifecycleRow
                label="License Verified"
                yes={verified}
                detail={verified ? fmt(agent.verified_at) : null}
              />
              <LifecycleRow
                label="Setup Email Sent"
                yes={setupSent}
                detail={setupSentDetail}
              />
              <LifecycleRow
                label="Account Activated"
                yes={activated}
                detail={activated ? fmt(agent.account_activated_at) : null}
              />
              {isRejected && (
                <LifecycleRow
                  label="Rejected"
                  yes
                  detail={fmt(rejectedAt) ?? "Date not recorded"}
                />
              )}
              <LifecycleRow label="Profile Complete" yes={profileComplete} />
              <LifecycleRow
                label="Last Sign-in"
                yes={!!agent.last_sign_in_at}
                detail={fmt(agent.last_sign_in_at) ?? "Never"}
              />
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Email Delivery
            </h4>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50/50 p-3">
              <EmailDeliveryBadge label="Invite" info={agent.invite_email} />
              <EmailDeliveryBadge label="License Verified" info={agent.license_verified_email} />
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Activation Reminder Details
            </h4>
            <div className="rounded-md border border-zinc-100 bg-white p-3 text-xs">
              <dl className="grid grid-cols-[120px,1fr] gap-y-1.5">
                <dt className="text-zinc-500">From</dt>
                <dd className="text-zinc-800">
                  All Agent Connect{" "}
                  <span className="text-zinc-500">&lt;hello@allagentconnect.com&gt;</span>
                </dd>
                <dt className="text-zinc-500">Reply-To</dt>
                <dd className="text-zinc-800">chris@allagentconnect.com</dd>
                <dt className="text-zinc-500">Template</dt>
                <dd className="text-zinc-800">License Verified</dd>
                <dt className="text-zinc-500">Link type</dt>
                <dd className="text-zinc-800">
                  Fresh Supabase recovery / setup link (single-use, ~1 hr)
                </dd>
                <dt className="text-zinc-500">Last sent</dt>
                <dd className="text-zinc-800">
                  {fmt(
                    agent.license_verified_email?.event_at ??
                      agent.license_verified_email?.created_at,
                  ) ?? <span className="text-zinc-400">Never</span>}
                </dd>
                <dt className="text-zinc-500">Delivery</dt>
                <dd>
                  {agent.license_verified_email ? (
                    <EmailDeliveryBadge
                      label="License Verified"
                      info={agent.license_verified_email}
                    />
                  ) : (
                    <span className="text-zinc-400">No send recorded</span>
                  )}
                </dd>
              </dl>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Email History
            </h4>
            <AgentEmailHistory email={agent.email} />
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Actions
            </h4>
            <div className="flex flex-wrap gap-2">
              {isInvited ? (
                <>
                  <Button
                    size="sm"
                    disabled={isResendingInvite}
                    onClick={onResendInvite}
                  >
                    {isResendingInvite ? "Sending…" : "Resend Invite"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCopySetupLink}>
                    Copy Setup Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={onDelete}
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={isProcessing || verified}
                    onClick={onVerify}
                  >
                    {verified ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={onEmail}>
                    Email
                  </Button>
                  {canPasswordReset && (
                    <Button size="sm" variant="outline" onClick={onResetPassword}>
                      Reset Password
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={onCopySetupLink}>
                    Copy setup link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSendingSetupLink}
                    onClick={onEmailSetupLink}
                  >
                    {isSendingSetupLink ? "Sending…" : "Email setup link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isProcessing || agent.agent_status === "rejected"}
                    onClick={onReject}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={onDelete}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}