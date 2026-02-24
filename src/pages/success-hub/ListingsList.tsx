import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { mockListings } from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  under_agreement: "secondary",
};

export default function ListingsList() {
  const navigate = useNavigate();

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader
        title="Your Listings"
        subtitle="Click a listing to view its performance dashboard."
        backTo="/success-hub"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {mockListings.map((l) => (
          <Card
            key={l.listingId}
            className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
            onClick={() => navigate(`/success-hub/listings/${l.listingId}`)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm text-foreground">{l.address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant[l.status]} className="text-[10px]">{l.status.replace("_", " ")}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-semibold text-foreground">${l.price.toLocaleString()}</span>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{l.metrics.matches} matches</span>
                  <span>{l.metrics.likes} likes</span>
                  <span>{l.metrics.shares} shares</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
