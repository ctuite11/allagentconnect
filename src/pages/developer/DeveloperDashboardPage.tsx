import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { PublishStatusBadge } from "@/components/developments/PublishStatusBadge";
import { DeveloperAccessGate } from "@/components/developments/DeveloperDevelopmentLayout";
import { Seo } from "@/components/Seo";
import { formatLocation, lifecycleLabel } from "@/lib/developments/format";
import {
  fetchMyDevelopments,
  type DeveloperWorkspaceDevelopment,
} from "@/lib/developments/workspace";
import { canMemberEditContent } from "@/lib/developments/publishStatus";

function DeveloperDashboardInner() {
  const [developments, setDevelopments] = useState<DeveloperWorkspaceDevelopment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { developments: rows, error: err } = await fetchMyDevelopments();
      if (cancelled) return;
      setError(err);
      setDevelopments(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (developments === null) {
    return <AacMonogramLoader variant="fullscreen" message="Loading your developments…" />;
  }

  const canCreate = developments.some((d) => canMemberEditContent(d.member_role));

  return (
    <AgentAacPage>
      <Seo title="Developer workspace | All Agent Connect" noindex />
      <PageHeader
        title="Developer workspace"
        subtitle="Build and manage development mini-sites, then submit them to AAC for review."
        actions={
          canCreate || developments.length === 0 ? (
            <Button asChild size="sm">
              <Link to="/developer/developments/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New development
              </Link>
            </Button>
          ) : null
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {developments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">No developments yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Create your first project to start adding photos, floor plans, units, documents, and
            updates.
          </p>
          <Button asChild className="mt-5">
            <Link to="/developer/developments/new">Create development</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
          {developments.map((dev) => (
            <li key={dev.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/developer/developments/${dev.id}`}
                    className="truncate text-base font-semibold text-zinc-900 hover:text-aac"
                  >
                    {dev.name}
                  </Link>
                  <PublishStatusBadge status={dev.publish_status} />
                </div>
                <p className="text-sm text-zinc-500">
                  {formatLocation(dev)} · {lifecycleLabel(dev.lifecycle_status)}
                  {dev.account_name ? ` · ${dev.account_name}` : ""}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to={`/developer/developments/${dev.id}`}>Manage</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AgentAacPage>
  );
}

export default function DeveloperDashboardPage() {
  return (
    <DeveloperAccessGate>
      <DeveloperDashboardInner />
    </DeveloperAccessGate>
  );
}
