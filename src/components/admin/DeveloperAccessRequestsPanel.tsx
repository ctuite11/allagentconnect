import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import {
  PreviouslyDeletedAgentDialog,
  type PreviouslyDeletedAgentMatch,
} from "@/components/admin/PreviouslyDeletedAgentDialog";
import {
  approveDeveloperAccessRequest,
  declineDeveloperAccessRequest,
  deriveDeveloperApplicantStatus,
  fetchDeveloperApplicants,
  type DeveloperApplicantRow,
  type DeveloperApplicantStatus,
} from "@/lib/developments/developerAccessRequest";
import { slugifyDevelopmentName } from "@/lib/developments/publishStatus";
import { toast } from "sonner";

type Bucket = DeveloperApplicantStatus | "all";

const BUCKETS: Array<{ key: Bucket; label: string }> = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "verified", label: "Verified" },
  { key: "activated", label: "Activated" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_STYLES: Record<DeveloperApplicantStatus, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  verified: "border-aac/20 bg-aac/10 text-aac",
  activated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

const STATUS_LABELS: Record<DeveloperApplicantStatus, string> = {
  requested: "Requested",
  verified: "Verified",
  activated: "Activated",
  rejected: "Rejected",
};

/**
 * Codes the backend returns when provisioning succeeded but the setup-email
 * leg was blocked. These are partial successes, never verification failures.
 */
const EMAIL_ONLY_FAILURE_CODES = new Set([
  "previously_deleted",
  "email_failed",
  "email_unavailable",
]);

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function VerifyDialog({
  request,
  open,
  onOpenChange,
  onChanged,
}: {
  request: DeveloperApplicantRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(request.review_notes ?? "");
  const [accountName, setAccountName] = useState(request.company_name);
  const [accountSlug, setAccountSlug] = useState(slugifyDevelopmentName(request.company_name));
  const [busy, setBusy] = useState(false);

  const onApprove = async () => {
    setBusy(true);
    const { error, emailStatus, code, provisioned } = await approveDeveloperAccessRequest({
      requestId: request.id,
      accountName,
      accountSlug,
      notes,
    });
    setBusy(false);
    if (error) {
      // Provisioning succeeded; only the setup email was blocked. Treat as
      // verified so the admin does not re-run Verify Developer.
      if (provisioned && code && EMAIL_ONLY_FAILURE_CODES.has(code)) {
        onOpenChange(false);
        onChanged();
        toast.warning("Developer verified, but the setup link was not sent.", {
          description: "Use Send setup link on the row to retry.",
        });
        return;
      }
      toast.error(error);
      return;
    }
    toast.success(
      emailStatus === "queued" || emailStatus === "deduped"
        ? "Developer verified. Setup link emailed."
        : "Developer verified. Account provisioned.",
    );
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Verify {request.first_name} {request.last_name}
          </DialogTitle>
          <DialogDescription>
            Verifying creates the Developer account and emails a 30-day setup link so they can create
            their own login. No existing AAC account is needed.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Company</dt>
            <dd className="text-zinc-900">{request.company_name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="break-all text-zinc-900">{request.email}</dd>
          </div>
          {request.phone ? (
            <div>
              <dt className="text-zinc-500">Phone</dt>
              <dd className="text-zinc-900">{request.phone}</dd>
            </div>
          ) : null}
          {request.website ? (
            <div>
              <dt className="text-zinc-500">Website</dt>
              <dd className="break-all text-zinc-900">{request.website}</dd>
            </div>
          ) : null}
          {request.project_name ? (
            <div>
              <dt className="text-zinc-500">Project</dt>
              <dd className="text-zinc-900">{request.project_name}</dd>
            </div>
          ) : null}
          {request.market ? (
            <div>
              <dt className="text-zinc-500">City / Market</dt>
              <dd className="text-zinc-900">{request.market}</dd>
            </div>
          ) : null}
          {request.note ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Note</dt>
              <dd className="whitespace-pre-wrap text-zinc-900">{request.note}</dd>
            </div>
          ) : null}
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Account name</Label>
            <Input
              value={accountName}
              onChange={(e) => {
                setAccountName(e.target.value);
                setAccountSlug(slugifyDevelopmentName(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account slug</Label>
            <Input
              value={accountSlug}
              onChange={(e) => setAccountSlug(slugifyDevelopmentName(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Review notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onApprove()}>
            {busy ? "Verifying…" : "Verify Developer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicantRow({
  request,
  onChanged,
}: {
  request: DeveloperApplicantRow;
  onChanged: () => void;
}) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletedMatch, setDeletedMatch] = useState<PreviouslyDeletedAgentMatch | null>(null);
  const bucket = deriveDeveloperApplicantStatus(request);
  const hasSentSetupLink = Boolean(request.reviewed_at);

  const sendSetupLink = async (acknowledgeDeleted = false) => {
    setSending(true);
    const { error, emailStatus, code, deletedMatch: match } = await approveDeveloperAccessRequest({
      requestId: request.id,
      acknowledgeDeleted,
    });
    setSending(false);
    if (error) {
      if (code === "previously_deleted" && match) {
        setDeletedMatch(match as PreviouslyDeletedAgentMatch);
        return;
      }
      if (code && EMAIL_ONLY_FAILURE_CODES.has(code)) {
        setDeletedMatch(null);
        toast.warning("Developer is verified, but the setup link was not sent.");
        onChanged();
        return;
      }
      toast.error(error);
      return;
    }
    setDeletedMatch(null);
    toast.success(
      emailStatus === "deduped"
        ? "A setup link was already queued for this developer."
        : "Setup link emailed.",
    );
    onChanged();
  };

  const onReject = async () => {
    setRejecting(true);
    const { error } = await declineDeveloperAccessRequest({ requestId: request.id });
    setRejecting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Request rejected.");
    onChanged();
  };

  return (
    <TableRow>
      <TableCell className="font-medium text-zinc-900">
        {request.first_name} {request.last_name}
      </TableCell>
      <TableCell className="text-zinc-700">{request.company_name}</TableCell>
      <TableCell className="break-all text-zinc-700">{request.email}</TableCell>
      <TableCell className="whitespace-nowrap text-zinc-700">{request.phone || "—"}</TableCell>
      <TableCell className="max-w-[180px] truncate text-zinc-700">
        {request.website ? (
          <a
            href={request.website.startsWith("http") ? request.website : `https://${request.website}`}
            target="_blank"
            rel="noreferrer"
            className="text-aac hover:underline"
          >
            {request.website}
          </a>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-zinc-600">{formatDate(request.created_at)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={STATUS_STYLES[bucket]}>
          {STATUS_LABELS[bucket]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-zinc-600">
        {formatDate(request.activated_at ?? request.reviewed_at)}
      </TableCell>
      <TableCell className="text-right">
        {bucket === "requested" ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={rejecting} onClick={() => void onReject()}>
              {rejecting ? "Rejecting…" : "Reject"}
            </Button>
            <Button size="sm" onClick={() => setVerifyOpen(true)}>
              Verify Developer
            </Button>
            {verifyOpen ? (
              <VerifyDialog
                request={request}
                open={verifyOpen}
                onOpenChange={setVerifyOpen}
                onChanged={onChanged}
              />
            ) : null}
          </div>
        ) : bucket === "verified" ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={sending}
              onClick={() => void sendSetupLink()}
            >
              {sending
                ? "Sending…"
                : hasSentSetupLink
                  ? "Resend setup link"
                  : "Send setup link"}
            </Button>
            <PreviouslyDeletedAgentDialog
              open={Boolean(deletedMatch)}
              match={deletedMatch}
              actionLabel="Send setup link anyway"
              loading={sending}
              onCancel={() => setDeletedMatch(null)}
              onContinue={() => void sendSetupLink(true)}
            />
          </div>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DeveloperAccessRequestsPanel() {
  const [bucket, setBucket] = useState<Bucket>("all");
  const [rows, setRows] = useState<DeveloperApplicantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { requests, error: err } = await fetchDeveloperApplicants(bucket);
    setError(err);
    setRows(requests);
  }, [bucket]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRows(null);
      const { requests, error: err } = await fetchDeveloperApplicants(bucket);
      if (cancelled) return;
      setError(err);
      setRows(requests);
    })();
    return () => {
      cancelled = true;
    };
  }, [bucket]);

  return (
    <section className="mb-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Developer approvals</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Verify who the developer is, then approve. Verifying provisions their Developer account
            and sends a setup link — no existing AAC account required.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BUCKETS.map((b) => (
            <Button
              key={b.key}
              type="button"
              size="sm"
              variant={bucket === b.key ? "default" : "outline"}
              onClick={() => setBucket(b.key)}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {rows === null ? (
        <AacMonogramLoader message="Loading developers…" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Developer</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified / activated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-zinc-500">
                    No developers in this filter.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((req) => (
                  <ApplicantRow key={req.id} request={req} onChanged={() => void load()} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
