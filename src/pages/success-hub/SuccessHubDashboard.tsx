import React from "react";
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

type SuccessHubBoundaryState = { error: Error | null };

/** Last resort for render-time failures so the route never stays blank. */
class SuccessHubErrorBoundary extends React.Component<
  React.PropsWithChildren,
  SuccessHubBoundaryState
> {
  state: SuccessHubBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SuccessHubBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SuccessHubDashboard]", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <AgentAacPage className="pb-10">
          <AgentSectionCard className="border border-zinc-100 bg-white p-6">
            <p className="text-sm font-medium text-neutral-900">Could not load Success Hub</p>
            <p className="mt-3 text-xs whitespace-pre-wrap break-words text-red-600">
              {this.state.error.message}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </AgentSectionCard>
        </AgentAacPage>
      );
    }
    return this.props.children;
  }
}

function SuccessHubDashboardBody() {
  const {
    summary,
    loading,
    error,
    buyers,
    listings,
    communications,
    refetch,
  } = useSuccessHubData();

  const safeBuyers = buyers ?? [];
  const safeListings = listings ?? [];
  const safeCommunications = communications ?? [];

  if (loading) {
    return (
      <AgentAacPage className="space-y-5 pb-10">
        <Skeleton className="h-36 w-full rounded-2xl border border-zinc-100 bg-white" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl border border-zinc-100 bg-white" />
          ))}
        </div>
        <Skeleton className="min-h-[160px] w-full rounded-2xl border border-zinc-100 bg-white" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-6">
          <Skeleton className="h-64 min-h-0 rounded-2xl border border-zinc-100 bg-white" />
          <Skeleton className="h-64 min-h-0 rounded-2xl border border-zinc-100 bg-white" />
        </div>
        <Skeleton className="min-h-[140px] w-full rounded-2xl border border-zinc-100 bg-white" />
      </AgentAacPage>
    );
  }

  return (
    <AgentAacPage className="space-y-5 pb-10">
      {error ? (
        <AgentSectionCard className="border border-zinc-100 bg-white p-6">
          <p className="text-sm font-medium text-neutral-900">Could not load Success Hub</p>
          <p className="mt-3 text-xs whitespace-pre-wrap break-words text-red-600">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </AgentSectionCard>
      ) : null}

      <SuccessHubHero summary={summary} />
      <SuccessHubStatRow summary={summary} />

      <AgentSectionCard className="p-5">
        <MarketActivityRow />
      </AgentSectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-stretch lg:gap-6">
        <AgentSectionCard className="flex min-h-0 flex-col p-5">
          <DashboardBuyersTable buyers={safeBuyers} />
        </AgentSectionCard>

        <AgentSectionCard className="flex min-h-0 flex-col p-5">
          <DashboardCommunications conversations={safeCommunications} compact inboxPreview />
        </AgentSectionCard>
      </div>

      <AgentSectionCard className="p-5">
        {safeListings.length > 0 ? (
          <MyListingsRow listings={safeListings} autoFitGrid />
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
            <div className="rounded-xl border border-dashed border-zinc-100 px-4 py-3 text-center">
              <h3 className="text-sm font-semibold text-neutral-900">No active listings yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
                Add a listing to appear here and in buyer matching.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2 rounded-full bg-[#0E56F5] text-white hover:bg-[#0B46CC]"
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
  );
}

export default function SuccessHubDashboard() {
  return (
    <>
      <Seo title="Dashboard" />
      <SuccessHubErrorBoundary>
        <SuccessHubDashboardBody />
      </SuccessHubErrorBoundary>
    </>
  );
}
