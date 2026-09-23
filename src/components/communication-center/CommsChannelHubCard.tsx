import { Link } from "react-router-dom";
import { Paperclip, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CommsChannelMeta } from "@/lib/commsChannels";
import { commsChannelPath, previewMessageLines } from "@/lib/commsChannels";
import type { LatestReceivedPreview } from "@/lib/commsChannelPreview";

const footerBase =
  "inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/30 focus-visible:ring-offset-1 sm:px-2 sm:text-sm";

const footerNeutralHover =
  "hover:bg-neutral-100/80 hover:text-neutral-900 focus-visible:bg-neutral-100/80 focus-visible:text-neutral-900";

const footerSendHover =
  "hover:bg-[#0E56F5]/[0.08] hover:text-[#0B47D4] focus-visible:bg-[#0E56F5]/[0.08] focus-visible:text-[#0B47D4]";

type CommsChannelHubCardProps = {
  channel: CommsChannelMeta;
  preview: LatestReceivedPreview | null;
  loading: boolean;
  channelOn: boolean;
  onToggleChannel: () => void;
  onSend: () => void;
};

/** Channel-card-only toggle: ON/OFF lives inside the track (not the shared Switch). */
function EmailAlertsToggle({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onCheckedChange}
      className={cn(
        "relative inline-flex h-7 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-2",
        checked ? "bg-[#0E56F5]" : "bg-neutral-200",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 flex items-center text-[10px] font-bold tracking-wide",
          checked ? "left-1.5 text-white" : "right-1.5 text-neutral-600",
        )}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 block h-6 w-6 rounded-full bg-white shadow-sm ring-0 transition-transform",
          checked ? "translate-x-[1.55rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

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
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-[18px] w-[18px] shrink-0", channel.iconClassName)} strokeWidth={2} aria-hidden />
            <h3 className="text-base font-semibold text-neutral-900">{channel.title}</h3>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-500">{channel.tagline}</p>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs font-medium text-neutral-500">Email alerts</span>
          <EmailAlertsToggle
            checked={channelOn}
            onCheckedChange={onToggleChannel}
            ariaLabel={`${channel.title} email alerts ${channelOn ? "on" : "off"}`}
          />
        </div>
      </header>

      <Link
        to={receivedTo}
        className="group flex cursor-pointer flex-col px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0E56F5]/30"
      >
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-4/5 rounded bg-neutral-100" />
            <Skeleton className="h-3 w-full rounded bg-neutral-100" />
            <Skeleton className="h-2.5 w-1/3 rounded bg-neutral-100" />
          </div>
        ) : preview ? (
          <>
            <p className="line-clamp-1 text-sm font-semibold text-neutral-900">{preview.subject}</p>
            {preview.message ? (
              <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-[13px] leading-snug text-neutral-600">
                {previewMessageLines(preview.message, 1)}
              </p>
            ) : null}
            <p className="mt-1.5 text-xs italic text-neutral-500">
              <span className="not-italic font-medium text-neutral-600">{preview.agentName}</span>
              <span aria-hidden> · </span>
              <span>{preview.timestamp}</span>
              {preview.hasAttachment ? (
                <>
                  <span aria-hidden> · </span>
                  <span className="inline-flex items-center gap-0.5 not-italic">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    Attachment
                  </span>
                </>
              ) : null}
            </p>
          </>
        ) : (
          <p className="text-[13px] leading-snug text-neutral-500">
            No messages from other agents yet.
          </p>
        )}
      </Link>

      <footer className="grid grid-cols-3 gap-0.5 border-t border-neutral-100 bg-neutral-50/50 p-1.5">
        <Link
          to={receivedTo}
          className={cn(footerBase, footerNeutralHover, "font-semibold text-neutral-800")}
        >
          Recent Activity
        </Link>
        <Link
          to={sentTo}
          className={cn(footerBase, footerNeutralHover, "font-medium text-neutral-500")}
        >
          Sent
        </Link>
        <button
          type="button"
          onClick={onSend}
          className={cn(footerBase, footerSendHover, "gap-0.5 font-semibold text-[#0E56F5]")}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Send
        </button>
      </footer>
    </article>
  );
}
