import { useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Copy, FileDown, Users, Heart, Share2, Bookmark, Clock } from "lucide-react";
import { toast } from "sonner";
import { mockListings } from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  under_agreement: "secondary",
};

const metricItems = [
  { key: "matches" as const, label: "Matches", icon: Users },
  { key: "likes" as const, label: "Likes", icon: Heart },
  { key: "shares" as const, label: "Shares", icon: Share2 },
  { key: "saves" as const, label: "Saves", icon: Bookmark },
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
    <PageShell>
      <PageHeader title={listing.address} backTo="/success-hub/listings" />

      {/* ── Top row ────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-foreground">${listing.price.toLocaleString()}</span>
          <Badge variant={statusVariant[listing.status]}>{listing.status.replace("_", " ")}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Listing
        </Button>
      </div>

      {/* ── Metrics tiles ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {metricItems.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex flex-col items-center justify-center p-5">
              <Icon className="h-5 w-5 text-muted-foreground mb-2" />
              <span className="text-2xl font-bold text-foreground">{listing.metrics[key]}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Share with Seller ──────────────────────────── */}
      <Card className="mb-8">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-3">Share with Seller</h3>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon")}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="mb-6" />

      {/* ── Activity / Events ──────────────────────────── */}
      <section>
        <h3 className="font-semibold text-foreground mb-4">Activity</h3>
        <div className="space-y-3">
          {listing.events.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{ev.label}</p>
                <p className="text-xs text-muted-foreground">{ev.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
