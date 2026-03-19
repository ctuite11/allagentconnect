import { AlertTriangle, Mail, Users, FileText, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface NeedsAttentionBarProps {
  items: SuccessHubSummary["attentionItems"];
}

const iconMap: Record<string, React.ReactNode> = {
  invite: <Users className="h-5 w-5 text-amber-600" />,
  message: <Mail className="h-5 w-5 text-primary" />,
  hotsheet: <FileText className="h-5 w-5 text-emerald-600" />,
  listing: <FileText className="h-5 w-5 text-primary" />,
};

export function NeedsAttentionBar({ items }: NeedsAttentionBarProps) {
  const navigate = useNavigate();

  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-base font-semibold text-foreground">Needs Your Attention</h3>
        </div>
        <button
          onClick={() => navigate("/agent-dashboard")}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          View All Activity <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-4 rounded-xl bg-card border border-border px-4 py-3.5 text-left hover:border-muted-foreground/30 transition-colors group"
          >
            <div className="shrink-0">
              {iconMap[item.type] ?? <AlertTriangle className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
