import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface BuyersTableProps {
  buyers: SuccessHubSummary["buyers"];
}

export function BuyersTable({ buyers }: BuyersTableProps) {
  const navigate = useNavigate();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Your Buyers</h3>
        <button
          onClick={() => navigate("/my-clients")}
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          View all <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {buyers.map((buyer) => {
          const name = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || "—";
          return (
            <button
              key={buyer.id}
              onClick={() => navigate("/my-clients")}
              className="w-full flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-left hover:border-muted-foreground/30 transition-colors group"
            >
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {(buyer.first_name?.[0] ?? buyer.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {buyer.hotSheetCount} hot sheet{buyer.hotSheetCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Badge
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  buyer.status === "active"
                    ? "bg-green-500/15 text-green-700 border-green-500/20"
                    : "bg-yellow-500/15 text-yellow-700 border-yellow-500/20"
                }`}
                variant="outline"
              >
                {buyer.status === "active" ? "Active" : "Pending"}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </button>
          );
        })}

        {buyers.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-12 text-center text-muted-foreground text-sm">
            No buyers yet.
          </div>
        )}
      </div>
    </section>
  );
}
