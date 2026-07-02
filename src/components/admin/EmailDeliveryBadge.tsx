import { Mail } from "lucide-react";

export type EmailDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed";

export interface EmailStatusInfo {
  status: EmailDeliveryStatus;
  created_at: string;
  event_at: string | null;
  attempts?: number | null;
  last_error?: string | null;
}

const STATUS_STYLES: Record<EmailDeliveryStatus, string> = {
  queued: "bg-zinc-50 text-zinc-600 ring-zinc-200",
  sent: "bg-sky-50 text-sky-700 ring-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  bounced: "bg-rose-50 text-rose-700 ring-rose-200",
  complained: "bg-amber-50 text-amber-800 ring-amber-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_LABEL: Record<EmailDeliveryStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Complained",
  failed: "Failed",
};

const STATUS_MEANING: Record<EmailDeliveryStatus, string> = {
  queued: "Email is in the send queue but has not been handed to the provider yet.",
  sent: "Provider accepted the email. Delivery to the recipient's mail server is not yet confirmed.",
  delivered:
    "Recipient's mail server accepted the email. Does NOT confirm inbox placement or that the agent opened it.",
  bounced: "Recipient's mail server rejected the email (bad address, mailbox full, or blocked).",
  complained: "Recipient marked the message as spam in their client.",
  failed: "All send attempts failed and the job was moved to the dead-letter queue.",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  label: string;
  info?: EmailStatusInfo | null;
}

export function EmailDeliveryBadge({ label, info }: Props) {
  if (!info) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-100"
        title={`No ${label} email has been sent to this agent yet.`}
      >
        <Mail className="h-3 w-3" />
        {label}: —
      </span>
    );
  }

  const ts = info.event_at ?? info.created_at;
  const tooltip = [
    `${label}: ${STATUS_LABEL[info.status]}`,
    STATUS_MEANING[info.status],
    ts ? `Last event: ${new Date(ts).toLocaleString()}` : null,
    info.attempts != null ? `Attempts: ${info.attempts}` : null,
    info.last_error ? `Last error: ${info.last_error}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLES[info.status]}`}
      title={tooltip}
    >
      <Mail className="h-3 w-3" />
      {label}: {STATUS_LABEL[info.status]}
      <span className="text-[10px] font-normal opacity-70">· {formatRelative(ts)}</span>
    </span>
  );
}

export function EmailDeliveryLegend() {
  const items: EmailDeliveryStatus[] = [
    "queued",
    "sent",
    "delivered",
    "bounced",
    "complained",
    "failed",
  ];
  return (
    <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-[11px] text-zinc-600">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-zinc-700">Email status:</span>
        {items.map((s) => (
          <span
            key={s}
            className={`inline-flex items-center rounded-full px-2 py-0.5 ring-1 ${STATUS_STYLES[s]}`}
            title={STATUS_MEANING[s]}
          >
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-zinc-500">
        <strong>Delivered</strong> means the recipient's mail server accepted the email. It does
        not confirm inbox placement or that the agent opened it.
      </p>
    </div>
  );
}