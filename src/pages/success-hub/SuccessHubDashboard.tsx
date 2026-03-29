import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import { WelcomeHeader } from "@/components/agent-dashboard-v2/WelcomeHeader";
import { NeedsAttentionPills } from "@/components/success-hub/NeedsAttentionPills";
import { MyListingsRow } from "@/components/agent-dashboard-v2/MyListingsRow";
import { ListingsOpportunityCenter } from "@/components/success-hub/ListingsOpportunityCenter";
import { DashboardCommunications } from "@/components/success-hub/DashboardCommunications";
import { DashboardBuyersTable } from "@/components/success-hub/DashboardBuyersTable";

export default function SuccessHubDashboard() {
  const { summary, loading, error } = useSuccessHubData();

  // Loading state
  if (loading) {
    return (
      <PageShell className="bg-secondary/40">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-40 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  // Error state
  if (error || !summary) {
    return (
      <PageShell className="bg-secondary/40">
        <Card className="border border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">{error ?? "Unable to load dashboard data."}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const { profile } = summary;

  return (
    <PageShell className="bg-secondary/40">
      <div className="pt-6">
      {/* ── 1. Welcome Header ──────────────────────────── */}
      <div className="mb-4">
        <WelcomeHeader
          firstName={profile?.first_name ?? "Agent"}
          lastName={profile?.last_name ?? ""}
          headshotUrl={profile?.headshot_url ?? null}
          aacId={summary.agentId ? `AAC-${summary.agentId.slice(0, 8)}` : undefined}
        />
      </div>

      {/* ── 2. Status Pills ────────────────────────────── */}
      <div className="mb-8">
        <NeedsAttentionPills items={summary.attentionItems} />
      </div>

      {/* ── 3. My Listings (horizontal image cards) ───── */}
      <div className="mb-10">
        {summary.listings.length > 0 ? (
          <MyListingsRow listings={summary.listings} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">My Listings</h3>
            </div>
            <ListingsOpportunityCenter
              activeBuyerCount={summary.buyers.length}
              opportunityCount={summary.attentionItems.length}
              networkActivityCount={summary.conversations.length}
            />
          </>
        )}
      </div>

      {/* ── 4. Communications + Buyers (side-by-side) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        <DashboardCommunications conversations={summary.conversations} />
        <DashboardBuyersTable buyers={summary.buyers} />
      </div>
      </div>
    </PageShell>
  );
}
