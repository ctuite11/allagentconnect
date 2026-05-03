import { useNavigate } from "react-router-dom";
import { Home, Layers, MessageSquare, Users } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

const shell =
  "rounded-2xl border border-zinc-100 bg-white p-4 shadow-none transition-colors duration-150 hover:border-zinc-200";

type SuccessHubStatRowProps = {
  summary: SuccessHubSummary;
};

export function SuccessHubStatRow({ summary }: SuccessHubStatRowProps) {
  const navigate = useNavigate();
  const m = summary.metrics ?? {
    pendingInviteCount: 0,
    activeHotSheetCount: 0,
    activeBuyerCount: 0,
    unreadMessageCount: 0,
  };
  const listingRows = summary.listings ?? [];
  const listingPreviewCount = listingRows.length;

  const stats: Array<{
    key: string;
    label: string;
    value: string;
    subtle: string;
    icon: typeof Users;
    onClick: () => void;
  }> = [
    {
      key: "buyers",
      label: "Buyers",
      value: String(m.activeBuyerCount),
      subtle: "Active relationships",
      icon: Users,
      onClick: () => navigate("/success-hub/buyers"),
    },
    {
      key: "listings",
      label: "Listings",
      value: String(listingPreviewCount),
      subtle: "Recent on dashboard",
      icon: Home,
      onClick: () => navigate("/agent/listings"),
    },
    {
      key: "hotsheets",
      label: "Hot Sheets",
      value: String(m.activeHotSheetCount),
      subtle: "Active sheets",
      icon: Layers,
      onClick: () => navigate("/agent/hot-sheets"),
    },
    {
      key: "unread",
      label: "Unread",
      value: String(m.unreadMessageCount),
      subtle: m.unreadMessageCount > 0 ? "Needs review" : "Inbox clear",
      icon: MessageSquare,
      onClick: () => navigate("/messages"),
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ key, label, value, subtle, icon: Icon, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className={`${shell} text-left outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/30 focus-visible:ring-offset-2`}
        >
          <Icon className="h-4 w-4 text-[hsl(160_84%_39%)]" aria-hidden />
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-500">{label}</div>
          <div className="mt-1 text-xs text-neutral-400">{subtle}</div>
        </button>
      ))}
    </section>
  );
}
