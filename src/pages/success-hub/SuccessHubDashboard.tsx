import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { NeedsAttentionPills } from "@/components/success-hub/NeedsAttentionPills";
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
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-32 rounded-2xl border border-zinc-100 bg-white" />
              <Skeleton className="h-48 rounded-2xl border border-zinc-100 bg-white" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-44 rounded-2xl border border-zinc-100 bg-white" />
              <Skeleton className="h-52 rounded-2xl border border-zinc-100 bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl border border-zinc-100 bg-white" />
            ))}
          </div>
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-6">
              <AgentSectionCard className="p-5">
                <SectionHeader
                  title="Needs attention"
                  description="Invites, messages, and tasks that need a quick tap."
                  actionLabel="View buyers"
                  onAction={() => navigate("/success-hub/buyers")}
                />
                <NeedsAttentionPills items={summary.attentionItems} />
                {summary.attentionItems.length === 0 ? (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-dashed border-zinc-100 px-3 py-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#50C878]" aria-hidden />
                    <p className="text-sm text-neutral-600">You&apos;re all caught up.</p>
                  </div>
                ) : null}
              </AgentSectionCard>

              <AgentSectionCard className="p-5">
                <DashboardBuyersTable buyers={summary.buyers} />
              </AgentSectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <AgentSectionCard className="p-5">
                <DashboardCommunications conversations={summary.conversations} compact inboxPreview />
              </AgentSectionCard>

              <AgentSectionCard className="p-5">
                {summary.listings.length > 0 ? (
                  <MyListingsRow listings={summary.listings} denseGrid />
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
                    <div className="rounded-2xl border border-dashed border-zinc-100 px-4 py-5 text-center">
                      <h3 className="text-sm font-semibold text-neutral-900">No active listings yet</h3>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-neutral-500">
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
            </div>
          </div>

          <AgentSectionCard className="p-5">
            <MarketActivityRow />
          </AgentSectionCard>
        </AgentAacPage>
      )}
    </>
  );
}
