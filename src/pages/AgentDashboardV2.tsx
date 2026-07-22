import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import {
  WelcomeHeader,
  NeedsAttentionBar,
  MyListingsRow,
  CommunicationsPanel,
  BuyersTable,
  MatchesOpportunities,
} from "@/components/agent-dashboard-v2";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

/**
 * Agent Dashboard V2 — parallel redesign.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 * Sidebar is provided by AppShell — no local sidebar render needed.
 */
const AgentDashboardV2 = () => {
  const { summary, loading, error, refetch } = useSuccessHubData();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white p-8">
        <AacMonogramLoader variant="section" className="min-h-[50vh]" message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard — All Agent Connect</title>
      </Helmet>

      <main className="flex-1 bg-zinc-50 overflow-y-auto p-8">
        <div className="space-y-6 max-w-[1200px]">
          {error ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-medium text-zinc-900">Could not load Success Hub</p>
              <p className="mt-2 text-xs whitespace-pre-wrap break-words text-red-600">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" type="button" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          {/* 1. Welcome */}
          <WelcomeHeader
            firstName={summary.profile?.first_name ?? "Agent"}
            lastName={summary.profile?.last_name ?? ""}
            headshotUrl={summary.profile?.headshot_url ?? null}
            aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 5).toUpperCase()}` : undefined}
          />

          {/* 2. Needs Attention — prominent alert section */}
          <NeedsAttentionBar items={summary.attentionItems} />

          {/* 3. Communications — right after attention items */}
          <CommunicationsPanel conversations={summary.conversations} />

          {/* 4. Matches & Opportunities — new action-focused section */}
          <MatchesOpportunities buyers={summary.buyers} listings={summary.listings} />

          {/* 5. Listings — slightly reduced spacing */}
          <div className="pt-1">
            <MyListingsRow listings={summary.listings} />
          </div>

          {/* 6. Buyers — card list format */}
          <BuyersTable buyers={summary.buyers} />
        </div>
      </main>
    </>
  );
};

export default AgentDashboardV2;
