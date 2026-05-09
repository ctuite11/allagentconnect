import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { MarketActivityRow } from "@/components/success-hub/MarketActivityRow";
import { DashboardCommunications } from "@/components/success-hub/DashboardCommunications";
import { DashboardBuyersTable } from "@/components/success-hub/DashboardBuyersTable";
import { SuccessHubHero } from "@/components/success-hub/SuccessHubHero";
import { SuccessHubStatRow } from "@/components/success-hub/SuccessHubStatRow";
import { SuccessHubListingCard } from "@/components/success-hub/SuccessHubListingCard";
import { SUCCESS_HUB_LISTINGS_GRID } from "@/components/success-hub/successHubListingLayout";
import { mapSummaryListingToListingCard } from "@/components/success-hub/listingCardAdapter";
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

/** In-shell placeholder — keeps sidebar + layout stable; avoids a second full-page monogram. */
function WorkspaceSkeletonRails() {
  return (
    <div className="space-y-6" aria-busy="true" role="status" aria-live="polite">
      <span className="sr-only">Loading workspace…</span>
      <div className="rounded-2xl border border-zinc-200/90 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Skeleton className="h-8 w-56 rounded-md bg-zinc-100" />
        <Skeleton className="mt-3 h-3.5 max-w-xl rounded-md bg-zinc-100" />
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full bg-zinc-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded-md bg-zinc-100" />
            <Skeleton className="h-3 w-52 rounded-md bg-zinc-100" />
          </div>
        </div>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <Skeleton className="h-4 w-4 rounded bg-zinc-100" />
            <Skeleton className="mt-3 h-7 w-10 rounded-md bg-zinc-100" />
            <Skeleton className="mt-2 h-3 w-24 rounded-md bg-zinc-100" />
            <Skeleton className="mt-2 h-3 w-28 rounded-md bg-zinc-100" />
          </div>
        ))}
      </section>
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Skeleton className="h-[120px] w-full rounded-xl bg-zinc-100/90" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%]">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <Skeleton className="h-4 w-32 rounded-md bg-zinc-100" />
          <Skeleton className="mt-8 h-[200px] w-full rounded-xl bg-zinc-100/90" />
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <Skeleton className="h-4 w-28 rounded-md bg-zinc-100" />
          <Skeleton className="mt-8 h-[200px] w-full rounded-xl bg-zinc-100/90" />
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-100 bg-white p-5">
        <Skeleton className="h-4 w-36 rounded-md bg-zinc-100" />
        <Skeleton className="mt-4 h-[140px] w-full rounded-xl bg-zinc-100/90" />
      </div>
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

  return (
    <AgentAacPage className="space-y-6 pb-10">
      {error ? (
        <AgentSectionCard className="border border-zinc-100 bg-white p-5">
          <p className="text-sm font-medium text-neutral-900">Could not load Success Hub</p>
          <p className="mt-3 text-xs whitespace-pre-wrap break-words text-red-600">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </AgentSectionCard>
      ) : null}

      {loading ? <WorkspaceSkeletonRails /> : null}

      {!loading ? <SuccessHubHero summary={summary} /> : null}
      {!loading ? <SuccessHubStatRow summary={summary} /> : null}

      {!loading ? (
        <AgentSectionCard className="p-5">
          <MarketActivityRow />
        </AgentSectionCard>
      ) : null}

      {!loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%] lg:items-stretch">
          <AgentSectionCard className="flex min-h-0 flex-col p-5">
            <DashboardBuyersTable buyers={safeBuyers} />
          </AgentSectionCard>

          <AgentSectionCard className="flex min-h-0 flex-col p-5">
            <DashboardCommunications conversations={safeCommunications} compact inboxPreview />
          </AgentSectionCard>
        </div>
      ) : null}

      {!loading ? (
      <AgentSectionCard className="p-5">
        {safeListings.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">My listings</h3>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                  Your active AAC listings — views and engagement at a glance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/agent/listings";
                }}
                className="shrink-0 text-sm font-medium text-[#0E56F5] hover:underline"
              >
                View all →
              </button>
            </div>
            <div className={SUCCESS_HUB_LISTINGS_GRID}>
              {safeListings.map((l) => (
                <SuccessHubListingCard
                  key={l.id}
                  compactAgentOwned
                  listing={mapSummaryListingToListingCard(l, summary.agentId, summary.profile)}
                />
              ))}
            </div>
          </>
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
      ) : null}
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
