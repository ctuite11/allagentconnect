import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { PageHeader } from "@/components/ui/page-header";
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
import { PublishStatusBadge } from "@/components/developments/PublishStatusBadge";
import { Seo } from "@/components/Seo";
import { useAuthRole } from "@/hooks/useAuthRole";
import { formatLocation, lifecycleLabel } from "@/lib/developments/format";
import {
  PUBLISH_STATUSES,
  adminPublishTransitions,
  publishStatusLabel,
  slugifyDevelopmentName,
  type DevelopmentPublishStatus,
} from "@/lib/developments/publishStatus";
import type { DevelopmentRow } from "@/lib/developments/types";
import {
  adminCreateDevelopmentAccount,
  adminGetDevelopmentNotes,
  adminSetDevelopmentNotes,
  fetchAdminDevelopments,
  fetchDevelopmentForWorkspace,
  setDevelopmentPublishStatus,
} from "@/lib/developments/workspace";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export function AdminDevelopmentsListPage() {
  const { isAdmin, loading } = useAuthRole();
  const [filter, setFilter] = useState<DevelopmentPublishStatus | "all">("pending_review");
  const [rows, setRows] = useState<DevelopmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin create-account form
  const [accountName, setAccountName] = useState("");
  const [accountSlug, setAccountSlug] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void (async () => {
      const { developments, error: err } = await fetchAdminDevelopments({ publishStatus: filter });
      if (cancelled) return;
      setError(err);
      setRows(developments);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, isAdmin]);

  if (loading) return <AacMonogramLoader variant="fullscreen" message="Loading…" />;
  if (!isAdmin) return <Navigate to="/agent-dashboard" replace />;

  const onCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAccount(true);
    const { accountId, error: err } = await adminCreateDevelopmentAccount({
      name: accountName,
      slug: accountSlug || slugifyDevelopmentName(accountName),
      ownerUserId,
    });
    setCreatingAccount(false);
    if (err || !accountId) {
      toast.error(err ?? "Could not create account.");
      return;
    }
    toast.success(`Development account created (${accountId}).`);
    setAccountName("");
    setAccountSlug("");
    setOwnerUserId("");
  };

  return (
    <AgentAacPage>
      <Seo title="Admin Developments | All Agent Connect" noindex />
      <PageHeader
        title="Developments review"
        subtitle="Review submissions and manage publish status using the existing backend matrix."
      />

      <section className="mb-8 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Create development account</h2>
        <p className="text-sm text-zinc-500">
          Admin-only RPC. Assigns the first owner; developers then create projects in their workspace.
        </p>
        <form onSubmit={onCreateAccount} className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Account name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input
              value={accountSlug}
              onChange={(e) => setAccountSlug(slugifyDevelopmentName(e.target.value))}
              placeholder="auto from name"
            />
          </div>
          <div className="space-y-1">
            <Label>Owner user ID</Label>
            <Input value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} required />
          </div>
          <div>
            <Button type="submit" disabled={creatingAccount}>
              {creatingAccount ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label className="text-sm text-zinc-600">Filter</Label>
        <Select value={filter} onValueChange={(v) => setFilter(v as DevelopmentPublishStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {PUBLISH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {publishStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {rows === null ? (
        <AacMonogramLoader message="Loading developments…" />
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {rows.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-zinc-500">No developments in this filter.</li>
          ) : (
            rows.map((dev) => (
              <li key={dev.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/developments/${dev.id}`}
                      className="font-semibold text-zinc-900 hover:text-aac"
                    >
                      {dev.name}
                    </Link>
                    <PublishStatusBadge status={dev.publish_status} />
                  </div>
                  <p className="text-sm text-zinc-500">
                    {formatLocation(dev)} · {lifecycleLabel(dev.lifecycle_status)}
                    {dev.submitted_at
                      ? ` · Submitted ${new Date(dev.submitted_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/developments/${dev.id}`}>Review</Link>
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
    </AgentAacPage>
  );
}

export function AdminDevelopmentReviewPage() {
  const { developmentId } = useParams<{ developmentId: string }>();
  const { isAdmin, loading: authLoading } = useAuthRole();
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchDevelopmentForWorkspace>> | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!developmentId) return;
    const next = await fetchDevelopmentForWorkspace(developmentId);
    setBundle(next);
    const { notes: adminNotes } = await adminGetDevelopmentNotes(developmentId);
    setNotes(adminNotes ?? "");
  };

  useEffect(() => {
    if (!isAdmin || !developmentId) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId, isAdmin]);

  const transitions = useMemo(
    () => adminPublishTransitions(bundle?.development?.publish_status),
    [bundle?.development?.publish_status],
  );

  if (authLoading || (isAdmin && !bundle)) {
    return <AacMonogramLoader variant="fullscreen" message="Loading review…" />;
  }
  if (!isAdmin) return <Navigate to="/agent-dashboard" replace />;
  if (!bundle?.development) {
    return (
      <AgentAacPage>
        <PageHeader title="Not found" backTo="/admin/developments" />
        <p className="text-sm text-zinc-600">{bundle?.error ?? "Development unavailable."}</p>
      </AgentAacPage>
    );
  }

  const development = bundle.development;

  const onTransition = async (next: DevelopmentPublishStatus) => {
    setBusy(true);
    const { error } = await setDevelopmentPublishStatus(development.id, next);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Status set to ${publishStatusLabel(next)}.`);
    await reload();
  };

  const onSaveNotes = async () => {
    setBusy(true);
    const { error } = await adminSetDevelopmentNotes(development.id, notes);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Admin notes saved.");
  };

  return (
    <AgentAacPage>
      <Seo title={`Review ${development.name} | All Agent Connect`} noindex />
      <PageHeader
        title={development.name}
        subtitle={development.slug}
        backTo="/admin/developments"
        actions={<PublishStatusBadge status={development.publish_status} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {transitions.map((next) => (
          <Button
            key={next}
            size="sm"
            variant={next === "published" ? "default" : "outline"}
            disabled={busy}
            onClick={() => void onTransition(next)}
          >
            {next === "published"
              ? "Approve & publish"
              : next === "draft"
                ? "Return to draft"
                : next === "paused"
                  ? "Pause"
                  : next === "archived"
                    ? "Archive"
                    : publishStatusLabel(next)}
          </Button>
        ))}
        <Button size="sm" variant="outline" asChild>
          <Link to={`/developments/${development.slug}`}>Open agent view</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Content summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Location</dt>
              <dd className="text-right text-zinc-900">{formatLocation(development)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Lifecycle</dt>
              <dd className="text-zinc-900">{lifecycleLabel(development.lifecycle_status)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Photos</dt>
              <dd className="text-zinc-900">{bundle.media.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Floor plans</dt>
              <dd className="text-zinc-900">{bundle.floorPlans.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Units</dt>
              <dd className="text-zinc-900">{bundle.units.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Documents</dt>
              <dd className="text-zinc-900">{bundle.documents.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Updates</dt>
              <dd className="text-zinc-900">{bundle.updates.length}</dd>
            </div>
          </dl>
          {development.description ? (
            <p className="border-t border-zinc-100 pt-3 text-sm text-zinc-700">{development.description}</p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Admin notes</h2>
          <p className="text-xs text-zinc-500">Stored via admin RPC — not visible on the agent mini-site.</p>
          <Textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="button" size="sm" disabled={busy} onClick={() => void onSaveNotes()}>
            Save notes
          </Button>
          <p className="text-xs text-zinc-500">
            There is no rejection-reason field in the backend. Returning to draft withdraws the
            submission without a structured reason.
          </p>
        </section>
      </div>

      <section className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Units snapshot</h2>
        <ul className="divide-y divide-zinc-100">
          {bundle.units.slice(0, 12).map((unit) => (
            <li key={unit.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-zinc-900">{unit.unit_number}</span>
              <span className="text-zinc-500">{unit.status}</span>
            </li>
          ))}
          {bundle.units.length === 0 ? (
            <li className="py-4 text-sm text-zinc-500">No units.</li>
          ) : null}
        </ul>
      </section>
    </AgentAacPage>
  );
}
