import { Helmet } from "react-helmet-async";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import {
  WelcomeHeader,
  NeedsAttentionBar,
  MyListingsRow,
  CommunicationsPanel,
  BuyersTable,
  MatchesOpportunities,
} from "@/components/agent-dashboard-v2";

/**
 * Agent Dashboard V2 — parallel redesign.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 * Sidebar is provided by AppShell — no local sidebar render needed.
 */
const AgentDashboardV2 = () => {
  const { summary, loading, error } = useSuccessHubData();

  if (loading) {
    return (
      <div className="flex-1 bg-zinc-50 p-8">
        <div className="space-y-4 animate-pulse max-w-[1200px]">
          <div className="h-16 rounded-xl bg-zinc-200" />
          <div className="h-8 rounded-lg bg-zinc-200 w-2/3" />
          <div className="h-64 rounded-xl bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex-1 bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500">{error ?? "Unable to load dashboard data."}</p>
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
