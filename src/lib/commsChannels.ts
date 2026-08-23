import type { LucideIcon } from "lucide-react";
import { Home, MessageSquare, TrendingUp, Users } from "lucide-react";
import type { CommsChannelKey } from "@/lib/commsChannelPrefs";

export type CommsChannelView = "received" | "sent";

export type CommsChannelMeta = {
  key: CommsChannelKey;
  title: string;
  tagline: string;
  searchPlaceholder: string;
  sendLabel: string;
  icon: LucideIcon;
  iconClassName: string;
};

export const COMMS_CHANNELS: CommsChannelMeta[] = [
  {
    key: "buyer_need",
    title: "Buyer Needs",
    tagline: "Connect buyer demand with opportunities across the AAC network.",
    searchPlaceholder: "Search Buyer Needs…",
    sendLabel: "Send Buyer Need",
    icon: Users,
    iconClassName: "text-emerald-600",
  },
  {
    key: "renter_need",
    title: "Renter Needs",
    tagline: "Share rental demand and find tenants across the AAC network.",
    searchPlaceholder: "Search Renter Needs…",
    sendLabel: "Send Renter Need",
    icon: Home,
    iconClassName: "text-amber-600",
  },
  {
    key: "sales_intel",
    title: "Sales Intel",
    tagline: "Market activity, listings, and insights from agents on AAC.",
    searchPlaceholder: "Search Sales Intel…",
    sendLabel: "Send Sales Intel",
    icon: TrendingUp,
    iconClassName: "text-[#0E56F5]",
  },
  {
    key: "general_discussion",
    title: "General Discussion",
    tagline: "Referrals, questions, and conversation with the agent network.",
    searchPlaceholder: "Search General Discussion…",
    sendLabel: "Send Discussion",
    icon: MessageSquare,
    iconClassName: "text-indigo-600",
  },
];

export const COMMS_CHANNEL_BY_KEY: Record<CommsChannelKey, CommsChannelMeta> = Object.fromEntries(
  COMMS_CHANNELS.map((c) => [c.key, c]),
) as Record<CommsChannelKey, CommsChannelMeta>;

export function isCommsChannelKey(value: string | null | undefined): value is CommsChannelKey {
  return !!value && value in COMMS_CHANNEL_BY_KEY;
}

export function commsChannelPath(channel: CommsChannelKey, view: CommsChannelView = "received"): string {
  const base = `/communications/channel/${channel}`;
  return view === "sent" ? `${base}?view=sent` : base;
}

export function commsRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function previewMessageLines(message: string, maxLines = 2, maxCharsPerLine = 90): string {
  const lines = (message || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const joined =
    lines.length > 0
      ? lines.slice(0, maxLines).join("\n")
      : (message || "").trim().slice(0, maxCharsPerLine * maxLines);
  if (joined.length <= maxCharsPerLine * maxLines) return joined;
  return `${joined.slice(0, maxCharsPerLine * maxLines - 1).trimEnd()}…`;
}
