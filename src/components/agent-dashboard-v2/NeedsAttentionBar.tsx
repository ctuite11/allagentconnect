import { AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface NeedsAttentionBarProps {
  items: SuccessHubSummary["attentionItems"];
}

export function NeedsAttentionBar({ items }: NeedsAttentionBarProps) {
  const navigate = useNavigate();

  if (!items.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">Needs Attention</h3>
      <div className="flex flex-wrap items-center gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-sm text-destructive hover:bg-destructive/15 transition-colors"
          >
            <span className="font-medium">{item.label}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
