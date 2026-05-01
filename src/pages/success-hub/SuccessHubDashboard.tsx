import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { WelcomeHeader } from "@/components/agent-dashboard-v2/WelcomeHeader";
import { NeedsAttentionPills } from "@/components/success-hub/NeedsAttentionPills";
import { MyListingsRow } from "@/components/agent-dashboard-v2/MyListingsRow";
import { MarketActivityRow } from "@/components/success-hub/MarketActivityRow";
import { DashboardCommunications } from "@/components/success-hub/DashboardCommunications";
import { DashboardBuyersTable } from "@/components/success-hub/DashboardBuyersTable";
import { Seo } from "@/components/Seo";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";

export default function SuccessHubDashboard() {
  const { summary, loading, error } = useSuccessHubData();

  return (
    <>
      <Seo title="Dashboard" />
      {loading ? (
        <AgentAacPage className="pb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-7 w-40 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </AgentAacPage>
      ) : error || !summary ? (
        <AgentAacPage className="pb-12">
          <AgentSectionCard className="p-8 text-center md:p-10">
            <p className="text-sm text-neutral-500">{error ?? "Unable to load dashboard data."}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </AgentSectionCard>
        </AgentAacPage>
      ) : (
        <AgentAacPage className="pb-12">
          <AgentSectionCard className="p-5 md:p-6">
            <WelcomeHeader
              firstName={summary.profile?.first_name ?? "Agent"}
              lastName={summary.profile?.last_name ?? ""}
              headshotUrl={summary.profile?.headshot_url ?? null}
              aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 8)}` : undefined}
            />
            <div className="mt-6">
              <NeedsAttentionPills items={summary.attentionItems} />
            </div>
          </AgentSectionCard>

          <AgentSectionCard className="p-5 md:p-6">
            <MarketActivityRow />
          </AgentSectionCard>

          <AgentSectionCard className="p-5 md:p-6">
            {summary.listings.length > 0 ? (
              <MyListingsRow listings={summary.listings} />
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900">My Listings</h3>
                </div>
                <div className="py-4 text-center">
                  <h4 className="text-base font-semibold text-neutral-900">No active listings yet</h4>
                  <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
                    Add your first listing to start matching with buyers and generating activity.
                  </p>
                  <div className="mt-4">
                    <Button onClick={() => { window.location.href = "/agent/listings/new"; }}>Add Listing</Button>
                  </div>
                </div>
              </>
            )}
          </AgentSectionCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <DashboardCommunications conversations={summary.conversations} />
            <DashboardBuyersTable buyers={summary.buyers} />
          </div>
        </AgentAacPage>
      )}
    </>
  );
}
