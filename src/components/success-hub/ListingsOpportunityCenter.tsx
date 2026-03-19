import { useNavigate } from "react-router-dom";
import { Plus, Upload, Users, Zap, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListingsOpportunityCenterProps {
  activeBuyerCount: number;
  opportunityCount: number;
  networkActivityCount: number;
}

const stats = [
  { key: "buyers", label: "Active Buyers", icon: Users },
  { key: "opportunities", label: "New Opportunities", icon: Zap },
  { key: "network", label: "Network Activity", icon: MessageCircle },
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
          Add your first listing or import one to start tracking activity,
          uncover matches, and connect with buyer demand across your network.
        </p>
      </div>

      {/* Primary CTAs */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <Button size="sm" onClick={() => navigate("/agent/listings/new")}>
          <Plus className="h-4 w-4" />
          Add Listing
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/agent/listings/new")}
        >
          <Upload className="h-4 w-4" />
          Import Listing
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {stats.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center"
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
          onClick={() => navigate("/hot-sheets")}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View Opportunities
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
