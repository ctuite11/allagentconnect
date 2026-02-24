import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock, Users, Home, Mail, TrendingUp, Megaphone } from "lucide-react";
import { mockMetrics, mockBuyers, mockListings, mockCommunications, type FeedType } from "./mockData";

const feedIcon: Record<FeedType, React.ReactNode> = {
  buyer_need: <Users className="h-3.5 w-3.5 text-primary" />,
  email: <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
  market_signal: <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />,
  agent_post: <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />,
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  new: "outline",
  under_agreement: "secondary",
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

const metricItems = [
  { label: "PENDING INVITES", value: mockMetrics.pendingInvites },
  { label: "ACTIVE BUYERS", value: mockMetrics.activeBuyers },
  { label: "ACTIVE LISTINGS", value: mockMetrics.activeListings },
  { label: "UNREAD MESSAGES", value: mockMetrics.unreadMessages },
];

export default function SuccessHubDashboard() {
  const navigate = useNavigate();

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader title="Success Hub" />

      {/* ── Metric Tiles ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {metricItems.map((m) => (
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
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/success-hub/listings")}>
            View All <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mockListings.slice(0, 4).map((l) => (
            <Card
              key={l.listingId}
              className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
              onClick={() => navigate(`/success-hub/listings/${l.listingId}`)}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{l.address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state}</p>
                  <p className="text-lg font-bold text-foreground mt-1.5">{formatPrice(l.price)}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge variant={statusVariant[l.status]} className="text-[10px] opacity-70">{l.status.replace("_", " ")}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── My Buyers ──────────────────────────────────── */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">My Buyers</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/success-hub/buyers")}>
            View All <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {mockBuyers.slice(0, 4).map((b) => (
            <Card
              key={b.buyerId}
              className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
              onClick={() => navigate(`/success-hub/buyers/${b.buyerId}`)}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{b.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={statusVariant[b.status]} className="text-[10px] opacity-70">{b.status}</Badge>
                  <span className="text-[11px] text-muted-foreground">{b.hotSheets} HS</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Communications Center ──────────────────────── */}
      <section className="mb-20">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Communications</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/communications")}>
            Open <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>
        <Card className="border border-border bg-card">
          <CardContent className="p-0 divide-y divide-border/60">
            {mockCommunications.slice(0, 5).map((item) => (
              <div key={item.feedId} className="flex items-center gap-3 px-5 py-3.5">
                {feedIcon[item.type]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relativeTime(item.timestamp)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
