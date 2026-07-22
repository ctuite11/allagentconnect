import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, MessageSquare, ArrowRight } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useAgentProfileOnboarding } from "@/hooks/useAgentProfileOnboarding";
import { AgentProfileOnboardingOverlay } from "@/components/success-hub/AgentProfileOnboardingOverlay";
import { MarketActivityRow } from "@/components/success-hub/MarketActivityRow";
import { DashboardCommunications } from "@/components/success-hub/DashboardCommunications";
import { DashboardBuyersTable } from "@/components/success-hub/DashboardBuyersTable";
import { SuccessHubHero } from "@/components/success-hub/SuccessHubHero";
import { NetworkActivitySection } from "@/components/success-hub/networkActivity/NetworkActivitySection";
import { NewestVerifiedAgentsRow } from "@/components/success-hub/networkActivity/NetworkActivitySection";
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
  leading,
}: {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  leading?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className={`${agentSectionTitle} inline-flex flex-wrap items-center gap-2`}>
          {leading}
          {title}
        </h2>
        {description ? <p className={`mt-0.5 ${agentSectionDesc}`}>{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-sm text-sm font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
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
      <div className="rounded-xl border border-neutral-200 bg-white px-5 py-3 shadow-sm">
        <Skeleton className="h-7 w-36 max-w-full rounded-md bg-neutral-100" />
        <Skeleton className="mt-1.5 h-3.5 w-28 rounded-md bg-neutral-100" />
        <Skeleton className="mt-1 h-3 max-w-xl rounded-md bg-neutral-100" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full bg-neutral-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded-md bg-neutral-100" />
            <Skeleton className="h-3 w-52 rounded-md bg-neutral-100" />
          </div>
        </div>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-4 rounded bg-neutral-100" />
            <Skeleton className="mt-3 h-7 w-10 rounded-md bg-neutral-100" />
            <Skeleton className="mt-2 h-3 w-24 rounded-md bg-neutral-100" />
            <Skeleton className="mt-2 h-3 w-28 rounded-md bg-neutral-100" />
          </div>
        ))}
      </section>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40 rounded-md bg-neutral-100" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <Skeleton className="h-4 w-32 rounded-md bg-neutral-100" />
              <Skeleton className="mt-3 h-[120px] w-full rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-[120px] w-full rounded-lg bg-neutral-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-4 w-32 rounded-md bg-neutral-100" />
          <Skeleton className="mt-8 h-[200px] w-full rounded-lg bg-neutral-100" />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-4 w-28 rounded-md bg-neutral-100" />
          <Skeleton className="mt-8 h-[200px] w-full rounded-lg bg-neutral-100" />
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
        <Skeleton className="mt-4 h-[140px] w-full rounded-lg bg-neutral-100" />
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
          <AgentSectionCard className="border-neutral-200 p-6 shadow-sm hover:border-neutral-200 hover:shadow-sm">
            <p className="text-sm font-medium text-neutral-900">Could not load Success Hub</p>
            <p className="mt-3 text-xs whitespace-pre-wrap break-words text-red-600">
              {this.state.error.message}
            </p>
            <Button
              size="sm"
              type="button"
              className="mt-4 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
              onClick={() => window.location.reload()}
            >
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
  const navigate = useNavigate();
  const { user } = useAuthRole();
  const { visible: showProfileOnboarding, handleLater, handleCompleteProfile } =
    useAgentProfileOnboarding(user);
  const {
    summary,
    loading,
    error,
    buyers,
    listings,
    communications,
    refetch,
  } = useSuccessHubData();

  const goToAddListing = () =>
    navigate(ROUTES.ADD_LISTING, { state: { from: ROUTES.SUCCESS_HUB_RETURN } });

  const safeBuyers = buyers ?? [];
  const safeListings = listings ?? [];
  const safeCommunications = communications ?? [];

  return (
    <>
      {showProfileOnboarding ? (
        <AgentProfileOnboardingOverlay
          onLater={handleLater}
          onCompleteProfile={handleCompleteProfile}
        />
      ) : null}
      <AgentAacPage className="space-y-8 pb-10">
      {error ? (
        <AgentSectionCard className="border-neutral-200 p-5 shadow-sm hover:border-neutral-200 hover:shadow-sm">
          <p className="text-sm font-medium text-neutral-900">Could not load Success Hub</p>
          <p className="mt-3 text-xs whitespace-pre-wrap break-words text-red-600">{error}</p>
          <Button
            size="sm"
            type="button"
            className="mt-4 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </AgentSectionCard>
      ) : null}

      {loading ? <WorkspaceSkeletonRails /> : null}

      {!loading ? <SuccessHubHero summary={summary} /> : null}
      {!loading ? <SuccessHubStatRow summary={summary} /> : null}

      {!loading ? <NetworkActivitySection /> : null}

      {!loading ? <NewestVerifiedAgentsRow /> : null}

      {!loading ? (
        <AgentSectionCard className="border-neutral-200 p-5 shadow-sm hover:border-neutral-200 hover:shadow-sm">
          <MarketActivityRow />
        </AgentSectionCard>
      ) : null}

      {!loading ? (
        <AgentSectionCard className="flex min-h-0 flex-col border-neutral-200 p-5 shadow-sm hover:border-neutral-200 hover:shadow-sm">
          <DashboardBuyersTable buyers={safeBuyers} />
        </AgentSectionCard>
      ) : null}

      {!loading ? (
        <button
          type="button"
          onClick={() => navigate("/communications")}
          className="group block w-full text-left rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-[#0E56F5]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-2"
          aria-label="Open Communications Center"
        >
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0E56F5]/10 text-[#0E56F5]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E56F5]">
                  Communications Center
                </p>
                <ArrowRight className="h-4 w-4 text-[#0E56F5] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </div>
              <p className="mt-1 text-base font-semibold text-neutral-900 sm:text-lg">
                Control what you receive and connect with agents across the network.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Buyer Needs", "Seller Needs", "Renter Needs", "General Discussions"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Choose what you want to receive, manage your communication preferences, and view network activity in one place.
              </p>
            </div>
          </div>
        </button>
      ) : null}

      {!loading ? (
        <AgentSectionCard className="flex min-h-0 flex-col border-neutral-200 p-5 shadow-sm hover:border-neutral-200 hover:shadow-sm">
          <DashboardCommunications conversations={safeCommunications} compact inboxPreview />
        </AgentSectionCard>
      ) : null}

      {!loading ? (
      <AgentSectionCard className="border-neutral-200 p-5 shadow-sm hover:border-neutral-200 hover:shadow-sm">
        {safeListings.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-neutral-900">
                  <Home className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  My listings
                </h3>
                <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                  Your active AAC listings — views and engagement at a glance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/agent/listings")}
                className="shrink-0 rounded-sm border-0 bg-transparent p-0 text-sm font-medium text-black underline-offset-2 shadow-none transition-colors hover:text-black hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
              >
                View all →
              </button>
            </div>
            <div className={SUCCESS_HUB_LISTINGS_GRID}>
              {safeListings.map((l) => (
                <SuccessHubListingCard
                  key={l.id}
                  compactAgentOwned
                  compactClickTo="/agent/listings"
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
              onAction={goToAddListing}
              leading={<Home className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />}
            />
            <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-4 text-center">
              <h3 className="text-sm font-semibold text-neutral-900">No active listings yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
                Add a listing to appear here and in buyer matching.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                onClick={goToAddListing}
              >
                Add Listing
              </Button>
            </div>
          </>
        )}
      </AgentSectionCard>
      ) : null}
      </AgentAacPage>
    </>
  );
}

export default function SuccessHubDashboard() {
  return (
    <>
      <Seo title="Success Hub" />
      <SuccessHubErrorBoundary>
        <SuccessHubDashboardBody />
      </SuccessHubErrorBoundary>
    </>
  );
}
