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
import { useNavigate } from "react-router-dom";
import { MessageSquare, ArrowRight } from "lucide-react";

/**
 * Agent Dashboard V2 — parallel redesign.
 * The live dashboard remains at AgentDashboard.tsx / /agent-dashboard.
 * Sidebar is provided by AppShell — no local sidebar render needed.
 */
const AgentDashboardV2 = () => {
  const { summary, loading, error, refetch } = useSuccessHubData();
  const navigate = useNavigate();

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
          <button
            type="button"
            onClick={() => navigate("/communications")}
            className="group w-full text-left rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-blue-50/40 p-5 md:p-6 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#0E56F5]/30 hover:shadow-lg"
            aria-label="Open Communications Center"
          >
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0E56F5]/10 text-[#0E56F5]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E56F5]">
                    Communications Center
                  </p>
                  <ArrowRight className="h-4 w-4 text-[#0E56F5] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
                <p className="mt-1 text-base md:text-lg font-semibold text-zinc-900">
                  Control what you receive and connect with agents across the network.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Buyer Needs", "Seller Needs", "Renter Needs", "General Discussions"].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Choose what you want to receive, manage your communication preferences, and view network activity in one place.
                </p>
              </div>
            </div>
          </button>

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
