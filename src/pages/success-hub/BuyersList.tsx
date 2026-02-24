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
    <PageShell>
      <PageHeader
        title="Your Buyers"
        subtitle="Select a buyer to manage their hot sheets, favorites, and activity."
        backTo="/success-hub"
      />

      {mockBuyers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No buyers yet.</p>
      ) : (
        <div className="space-y-3">
          {mockBuyers.map((b) => (
            <Card
              key={b.buyerId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/success-hub/buyers/${b.buyerId}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-sm text-muted-foreground">{b.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {b.hotSheets} hot sheet{b.hotSheets !== 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
