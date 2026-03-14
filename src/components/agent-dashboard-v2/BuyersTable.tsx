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
    <div className="rounded-xl border border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Buyers</h3>
        <button
          onClick={() => navigate("/my-clients")}
          className="text-sm font-medium text-primary hover:underline"
        >
          View all →
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_80px_1fr_32px] gap-2 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
        <span>Name</span>
        <span>Status</span>
        <span className="text-center">Hotsheet count</span>
        <span>Email</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {buyers.map((buyer) => {
          const name = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || "—";
          return (
            <button
              key={buyer.id}
              onClick={() => navigate("/my-clients")}
              className="w-full grid grid-cols-[1fr_80px_80px_1fr_32px] gap-2 items-center px-5 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-foreground truncate">{name}</span>
              <span>
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
              </span>
              <span className="text-center text-muted-foreground">{buyer.hotSheetCount}</span>
              <span className="text-muted-foreground truncate">{buyer.email || "—"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}

        {buyers.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No buyers yet.
          </div>
        )}
      </div>
    </div>
  );
}
