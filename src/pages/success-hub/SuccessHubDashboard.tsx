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
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { CheckCircle2 } from "lucide-react";

export default function SuccessHubDashboard() {
  const { summary, loading, error } = useSuccessHubData();

  return (
    <>
      <Seo title="Dashboard" />
      {loading ? (
        <AgentAacPage className="space-y-8 pb-12">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52 rounded-md border border-zinc-100 bg-white" />
            <Skeleton className="h-4 w-80 max-w-full rounded-md border border-zinc-100 bg-white" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full border border-zinc-100 bg-white" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded-md border border-zinc-100 bg-white" />
              <Skeleton className="h-4 w-32 rounded-md border border-zinc-100 bg-white" />
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-36 rounded-full border border-zinc-100 bg-white" />
            ))}
          </div>
          <Skeleton className="h-56 w-full rounded-2xl border border-zinc-100 bg-white md:h-64" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <Skeleton className="h-52 w-full rounded-2xl border border-zinc-100 bg-white" />
            <Skeleton className="h-52 w-full rounded-2xl border border-zinc-100 bg-white" />
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
          <AgentPageHeader
            title="Success Hub"
            subtitle="Your command center for buyers, listings, and conversations."
            className="mb-8"
          />

          {/* 1. Welcome / quick summary */}
          <AgentSectionCard className="p-6 md:p-8">
            <WelcomeHeader
              firstName={summary.profile?.first_name ?? "Agent"}
              lastName={summary.profile?.last_name ?? ""}
              headshotUrl={summary.profile?.headshot_url ?? null}
              aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 8)}` : undefined}
            />
          </AgentSectionCard>

          {/* 2. Needs attention */}
          <AgentSectionCard className="space-y-4 p-6 md:p-8">
            <div>
              <h2 className={agentSectionTitle}>Needs attention</h2>
              <p className={`mt-1 ${agentSectionDesc}`}>Invites, messages, and listing tasks worth a quick tap.</p>
            </div>
            <NeedsAttentionPills items={summary.attentionItems} />
            {summary.attentionItems.length === 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-dashed border-zinc-100 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#50C878]" aria-hidden />
                <p className="text-sm text-neutral-600">Nothing needs your attention right now.</p>
              </div>
            )}
          </AgentSectionCard>

          {/* 3. Buyers */}
          <AgentSectionCard className="p-6 md:p-8">
            <DashboardBuyersTable buyers={summary.buyers} />
          </AgentSectionCard>

          {/* 4. Market activity · My listings */}
          <AgentSectionCard className="p-6 md:p-8">
            <div className="flex flex-col gap-10 lg:gap-12">
              <MarketActivityRow />
              <div>
                {summary.listings.length > 0 ? (
                  <MyListingsRow listings={summary.listings} />
                ) : (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h2 className={agentSectionTitle}>My listings</h2>
                    </div>
                    <div className="rounded-2xl border border-dashed border-zinc-100 px-6 py-10 text-center">
                      <h3 className="text-base font-semibold text-neutral-900">No active listings yet</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                        Add your first listing to start matching with buyers and generating activity.
                      </p>
                      <div className="mt-5">
                        <Button
                          className="rounded-full bg-[#0E56F5] text-white hover:bg-[#0B46CC]"
                          onClick={() => {
                            window.location.href = "/agent/listings/new";
                          }}
                        >
                          Add Listing
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </AgentSectionCard>

          {/* 5. Communications */}
          <AgentSectionCard className="p-6 md:p-8">
            <DashboardCommunications conversations={summary.conversations} />
          </AgentSectionCard>
        </AgentAacPage>
      )}
    </>
  );
}
