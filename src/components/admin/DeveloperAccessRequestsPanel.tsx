import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import {
  approveDeveloperAccessRequest,
  declineDeveloperAccessRequest,
  fetchDeveloperAccessRequests,
  type DeveloperAccessRequestRow,
} from "@/lib/developments/developerAccessRequest";
import { slugifyDevelopmentName } from "@/lib/developments/publishStatus";
import { toast } from "sonner";

type StatusFilter = "pending" | "approved" | "declined" | "all";

function RequestCard({
  request,
  onChanged,
}: {
  request: DeveloperAccessRequestRow;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(request.review_notes ?? "");
  const [accountName, setAccountName] = useState(request.company_name);
  const [accountSlug, setAccountSlug] = useState(slugifyDevelopmentName(request.company_name));
  const [busy, setBusy] = useState<"decline" | "approve" | null>(null);

  const onDecline = async () => {
    setBusy("decline");
    const { error } = await declineDeveloperAccessRequest({
      requestId: request.id,
      notes,
    });
    setBusy(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Request declined.");
    onChanged();
  };

  const onApprove = async () => {
    setBusy("approve");
    const { error, emailStatus } = await approveDeveloperAccessRequest({
      requestId: request.id,
      accountName,
      accountSlug,
      notes,
    });
    setBusy(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      emailStatus === "queued" || emailStatus === "deduped"
        ? "Developer verified. Setup link emailed."
        : "Developer verified. Account provisioned.",
    );
    onChanged();
  };

  return (
    <li className="space-y-4 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-zinc-900">
            {request.first_name} {request.last_name}
            <span className="ml-2 text-sm font-normal text-zinc-500">· {request.company_name}</span>
          </p>
          <p className="text-sm text-zinc-600">
            {request.email}
            {request.phone ? ` · ${request.phone}` : ""}
          </p>
          <p className="text-xs text-zinc-400">
            Submitted {new Date(request.created_at).toLocaleString()} · Status: {request.status}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {request.website ? (
          <div>
            <dt className="text-zinc-500">Website</dt>
            <dd className="break-all text-zinc-800">{request.website}</dd>
          </div>
        ) : null}
        {request.project_name ? (
          <div>
            <dt className="text-zinc-500">Project</dt>
            <dd className="text-zinc-800">{request.project_name}</dd>
          </div>
        ) : null}
        {request.market ? (
          <div>
            <dt className="text-zinc-500">City / Market</dt>
            <dd className="text-zinc-800">{request.market}</dd>
          </div>
        ) : null}
        {request.note ? (
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Note</dt>
            <dd className="whitespace-pre-wrap text-zinc-800">{request.note}</dd>
          </div>
        ) : null}
      </dl>

      {request.status === "pending" ? (
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <div className="space-y-1.5">
            <Label>Review notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <p className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
            Verifying creates the Developer account and emails a 7-day setup link so they can
            create their own login. No existing AAC account is needed.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Account slug</Label>
              <Input
                value={accountSlug}
                onChange={(e) => setAccountSlug(slugifyDevelopmentName(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void onDecline()}
            >
              {busy === "decline" ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void onApprove()}
            >
              {busy === "approve" ? "Verifying…" : "Verify Developer"}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function DeveloperAccessRequestsPanel() {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [rows, setRows] = useState<DeveloperAccessRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { requests, error: err } = await fetchDeveloperAccessRequests(filter);
    setError(err);
    setRows(requests);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRows(null);
      const { requests, error: err } = await fetchDeveloperAccessRequests(filter);
      if (cancelled) return;
      setError(err);
      setRows(requests);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <section className="mb-8 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Developer Access Requests</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Verify who the developer is, then approve. Verifying provisions their Developer account
            and sends a setup link — no existing AAC account required.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Status</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {rows === null ? (
        <AacMonogramLoader message="Loading requests…" />
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200">
          {rows.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              No {filter === "all" ? "" : `${filter} `}requests.
            </li>
          ) : (
            rows.map((req) => <RequestCard key={req.id} request={req} onChanged={() => void reload()} />)
          )}
        </ul>
      )}
    </section>
  );
}
