import { Helmet } from "react-helmet-async";
import PageShell from "@/components/layout/PageShell";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import {
  WelcomeHeader,
  NeedsAttentionBar,
  MyListingsRow,
  CommunicationsPanel,
  BuyersTable,
} from "@/components/agent-dashboard-v2";

/**
 * Agent Dashboard V2 — parallel redesign.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 */
const AgentDashboardV2 = () => {
  const { summary, loading, error } = useSuccessHubData();

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-4 animate-pulse">
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-8 rounded-lg bg-muted w-2/3" />
          <div className="h-64 rounded-xl bg-muted" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-72 rounded-xl bg-muted" />
            <div className="h-72 rounded-xl bg-muted" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !summary) {
    return (
      <PageShell>
        <div className="py-20 text-center text-muted-foreground">
          <p>{error ?? "Unable to load dashboard data."}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard — All Agent Connect</title>
      </Helmet>

      <PageShell className="pb-12">
        <div className="space-y-6 max-w-[1200px]">
          {/* Welcome */}
          <WelcomeHeader
            firstName={summary.profile?.first_name ?? "Agent"}
            lastName={summary.profile?.last_name ?? ""}
            headshotUrl={summary.profile?.headshot_url ?? null}
            aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 5).toUpperCase()}` : undefined}
          />

          {/* Needs Attention */}
          <NeedsAttentionBar items={summary.attentionItems} />

          {/* Listings carousel */}
          <MyListingsRow listings={summary.listings} />

          {/* Communications + Buyers side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CommunicationsPanel conversations={summary.conversations} />
            <BuyersTable buyers={summary.buyers} />
          </div>
        </div>
      </PageShell>
    </>
  );
};

export default AgentDashboardV2;
