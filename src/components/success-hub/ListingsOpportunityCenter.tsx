import { useNavigate } from "react-router-dom";
import { Plus, Users, Zap, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListingsOpportunityCenterProps {
  activeBuyerCount: number;
  opportunityCount: number;
  networkActivityCount: number;
}

const stats = [
  { key: "buyers", label: "Active Buyers", icon: Users, route: "/success-hub/buyers" },
  { key: "opportunities", label: "New Opportunities", icon: Zap, route: "/communications" },
  { key: "network", label: "Network Activity", icon: MessageCircle, route: "/messages" },
] as const;

export function ListingsOpportunityCenter({
  activeBuyerCount,
  opportunityCount,
  networkActivityCount,
}: ListingsOpportunityCenterProps) {
  const navigate = useNavigate();

  const values: Record<string, number> = {
    buyers: activeBuyerCount,
    opportunities: opportunityCount,
    network: networkActivityCount,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Headline */}
      <div className="text-center mb-5">
        <h4 className="text-base font-semibold text-foreground">
          You don't have any active listings yet
        </h4>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add your first listing to start tracking activity,
          uncover matches, and connect with buyer demand across your network.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <Button size="sm" onClick={() => navigate("/agent/listings/new")}>
          <Plus className="h-4 w-4" />
          Add Listing
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {stats.map(({ key, label, icon: Icon, route }) => (
          <div
            key={key}
            onClick={() => navigate(route)}
            className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xl font-bold text-foreground">{values[key]}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="text-center">
        <button
          onClick={() => navigate("/communications")}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View Opportunities
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
