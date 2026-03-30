import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardBuyersTableProps {
  buyers: SuccessHubSummary["buyers"];
}

export function DashboardBuyersTable({ buyers }: DashboardBuyersTableProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Buyers</h3>
        <button
          onClick={() => navigate("/success-hub/buyers")}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <Card className="border border-border bg-card">
        <CardContent className="p-0">
          {buyers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No buyers yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-2.5">Hot Sheets</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden sm:table-cell">Email</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {buyers.slice(0, 6).map((b) => {
                  const name = (b as any).name || [b.first_name, b.last_name].filter(Boolean).join(" ").trim() || b.email;
                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground truncate max-w-[140px]">{name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-emerald-600 text-sm font-medium">
                          {b.status === "active" ? "Active" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">{b.hotSheetCount}</td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[160px] hidden sm:table-cell">{b.email}</td>
                      <td className="px-2 py-2.5">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
