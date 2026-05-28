import {
  Activity,
  CalendarClock,
  Home,
  Megaphone,
  Radio,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { cn } from "@/lib/utils";
import { NetworkActivityCard } from "./NetworkActivityCard";
import {
  MOCK_BUYER_DEMAND,
  MOCK_LISTING_ACTIVITY,
  MOCK_NETWORK_BROADCASTS,
  MOCK_SHOWING_PULSE,
  MOCK_VERIFIED_AGENTS,
  type ListingActivityItem,
  type NetworkBroadcastItem,
} from "./mockData";

function FeedTimestamp({ children }: { children: string }) {
  return <span className="shrink-0 text-[11px] font-medium text-neutral-400">{children}</span>;
}

function statusPillClass(label: ListingActivityItem["statusLabel"]) {
  if (label === "Pre-market") {
    return "border-amber-200/90 bg-amber-50 text-amber-900";
  }
  if (label === "Shared opportunity") {
    return "border-[#0E56F5]/20 bg-[#0E56F5]/5 text-[#0B46CC]";
  }
  return "border-emerald-200/90 bg-emerald-50 text-emerald-900";
}

function broadcastCategoryClass(category: NetworkBroadcastItem["category"]) {
  switch (category) {
    case "Referral":
      return "text-indigo-700 bg-indigo-50 border-indigo-200/80";
    case "Off-market":
      return "text-amber-900 bg-amber-50 border-amber-200/80";
    case "Market intel":
      return "text-neutral-800 bg-neutral-50 border-neutral-200";
    case "Rental request":
      return "text-[#0B46CC] bg-[#0E56F5]/5 border-[#0E56F5]/20";
    default:
      return "text-neutral-700 bg-neutral-50 border-neutral-200";
  }
}

function ActiveBuyerDemandCard() {
  return (
    <NetworkActivityCard
      title="Active Buyer Demand"
      description="Live needs across the private network"
      icon={<TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
      action={
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>
      }
    >
      <ul className="divide-y divide-neutral-100">
        {MOCK_BUYER_DEMAND.map((item) => (
          <li key={item.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <div
              className={cn(
                "mt-0.5 h-8 w-1 shrink-0 rounded-full",
                item.isNew ? "bg-emerald-500" : "bg-neutral-200",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold leading-snug text-neutral-900">
                  {item.buyerLabel}
                </p>
                <FeedTimestamp>{item.timestamp}</FeedTimestamp>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">{item.location}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                <span>{item.priceRange}</span>
                <span className="text-neutral-300">·</span>
                <span>{item.propertyType}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </NetworkActivityCard>
  );
}

function RecentListingActivityCard() {
  return (
    <NetworkActivityCard
      title="Recent Listing Activity"
      description="New and pre-market inventory on AAC"
      icon={<Home className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
    >
      <ul className="space-y-2.5">
        {MOCK_LISTING_ACTIVITY.map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-lg border border-neutral-100 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-neutral-200"
          >
            <div className="h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-neutral-100 bg-neutral-100">
              {item.photoUrl ? (
                <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="h-4 w-4 text-neutral-300" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-1.5 py-0 text-[10px] font-semibold",
                    statusPillClass(item.statusLabel),
                  )}
                >
                  {item.statusLabel}
                </span>
                <FeedTimestamp>{item.timestamp}</FeedTimestamp>
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-neutral-900">
                {item.address}
              </p>
              <p className="text-xs text-neutral-500">
                {item.neighborhood}, {item.city} · ${item.price.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {item.agentName} · {item.brokerage}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </NetworkActivityCard>
  );
}

function NetworkBroadcastsCard() {
  return (
    <NetworkActivityCard
      title="Network Broadcasts"
      description="Agent-to-agent intel and opportunities"
      icon={<Megaphone className="h-4 w-4 shrink-0 text-[#0E56F5]" aria-hidden />}
    >
      <ul className="divide-y divide-neutral-100">
        {MOCK_NETWORK_BROADCASTS.map((item) => (
          <li key={item.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-700"
              aria-hidden
            >
              {item.authorInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold text-neutral-900">{item.authorName}</span>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium",
                    broadcastCategoryClass(item.category),
                  )}
                >
                  {item.category}
                </span>
                <FeedTimestamp>{item.timestamp}</FeedTimestamp>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-600">
                {item.preview}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </NetworkActivityCard>
  );
}

function NewestVerifiedAgentsCard() {
  return (
    <NetworkActivityCard
      title="Newest Verified Agents"
      description="Recently active on the network"
      icon={<UserCheck className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
      className="lg:col-span-2"
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {MOCK_VERIFIED_AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="flex w-[9.5rem] shrink-0 snap-start flex-col items-center rounded-lg border border-neutral-100 bg-white px-3 py-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <AgentAvatar
              name={agent.name}
              headshotUrl={null}
              size="lg"
              avatarClassName="h-12 w-12 border border-neutral-200"
              fallbackClassName="bg-neutral-100 text-neutral-600 text-sm"
            />
            <p className="mt-2 w-full truncate text-[13px] font-semibold text-neutral-900">
              {agent.name}
            </p>
            <p className="mt-0.5 w-full truncate text-[11px] text-neutral-500">{agent.brokerage}</p>
            <p className="mt-1 w-full truncate text-[10px] font-medium text-neutral-400">
              {agent.market}
            </p>
          </div>
        ))}
      </div>
    </NetworkActivityCard>
  );
}

function ShowingMarketActivityCard() {
  return (
    <NetworkActivityCard
      title="Showing / Market Activity"
      description="Schedule pulse and network movement"
      icon={<CalendarClock className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />}
    >
      <ul className="divide-y divide-neutral-100">
        {MOCK_SHOWING_PULSE.map((item) => (
          <li key={item.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-100 bg-neutral-50">
              {item.kind === "showing" ? (
                <CalendarClock className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              ) : item.kind === "open_house" ? (
                <Home className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Activity className="h-3.5 w-3.5 text-[#0E56F5]" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-neutral-900">{item.label}</p>
                <FeedTimestamp>{item.timestamp}</FeedTimestamp>
              </div>
              <p className="mt-0.5 text-xs leading-snug text-neutral-600">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </NetworkActivityCard>
  );
}

export function NetworkActivitySection() {
  return (
    <section aria-labelledby="network-activity-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h2
              id="network-activity-heading"
              className="text-base font-semibold tracking-tight text-neutral-900 sm:text-lg"
            >
              Network Activity
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-snug text-neutral-500 sm:text-[13px]">
            Live private-market intelligence across buyer demand, listings, broadcasts, and agent
            movement on AAC.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Radio className="h-3 w-3 text-emerald-600" aria-hidden />
          Network feed
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <ActiveBuyerDemandCard />
        <RecentListingActivityCard />
        <NetworkBroadcastsCard />
        <ShowingMarketActivityCard />
        <NewestVerifiedAgentsCard />
      </div>
    </section>
  );
}
