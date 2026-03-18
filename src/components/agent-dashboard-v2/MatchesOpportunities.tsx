import { useNavigate } from "react-router-dom";
import { Users, TrendingUp, ChevronRight, Sparkles } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface MatchesOpportunitiesProps {
  buyers: SuccessHubSummary["buyers"];
  listings: SuccessHubSummary["listings"];
}

export function MatchesOpportunities({ buyers, listings }: MatchesOpportunitiesProps) {
  const navigate = useNavigate();

  const activeBuyers = buyers.filter((b) => b.status === "active");
  const activeListings = listings.filter((l) => l.status === "active");

  // Derive simple opportunity signals
  const opportunities: Array<{
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    action: string;
    path: string;
  }> = [];

  if (activeBuyers.length > 0 && activeListings.length > 0) {
    opportunities.push({
      id: "buyer-listing-match",
      icon: <Users className="h-5 w-5 text-primary" />,
      title: `${activeBuyers.length} active buyer${activeBuyers.length !== 1 ? "s" : ""} may match your listings`,
      description: `You have ${activeListings.length} active listing${activeListings.length !== 1 ? "s" : ""} that could align with buyer criteria.`,
      action: "Review Buyers",
      path: "/my-clients",
    });
  }

  if (activeListings.length > 0) {
    const totalViews = activeListings.reduce((sum, l) => sum + l.view_count, 0);
    if (totalViews > 0) {
      opportunities.push({
        id: "listing-demand",
        icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
        title: `${totalViews.toLocaleString()} total views across your listings`,
        description: "Active demand signals suggest agent interest in your coverage area.",
        action: "View Listings",
        path: "/listings",
      });
    }
  }

  if (activeBuyers.length > 0) {
    const withHotSheets = activeBuyers.filter((b) => b.hotSheetCount > 0).length;
    if (withHotSheets > 0) {
      opportunities.push({
        id: "hotsheet-activity",
        icon: <Sparkles className="h-5 w-5 text-amber-600" />,
        title: `${withHotSheets} buyer${withHotSheets !== 1 ? "s" : ""} on active hot sheets`,
        description: "These buyers are actively searching — follow up to stay engaged.",
        action: "View Hot Sheets",
        path: "/hot-sheets",
      });
    }
  }

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Matches & Opportunities</h3>
      </div>

      <div className="space-y-2">
        {opportunities.map((opp) => (
          <button
            key={opp.id}
            onClick={() => navigate(opp.path)}
            className="w-full flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-left hover:border-muted-foreground/30 transition-colors group"
          >
            <div className="shrink-0">{opp.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{opp.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opp.description}</p>
            </div>
            <span className="text-xs font-medium text-primary shrink-0 hidden sm:inline">
              {opp.action}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
