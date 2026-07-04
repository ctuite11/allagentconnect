import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmailJob {
  id: string;
  created_at: string;
  status: string;
  delivery_status: string | null;
  delivery_status_at: string | null;
  provider_message_id: string | null;
  idempotency_key: string | null;
  last_error: string | null;
  template: string | null;
  subject: string | null;
  from: string;
  reply_to: string | null;
  to: string | null;
  opens: Array<{ opened_at: string }>;
  clicks: Array<{ clicked_at: string; url: string }>;
  events: Array<{ event: string; at: string }>;
  bounce_reason: string | null;
}

function fmt(ts: string | null | undefined) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function statusPill(job: EmailJob) {
  const ds = (job.delivery_status ?? "").toLowerCase();
  const st = (job.status ?? "").toLowerCase();
  let label = "Queued";
  let cls = "bg-zinc-100 text-zinc-700";
  if (ds === "delivered") {
    label = "Delivered";
    cls = "bg-emerald-100 text-emerald-800";
  } else if (ds === "bounced") {
    label = "Bounced";
    cls = "bg-rose-100 text-rose-800";
  } else if (ds === "complained") {
    label = "Complained";
    cls = "bg-amber-100 text-amber-800";
  } else if (st === "failed") {
    label = "Failed";
    cls = "bg-rose-100 text-rose-800";
  } else if (st === "sent" || ds === "sent") {
    label = "Sent";
    cls = "bg-sky-100 text-sky-800";
  } else if (st === "processing") {
    label = "Processing";
    cls = "bg-zinc-100 text-zinc-700";
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function AgentEmailHistory({ email }: { email: string | null | undefined }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<EmailJob[]>([]);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("admin-list-agent-emails", { body: { email } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setJobs([]);
        } else {
          setJobs((data as any)?.jobs ?? []);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  if (!email) return null;

  if (loading) {
    return <div className="text-xs text-zinc-500">Loading…</div>;
  }
  if (error) {
    return <div className="text-xs text-rose-600">Failed to load: {error}</div>;
  }
  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-zinc-100 bg-white p-3 text-xs text-zinc-500">
        No License Verified emails sent.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const opened = job.opens.length > 0;
        const clicked = job.clicks.length > 0;
        return (
          <details
            key={job.id}
            className="rounded-md border border-zinc-100 bg-white text-xs"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-2.5">
              <span className="text-zinc-800">{fmt(job.created_at)}</span>
              {statusPill(job)}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  opened
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {opened ? `Opened (${job.opens.length})` : "Not opened"}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  clicked
                    ? "bg-sky-100 text-sky-800"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {clicked ? `Clicked (${job.clicks.length})` : "Not clicked"}
              </span>
            </summary>
            <div className="border-t border-zinc-100 p-3">
              <dl className="grid grid-cols-[130px,1fr] gap-y-1.5">
                <dt className="text-zinc-500">From</dt>
                <dd className="text-zinc-800">{job.from}</dd>
                <dt className="text-zinc-500">Reply-To</dt>
                <dd className="text-zinc-800">{job.reply_to ?? "—"}</dd>
                <dt className="text-zinc-500">To</dt>
                <dd className="text-zinc-800">{job.to ?? "—"}</dd>
                <dt className="text-zinc-500">Template</dt>
                <dd className="text-zinc-800">{job.template ?? "—"}</dd>
                <dt className="text-zinc-500">Subject</dt>
                <dd className="text-zinc-800">{job.subject ?? "—"}</dd>
                <dt className="text-zinc-500">Provider msg ID</dt>
                <dd className="font-mono text-[11px] text-zinc-800 break-all">
                  {job.provider_message_id ?? "—"}
                </dd>
                <dt className="text-zinc-500">Idempotency key</dt>
                <dd className="font-mono text-[11px] text-zinc-800 break-all">
                  {job.idempotency_key ?? "—"}
                </dd>
                <dt
                  className="text-zinc-500"
                  title="The setup/recovery link is minted in the same request that enqueues the email."
                >
                  Link generated at
                </dt>
                <dd className="text-zinc-800">{fmt(job.created_at)}</dd>
                <dt className="text-zinc-500">Delivered at</dt>
                <dd className="text-zinc-800">
                  {fmt(job.delivery_status_at) ?? "—"}
                </dd>
                {(job.last_error || job.bounce_reason) && (
                  <>
                    <dt className="text-rose-600">Error / bounce</dt>
                    <dd className="text-rose-700 break-words">
                      {job.last_error ?? job.bounce_reason}
                    </dd>
                  </>
                )}
              </dl>

              {job.events.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Delivery timeline
                  </div>
                  <ol className="space-y-0.5">
                    {job.events.map((e, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="text-zinc-700">{e.event}</span>
                        <span className="text-zinc-500">{fmt(e.at)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {job.opens.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Opens
                  </div>
                  <ul className="space-y-0.5 text-zinc-700">
                    {job.opens.map((o, i) => (
                      <li key={i}>{fmt(o.opened_at)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {job.clicks.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Clicks
                  </div>
                  <ul className="space-y-0.5 text-zinc-700">
                    {job.clicks.map((c, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>{fmt(c.clicked_at)}</span>
                        <span className="truncate text-zinc-500" title={c.url}>
                          {c.url}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}