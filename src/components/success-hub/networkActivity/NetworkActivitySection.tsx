import { Home, MessageSquare, Radio, TrendingUp, UserCheck, Users } from "lucide-react";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { ROUTES } from "@/constants/routes";
import { NetworkActivityCard } from "./NetworkActivityCard";
import { ChannelPreviewCard } from "./ChannelPreviewCard";
import { MOCK_VERIFIED_AGENTS } from "./mockData";
import {
  useBuyerNeedsPreview,
  useGeneralDiscussionsPreview,
  useRenterNeedsPreview,
  useSalesIntelPreview,
} from "./useChannelPreviews";

const channelLink = (channel: string) => `${ROUTES.COMMUNICATIONS}?channel=${channel}`;

function BuyerNeedsChannel() {
  const { items, loading } = useBuyerNeedsPreview(3);
  return (
    <ChannelPreviewCard
      title="Buyer Needs"
      description="Latest buyer demand on AAC"
      icon={<Users className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
      viewAllTo={channelLink("buyer_need")}
      items={items}
      loading={loading}
      emptyLabel="No recent buyer needs"
    />
  );
}

function SalesIntelChannel() {
  const { items, loading } = useSalesIntelPreview(3);
  return (
    <ChannelPreviewCard
      title="Sales Intel"
      description="Newest for-sale listings"
      icon={<TrendingUp className="h-4 w-4 shrink-0 text-[#0E56F5]" aria-hidden />}
      viewAllTo={channelLink("sales_intel")}
      items={items}
      loading={loading}
      emptyLabel="No recent listings"
    />
  );
}

function RenterNeedsChannel() {
  const { items, loading } = useRenterNeedsPreview(3);
  return (
    <ChannelPreviewCard
      title="Renter Needs"
      description="Latest rental demand"
      icon={<Home className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />}
      viewAllTo={channelLink("renter_need")}
      items={items}
      loading={loading}
      emptyLabel="No recent renter needs"
    />
  );
}

function GeneralDiscussionsChannel() {
  const { items, loading } = useGeneralDiscussionsPreview(3);
  return (
    <ChannelPreviewCard
      title="General Discussions"
      description="Referrals & agent conversation"
      icon={<MessageSquare className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
      viewAllTo={channelLink("general_discussion")}
      items={items}
      loading={loading}
      emptyLabel="No recent discussions"
    />
  );
}

export function NewestVerifiedAgentsRow() {
  return (
    <NetworkActivityCard
      title="Newest Verified Agents"
      description="Recently active on the network"
      icon={<UserCheck className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
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
            Live previews of the four Communications Center channels — open one to see all activity.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Radio className="h-3 w-3 text-emerald-600" aria-hidden />
          Network feed
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <BuyerNeedsChannel />
        <SalesIntelChannel />
        <RenterNeedsChannel />
        <GeneralDiscussionsChannel />
      </div>
    </section>
  );
}
