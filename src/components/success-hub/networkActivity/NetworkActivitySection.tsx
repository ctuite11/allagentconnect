import { useEffect, useState } from "react";
import { Home, MessageSquare, Radio, TrendingUp, UserCheck, Users } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { ROUTES } from "@/constants/routes";
import { NetworkActivityCard } from "./NetworkActivityCard";
import { ChannelPreviewCard } from "./ChannelPreviewCard";
import { useNewestVerifiedAgents } from "./useNewestVerifiedAgents";
import { SendMessageDialog } from "@/components/SendMessageDialog";
import {
  useBuyerNeedsPreview,
  useGeneralDiscussionsPreview,
  useRenterNeedsPreview,
  useSalesIntelPreview,
} from "./useChannelPreviews";

const channelLink = (channel: string) => `${ROUTES.COMMUNICATIONS}/feed?channel=${channel}`;

type ComposeCategory = "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";

function BuyerNeedsChannel({ onCreate }: { onCreate: () => void }) {
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
      onCreate={onCreate}
    />
  );
}

function SalesIntelChannel({ onCreate }: { onCreate: () => void }) {
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
      onCreate={onCreate}
    />
  );
}

function RenterNeedsChannel({ onCreate }: { onCreate: () => void }) {
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
      onCreate={onCreate}
    />
  );
}

function GeneralDiscussionsChannel({ onCreate }: { onCreate: () => void }) {
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
      onCreate={onCreate}
    />
  );
}

export function NewestVerifiedAgentsRow() {
  const { agents, loading } = useNewestVerifiedAgents(12);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <NetworkActivityCard
      title="Newest Verified Agents"
      description="Recently active on the network"
      icon={<UserCheck className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
      action={
        <Link
          to="/our-members"
          className="rounded-sm text-[12px] font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
        >
          View Network →
        </Link>
      }
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="flex w-[9.5rem] shrink-0 snap-start flex-col items-center rounded-lg border border-neutral-100 bg-white px-3 py-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-100" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-neutral-100" />
                <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-neutral-100" />
                <div className="mt-1.5 h-2 w-14 animate-pulse rounded bg-neutral-100" />
              </div>
            ))
          : agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => navigate(`/agent/${agent.id}`, { state: { from: location.pathname + location.search } })}
                className="flex w-[9.5rem] shrink-0 snap-start flex-col items-center rounded-lg border border-neutral-100 bg-white px-3 py-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-neutral-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
              >
                <AgentAvatar
                  name={agent.name}
                  headshotUrl={agent.headshotUrl}
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
              </button>
            ))}
      </div>
    </NetworkActivityCard>
  );
}

export function NetworkActivitySection() {
  const [compose, setCompose] = useState<{ open: boolean; category: ComposeCategory; title: string }>({
    open: false,
    category: "buyer_need",
    title: "Buyer Needs",
  });
  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    setHintDismissed(localStorage.getItem("aac:commsPrefsHintDismissed") === "1");
  }, []);
  const dismissHint = () => {
    localStorage.setItem("aac:commsPrefsHintDismissed", "1");
    setHintDismissed(true);
  };

  const launchCompose = (category: ComposeCategory, title: string) =>
    setCompose({ open: true, category, title });

  const openCompose = launchCompose;

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BuyerNeedsChannel onCreate={() => openCompose("buyer_need", "Buyer Needs")} />
        <SalesIntelChannel onCreate={() => openCompose("sales_intel", "Sales Intel")} />
        <RenterNeedsChannel onCreate={() => openCompose("renter_need", "Renter Needs")} />
        <GeneralDiscussionsChannel onCreate={() => openCompose("general_discussion", "General Discussions")} />
      </div>

      {!hintDismissed ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600">
          <span>
            You can customize your audience and notification preferences anytime in Communications Center.
          </span>
          <button
            type="button"
            onClick={dismissHint}
            className="shrink-0 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <SendMessageDialog
        open={compose.open}
        onOpenChange={(open) => setCompose((c) => ({ ...c, open }))}
        category={compose.category}
        categoryTitle={compose.title}
      />
    </section>
  );
}
