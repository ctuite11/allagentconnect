import { useNavigate } from "react-router-dom";
import { Flame, Home, MessageSquare, Users } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";
import { successHubHotSheetsIconClass } from "@/lib/navIconColors";

const shell =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-neutral-300 hover:shadow-md";

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
    iconClass: string;
    onClick: () => void;
  }> = [
    {
      key: "buyers",
      label: "Buyers",
      value: String(m.activeBuyerCount),
      subtle: "Active relationships",
      icon: Users,
      iconClass: "text-indigo-600",
      onClick: () => navigate("/agent/buyers"),
    },
    {
      key: "listings",
      label: "Listings",
      value: String(listingPreviewCount),
      subtle: "Recent on dashboard",
      icon: Home,
      iconClass: "text-emerald-600",
      onClick: () => navigate("/agent/listings"),
    },
    {
      key: "hotsheets",
      label: "Hot Sheets",
      value: String(m.activeHotSheetCount),
      subtle: "Active sheets",
      icon: Flame,
      iconClass: successHubHotSheetsIconClass,
      onClick: () => navigate("/agent/hot-sheets"),
    },
    {
      key: "unread",
      label: "Unread",
      value: String(m.unreadMessageCount),
      subtle: m.unreadMessageCount > 0 ? "Needs review" : "Inbox clear",
      icon: MessageSquare,
      iconClass: "text-[#0E56F5]",
      onClick: () => navigate("/messages"),
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ key, label, value, subtle, icon: Icon, iconClass, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className={`${shell} text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2`}
        >
          <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden />
          <div className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">{value}</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-500">{label}</div>
          <div className="mt-1 text-xs text-neutral-400">{subtle}</div>
        </button>
      ))}
    </section>
  );
}
