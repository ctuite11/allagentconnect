import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Users, Mail, TrendingUp, MessageSquare } from "lucide-react";
import { useSuccessHubData } from "@/hooks/useSuccessHubData";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

// ── Mapping layer ─────────────────────────────────────────────
// Stable view-model objects so the approved UI never depends on raw hook shapes.

interface DashboardMetric {
  label: string;
  value: number;
}

interface DashboardListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  status: string;
}

interface DashboardBuyer {
  id: string;
  name: string;
  email: string;
  status: string;
  hotSheets: number;
}

interface DashboardConversation {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  isUnread: boolean;
}

function mapMetrics(summary: SuccessHubSummary): DashboardMetric[] {
  return [
    { label: "PENDING INVITES", value: summary.metrics.pendingInviteCount },
    { label: "ACTIVE BUYERS", value: summary.metrics.activeBuyerCount },
    { label: "ACTIVE LISTINGS", value: summary.listings.filter((l) => l.status === "active").length },
    { label: "UNREAD MESSAGES", value: summary.metrics.unreadMessageCount },
  ];
}

function mapListings(summary: SuccessHubSummary): DashboardListing[] {
  return summary.listings.map((l) => ({
    id: l.id,
    address: l.address,
    city: l.city,
    state: l.state,
    price: l.price ?? 0,
    status: l.status,
  }));
}

function mapBuyers(summary: SuccessHubSummary): DashboardBuyer[] {
  return summary.buyers.map((b) => {
    const name = [b.first_name, b.last_name].filter(Boolean).join(" ").trim() || b.email;
    return {
      id: b.id,
      name,
      email: b.email,
      status: b.status,
      hotSheets: b.hotSheetCount,
    };
  });
}

function mapConversations(summary: SuccessHubSummary): DashboardConversation[] {
  return summary.conversations.map((c) => ({
    id: c.conversation_id,
    title: c.other_name ?? "Agent",
    preview: c.last_message_preview ?? "",
    timestamp: c.last_message_at,
    isUnread: c.is_unread,
  }));
}

// ── Visual helpers (preserved from approved design) ───────────

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  new: "outline",
  under_agreement: "secondary",
  coming_soon: "outline",
  off_market: "secondary",
};

function formatPrice(n: number) {
  return "$" + n.toLocaleString();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ─────────────────────────────────────────────────

export default function SuccessHubDashboard() {
  const navigate = useNavigate();
  const { summary, loading, error } = useSuccessHubData();

  // Loading state
  if (loading) {
    return (
      <PageShell className="bg-secondary/40">
        <PageHeader title="Success Hub" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-8 px-5">
                <Skeleton className="h-10 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  // Error state
  if (error || !summary) {
    return (
      <PageShell className="bg-secondary/40">
        <PageHeader title="Success Hub" />
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

  // Map to stable view-models
  const dashboardMetrics = mapMetrics(summary);
  const dashboardListings = mapListings(summary);
  const dashboardBuyers = mapBuyers(summary);
  const dashboardConversations = mapConversations(summary);

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader title="Success Hub" />

      {/* ── Metric Tiles ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {dashboardMetrics.map((m) => (
          <Card key={m.label} className="border border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-8 px-5">
              <span className="text-4xl font-bold text-foreground tracking-tight">{m.value}</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mt-2">{m.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── My Listings ────────────────────────────────── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">My Listings</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/agent/listings")}>
            View All <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        {dashboardListings.length === 0 ? (
          <Card className="border border-border bg-card">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No listings yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboardListings.slice(0, 4).map((l) => (
              <Card
                key={l.id}
                className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
                onClick={() => navigate(`/property/${l.id}`)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{l.address}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state}</p>
                    <p className="text-lg font-bold text-foreground mt-1.5">{formatPrice(l.price)}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Badge variant={statusVariant[l.status] ?? "outline"} className="text-[10px] opacity-70">{l.status.replace("_", " ")}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── My Buyers ──────────────────────────────────── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">My Buyers</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/my-clients")}>
            View All <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        {dashboardBuyers.length === 0 ? (
          <Card className="border border-border bg-card">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No buyers yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboardBuyers.slice(0, 4).map((b) => (
              <Card
                key={b.id}
                className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
                onClick={() => navigate(`/my-clients`)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusVariant[b.status] ?? "outline"} className="text-[10px] opacity-70">{b.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">{b.hotSheets} HS</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Communications Center ──────────────────────── */}
      <section className="mb-20">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Communications</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/communications")}>
            Open <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        {dashboardConversations.length === 0 ? (
          <Card className="border border-border bg-card">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border bg-card">
            <CardContent className="p-0 divide-y divide-border/60">
              {dashboardConversations.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <MessageSquare className={`h-3.5 w-3.5 ${item.isUnread ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relativeTime(item.timestamp)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
