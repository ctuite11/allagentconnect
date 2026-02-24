import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { mockBuyers } from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  new: "outline",
};

export default function BuyersList() {
  const navigate = useNavigate();

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader
        title="Your Buyers"
        subtitle="Select a buyer to manage their hot sheets, favorites, and activity."
        backTo="/success-hub"
      />

      {mockBuyers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No buyers yet.</p>
      ) : (
        <div className="space-y-2">
          {mockBuyers.map((b) => (
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
                  <Badge variant={statusVariant[b.status]} className="text-[10px]">{b.status}</Badge>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {b.hotSheets} hot sheet{b.hotSheets !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Last active {b.lastActive}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
