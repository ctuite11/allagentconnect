import { Helmet } from "react-helmet-async";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { useAuthRole } from "@/hooks/useAuthRole";
import {
  WelcomeHeader,
  NeedsAttentionBar,
  MyListingsRow,
  CommunicationsPanel,
  BuyersTable,
  DashboardSidebar,
} from "@/components/agent-dashboard-v2";

/**
 * Agent Dashboard V2 — parallel redesign.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 */
const AgentDashboardV2 = () => {
  const { summary, loading, error } = useSuccessHubData();

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex-1 bg-zinc-50 p-8">
          <div className="space-y-4 animate-pulse max-w-[1200px]">
            <div className="h-16 rounded-xl bg-zinc-200" />
            <div className="h-8 rounded-lg bg-zinc-200 w-2/3" />
            <div className="h-64 rounded-xl bg-zinc-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex-1 bg-zinc-50 flex items-center justify-center">
          <p className="text-zinc-500">{error ?? "Unable to load dashboard data."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard — All Agent Connect</title>
      </Helmet>

      <div className="flex min-h-screen">
        <DashboardSidebar />

        <main className="flex-1 bg-zinc-50 overflow-y-auto p-8">
          <div className="space-y-6 max-w-[1200px]">
            <WelcomeHeader
              firstName={summary.profile?.first_name ?? "Agent"}
              lastName={summary.profile?.last_name ?? ""}
              headshotUrl={summary.profile?.headshot_url ?? null}
              aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 5).toUpperCase()}` : undefined}
            />
            <NeedsAttentionBar items={summary.attentionItems} />
            <MyListingsRow listings={summary.listings} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <CommunicationsPanel conversations={summary.conversations} />
              <BuyersTable buyers={summary.buyers} />
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AgentDashboardV2;
