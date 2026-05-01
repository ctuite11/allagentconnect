import { useNavigate } from "react-router-dom";
import { Mail, Users, TrendingUp, Home } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface NeedsAttentionPillsProps {
  items: SuccessHubSummary["attentionItems"];
}

const iconMap: Record<string, React.ElementType> = {
  invite: Users,
  message: Mail,
  hotsheet: TrendingUp,
  listing: Home,
};

export function NeedsAttentionPills({ items }: NeedsAttentionPillsProps) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {items.map((item) => {
        const Icon = iconMap[item.type] ?? TrendingUp;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-100 bg-white px-3 py-1.5 text-xs font-medium text-[#0E56F5] transition-colors hover:border-zinc-200"
          >
            <Icon className="h-3 w-3" />
            {item.sub}
          </button>
        );
      })}
    </div>
  );
}
