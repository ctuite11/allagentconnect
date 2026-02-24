import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, Users, Home, MessageSquare, Clock, Mail, TrendingUp, Megaphone } from "lucide-react";
import { mockMetrics, mockBuyers, mockListings, mockCommunications, type FeedType } from "./mockData";

const feedIcon: Record<FeedType, React.ReactNode> = {
  buyer_need: <Users className="h-4 w-4 text-primary" />,
  email: <Mail className="h-4 w-4 text-muted-foreground" />,
  market_signal: <TrendingUp className="h-4 w-4 text-neon-green" />,
  agent_post: <Megaphone className="h-4 w-4 text-warning" />,
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

export default function SuccessHubDashboard() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHeader title="Success Hub" />

      {/* ── Metrics Strip ──────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Pill label={`${mockMetrics.pendingInvites} Pending Invites`} variant="warning" />
        <Pill label={`${mockMetrics.activeBuyers} Active Buyers`} variant="success" />
        <Pill label={`${mockMetrics.activeListings} Active Listings`} variant="primary" />
        <Pill label={`${mockMetrics.unreadMessages} Unread Messages`} variant="danger" />
      </div>

      {/* ── My Listings ────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Listings</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/success-hub/listings")}>
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mockListings.slice(0, 4).map((l) => (
            <Card
              key={l.listingId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/success-hub/listings/${l.listingId}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">{l.address}</p>
                    <p className="text-xs text-muted-foreground">{l.city}, {l.state} · {formatPrice(l.price)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[l.status]}>{l.status.replace("_", " ")}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mb-8" />

      {/* ── My Buyers ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Buyers</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/success-hub/buyers")}>
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mockBuyers.slice(0, 4).map((b) => (
            <Card
              key={b.buyerId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/success-hub/buyers/${b.buyerId}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm text-foreground">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
                  <span className="text-xs text-muted-foreground">{b.hotSheets} HS</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mb-8" />

      {/* ── Communications Center ──────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Communications Center</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/communications")}>
            Open <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {mockCommunications.slice(0, 5).map((item) => (
            <div key={item.feedId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              {feedIcon[item.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
