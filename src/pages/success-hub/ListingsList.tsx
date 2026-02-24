import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, BarChart3 } from "lucide-react";
import { mockListings } from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  under_agreement: "secondary",
};

export default function ListingsList() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHeader
        title="Your Listings"
        subtitle="Click a listing to view its performance dashboard."
        backTo="/success-hub"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {mockListings.map((l) => (
          <Card
            key={l.listingId}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/success-hub/listings/${l.listingId}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-foreground">{l.address}</p>
                  <p className="text-sm text-muted-foreground">{l.city}, {l.state}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[l.status]}>{l.status.replace("_", " ")}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">${l.price.toLocaleString()}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {l.metrics.matches} matches</span>
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
