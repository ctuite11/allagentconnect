import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { MyListingsRow } from "@/components/agent-dashboard-v2/MyListingsRow";
import { MarketActivityRow } from "@/components/success-hub/MarketActivityRow";
import { DashboardCommunications } from "@/components/success-hub/DashboardCommunications";
import { DashboardBuyersTable } from "@/components/success-hub/DashboardBuyersTable";
import { SuccessHubHero } from "@/components/success-hub/SuccessHubHero";
import { SuccessHubStatRow } from "@/components/success-hub/SuccessHubStatRow";
import { Seo } from "@/components/Seo";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
function SectionHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className={agentSectionTitle}>{title}</h2>
        {description ? <p className={`mt-0.5 ${agentSectionDesc}`}>{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 text-sm font-medium text-[#0E56F5] hover:underline"
      >
        {actionLabel}
      </button>
    </div>
  );
}

export default function SuccessHubDashboard() {
  const { summary, loading, error } = useSuccessHubData();

  return (
    <>
      <Seo title="Dashboard" />
      {loading ? (
        <AgentAacPage className="space-y-6 pb-10">
          <Skeleton className="h-36 w-full rounded-2xl border border-zinc-100 bg-white" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl border border-zinc-100 bg-white" />
            ))}
          </div>
          <Skeleton className="min-h-[200px] w-full rounded-2xl border border-zinc-100 bg-white" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl border border-zinc-100 bg-white" />
            <Skeleton className="h-56 rounded-2xl border border-zinc-100 bg-white" />
          </div>
          <Skeleton className="min-h-[180px] w-full rounded-2xl border border-zinc-100 bg-white" />
        </AgentAacPage>
      ) : error || !summary ? (
        <AgentAacPage className="pb-10">
          <AgentSectionCard className="p-6 text-center">
            <p className="text-sm text-neutral-500">{error ?? "Unable to load dashboard data."}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </AgentSectionCard>
        </AgentAacPage>
      ) : (
        <AgentAacPage className="space-y-6 pb-10">
          <SuccessHubHero summary={summary} />
          <SuccessHubStatRow summary={summary} />

          <AgentSectionCard className="p-5">
            <MarketActivityRow />
          </AgentSectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AgentSectionCard className="p-5">
              <DashboardBuyersTable buyers={summary.buyers} />
            </AgentSectionCard>

            <AgentSectionCard className="p-5">
              <DashboardCommunications conversations={summary.conversations} compact inboxPreview />
            </AgentSectionCard>
          </div>

          <AgentSectionCard className="p-5">
            {summary.listings.length > 0 ? (
              <MyListingsRow listings={summary.listings} autoFitGrid />
            ) : (
              <>
                <SectionHeader
                  title="My listings"
                  description="Properties you represent on AAC."
                  actionLabel="Add listing"
                  onAction={() => {
                    window.location.href = "/agent/listings/new";
                  }}
                />
                <div className="rounded-xl border border-dashed border-zinc-100 px-4 py-4 text-center">
                  <h3 className="text-sm font-semibold text-neutral-900">No active listings yet</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
                    Add a listing to appear here and in buyer matching.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 rounded-full bg-[#0E56F5] text-white hover:bg-[#0B46CC]"
                    onClick={() => {
                      window.location.href = "/agent/listings/new";
                    }}
                  >
                    Add Listing
                  </Button>
                </div>
              </>
            )}
          </AgentSectionCard>
        </AgentAacPage>
      )}
    </>
  );
}
