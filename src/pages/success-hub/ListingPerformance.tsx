import { useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Copy, FileDown, Users, Heart, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { mockListings } from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  under_agreement: "secondary",
};

const metricItems = [
  { key: "matches" as const, label: "MATCHES", icon: Users },
  { key: "likes" as const, label: "LIKES", icon: Heart },
  { key: "shares" as const, label: "SHARES", icon: Share2 },
  { key: "saves" as const, label: "SAVES", icon: Bookmark },
];

export default function ListingPerformance() {
  const { listingId } = useParams<{ listingId: string }>();
  const listing = mockListings.find((l) => l.listingId === listingId);

  if (!listing) {
    return (
      <PageShell>
        <PageHeader title="Listing Not Found" backTo="/success-hub/listings" />
        <p className="text-muted-foreground">No listing found with that ID.</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader title={listing.address} backTo="/success-hub/listings" />

      {/* ── Top row ────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-semibold text-foreground tracking-tight">${listing.price.toLocaleString()}</span>
          <Badge variant={statusVariant[listing.status]} className="text-[10px]">{listing.status.replace("_", " ")}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Listing
        </Button>
      </div>

      {/* ── Metrics tiles ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {metricItems.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="border border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-6 px-4">
              <Icon className="h-4 w-4 text-muted-foreground mb-2" />
              <span className="text-3xl font-semibold text-foreground tracking-tight">{listing.metrics[key]}</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mt-1.5">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Share with Seller ──────────────────────────── */}
      <Card className="mb-10 border border-border bg-card">
        <CardContent className="p-6 text-center">
          <h3 className="text-sm font-semibold text-foreground mb-4">Share with Seller</h3>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Activity / Events ──────────────────────────── */}
      <section className="mb-16">
        <h3 className="text-sm font-semibold text-foreground mb-5">Activity</h3>
        <div className="relative pl-5 border-l border-border">
          {listing.events.map((ev, i) => (
            <div key={i} className="relative pb-5 last:pb-0">
              <div className="absolute -left-[11px] top-1 h-[7px] w-[7px] rounded-full bg-muted-foreground/40" />
              <p className="text-sm text-foreground">{ev.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ev.date}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
