import { Link } from "react-router-dom";
import { Paperclip, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CommsChannelMeta } from "@/lib/commsChannels";
import { commsChannelPath, previewMessageLines } from "@/lib/commsChannels";
import type { LatestReceivedPreview } from "@/lib/commsChannelPreview";

const footerAction =
  "inline-flex h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/30 focus-visible:ring-offset-2 sm:px-2 sm:text-sm";

type CommsChannelHubCardProps = {
  channel: CommsChannelMeta;
  preview: LatestReceivedPreview | null;
  loading: boolean;
  channelOn: boolean;
  onToggleChannel: () => void;
  onSend: () => void;
};

export function CommsChannelHubCard({
  channel,
  preview,
  loading,
  channelOn,
  onToggleChannel,
  onSend,
}: CommsChannelHubCardProps) {
  const Icon = channel.icon;
  const receivedTo = commsChannelPath(channel.key, "received");
  const sentTo = commsChannelPath(channel.key, "sent");

  return (
    <article className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Icon className={cn("h-5 w-5 shrink-0", channel.iconClassName)} strokeWidth={2} aria-hidden />
            <h3 className="text-[17px] font-semibold text-neutral-900">{channel.title}</h3>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-neutral-500">{channel.tagline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs font-medium text-neutral-500">{channelOn ? "On" : "Off"}</span>
          <Switch
            checked={channelOn}
            onCheckedChange={onToggleChannel}
            aria-label={`${channel.title} email alerts`}
            className="data-[state=checked]:!bg-[#0E56F5] data-[state=unchecked]:!bg-neutral-200"
          />
        </div>
      </header>

      <Link
        to={receivedTo}
        className="group flex flex-1 flex-col px-5 py-4 text-left transition-colors hover:bg-neutral-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0E56F5]/30"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Latest received</p>

        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded bg-neutral-100" />
            <Skeleton className="h-3 w-full rounded bg-neutral-100" />
            <Skeleton className="h-3 w-5/6 rounded bg-neutral-100" />
            <Skeleton className="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
          </div>
        ) : preview ? (
          <div className="mt-2 min-h-[120px]">
            <p className="line-clamp-1 text-[15px] font-semibold text-neutral-900">{preview.subject}</p>
            {preview.message ? (
              <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                {previewMessageLines(preview.message)}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{preview.agentName}</span>
              <span aria-hidden>·</span>
              <span>{preview.timestamp}</span>
              {preview.hasAttachment ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    Attachment
                  </span>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex min-h-[120px] flex-col justify-center">
            <p className="text-sm font-medium text-neutral-600">Nothing here yet</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              When another agent posts in this channel, you&apos;ll see the latest message here.
            </p>
          </div>
        )}
      </Link>

      <footer className="grid grid-cols-3 gap-0.5 border-t border-neutral-100 bg-neutral-50/60 p-1.5 sm:gap-1 sm:p-2">
        <Link
          to={receivedTo}
          className={cn(footerAction, "text-neutral-800 hover:bg-white hover:text-neutral-900")}
        >
          Received
        </Link>
        <Link
          to={sentTo}
          className={cn(footerAction, "text-neutral-800 hover:bg-white hover:text-neutral-900")}
        >
          Sent
        </Link>
        <button
          type="button"
          onClick={onSend}
          className={cn(
            footerAction,
            "gap-1 text-[#0E56F5] hover:bg-white hover:text-[#0E56F5]",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Send
        </button>
      </footer>
    </article>
  );
}
