import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { PageHeader } from "@/components/ui/page-header";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { Button } from "@/components/ui/button";
import { PublishStatusBadge } from "@/components/developments/PublishStatusBadge";
import { useAuthRole } from "@/hooks/useAuthRole";
import {
  canMemberEditContent,
  memberPublishTransitions,
  type DevelopmentMemberRole,
} from "@/lib/developments/publishStatus";
import {
  fetchDevelopmentForWorkspace,
  fetchMyDevelopmentMemberships,
  setDevelopmentPublishStatus,
  type DeveloperMembership,
} from "@/lib/developments/workspace";
import type { DevelopmentRow } from "@/lib/developments/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createContext, useContext } from "react";

type WorkspaceBundle = Awaited<ReturnType<typeof fetchDevelopmentForWorkspace>>;

type DeveloperEditorContextValue = {
  development: DevelopmentRow;
  membership: DeveloperMembership | null;
  role: DevelopmentMemberRole | null;
  canEdit: boolean;
  bundle: WorkspaceBundle;
  reload: () => Promise<void>;
};

const DeveloperEditorContext = createContext<DeveloperEditorContextValue | null>(null);

export function useDeveloperEditor() {
  const ctx = useContext(DeveloperEditorContext);
  if (!ctx) throw new Error("useDeveloperEditor must be used within DeveloperDevelopmentLayout");
  return ctx;
}

const SUBNAV: Array<{ label: string; path: string }> = [
  { label: "Details", path: "" },
  { label: "Photos", path: "photos" },
  { label: "Floor plans", path: "floor-plans" },
  { label: "Units", path: "units" },
  { label: "Documents", path: "documents" },
  { label: "Updates", path: "updates" },
  { label: "Team", path: "team" },
];

export function DeveloperAccessGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuthRole();
  const [memberships, setMemberships] = useState<DeveloperMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { memberships: rows, error: err } = await fetchMyDevelopmentMemberships();
      if (cancelled) return;
      if (err) setError(err);
      setMemberships(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading || (user && memberships === null && !error)) {
    return <AacMonogramLoader variant="fullscreen" message="Loading developer workspace…" />;
  }

  if (!user) return <Navigate to="/auth?returnTo=%2Fdeveloper" replace />;

  if (!isAdmin && (memberships?.length ?? 0) === 0) {
    return (
      <AgentAacPage>
        <PageHeader
          title="Developer workspace"
          subtitle="You are not a member of any development account yet."
        />
        <p className="max-w-xl text-sm text-zinc-600">
          AAC admins create development accounts and assign an owner. Once you are added, your
          projects will appear here.
        </p>
      </AgentAacPage>
    );
  }

  return <>{children}</>;
}

export function DeveloperDevelopmentLayout() {
  const { developmentId } = useParams<{ developmentId: string }>();
  const { user, isAdmin } = useAuthRole();
  const location = useLocation();
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [memberships, setMemberships] = useState<DeveloperMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!developmentId) return;
    const [workspace, members] = await Promise.all([
      fetchDevelopmentForWorkspace(developmentId),
      fetchMyDevelopmentMemberships(),
    ]);
    setBundle(workspace);
    setMemberships(members.memberships);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId]);

  const membership = useMemo(() => {
    if (!bundle?.development) return null;
    return memberships.find((m) => m.account_id === bundle.development!.account_id) ?? null;
  }, [bundle?.development, memberships]);

  const role = (membership?.role as DevelopmentMemberRole | null) ?? (isAdmin ? "owner" : null);
  const canEdit = isAdmin || canMemberEditContent(role);

  if (loading || !bundle) {
    return <AacMonogramLoader variant="fullscreen" message="Loading development…" />;
  }

  if (bundle.error || !bundle.development) {
    return (
      <AgentAacPage>
        <PageHeader title="Development not found" backTo="/developer" />
        <p className="text-sm text-zinc-600">{bundle.error ?? "This development is not available."}</p>
      </AgentAacPage>
    );
  }

  const development = bundle.development;
  const base = `/developer/developments/${development.id}`;
  const transitions = memberPublishTransitions(development.publish_status);

  const onTransition = async (next: "pending_review" | "draft") => {
    setBusy(true);
    const { error } = await setDevelopmentPublishStatus(development.id, next);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(next === "pending_review" ? "Submitted for AAC review." : "Returned to draft.");
    await reload();
  };

  return (
    <DeveloperEditorContext.Provider
      value={{ development, membership, role, canEdit, bundle, reload }}
    >
      <AgentAacPage>
        <PageHeader
          title={development.name}
          subtitle={development.slug}
          backTo="/developer"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PublishStatusBadge status={development.publish_status} />
              {canEdit && transitions.includes("pending_review") ? (
                <Button size="sm" disabled={busy} onClick={() => void onTransition("pending_review")}>
                  Submit for review
                </Button>
              ) : null}
              {canEdit && transitions.includes("draft") ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onTransition("draft")}
                >
                  Withdraw submission
                </Button>
              ) : null}
              {development.publish_status === "published" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/developments/${development.slug}`} target="_blank" rel="noreferrer">
                    View live
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/developments/${development.slug}`}>Preview (member)</Link>
                </Button>
              )}
            </div>
          }
        />

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 pb-px">
          {SUBNAV.map((item) => {
            const to = item.path ? `${base}/${item.path}` : base;
            const active =
              item.path === ""
                ? location.pathname === base
                : location.pathname.startsWith(`${base}/${item.path}`);
            return (
              <Link
                key={item.label}
                to={to}
                className={cn(
                  "shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </AgentAacPage>
    </DeveloperEditorContext.Provider>
  );
}
