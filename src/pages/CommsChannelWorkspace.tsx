import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Paperclip, Phone, Plus, Search } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { SendMessageDialog } from "@/components/SendMessageDialog";
import { AgentEmailQuickDialog } from "@/components/agent-search/AgentEmailQuickDialog";
import { EditSentCommunicationDialog } from "@/components/communication-center/EditSentCommunicationDialog";
import {
  COMMS_CHANNEL_BY_KEY,
  commsRelativeTime,
  isCommsChannelKey,
  type CommsChannelView,
} from "@/lib/commsChannels";
import {
  fetchBroadcastAttachments,
  fetchChannelReceivedBroadcasts,
  fetchChannelSentBroadcasts,
  type ChannelBroadcastItem,
  type ChannelFeedAttachment,
} from "@/lib/commsChannelLists";
import { formatSentDateTime, previewSentMessage } from "@/lib/commsSentFormat";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SentBroadcastListItem } from "@/lib/commsSent";

function toSentListItem(row: ChannelBroadcastItem): SentBroadcastListItem {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    message: row.message,
    recipient_count: row.recipient_count ?? 0,
    created_at: row.created_at,
    edit_count: row.edit_count ?? 0,
    edited_at: row.edited_at ?? null,
    attachment_count: row.attachment_count,
  };
}

export default function CommsChannelWorkspace() {
  const { category: categoryParam } = useParams<{ category: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const category = isCommsChannelKey(categoryParam) ? categoryParam : null;
  const view: CommsChannelView = params.get("view") === "sent" ? "sent" : "received";
  const composeRequested = params.get("compose") === "1";

  const channel = category ? COMMS_CHANNEL_BY_KEY[category] : null;

  const [rows, setRows] = useState<ChannelBroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receivedQuery, setReceivedQuery] = useState("");
  const [sentQuery, setSentQuery] = useState("");
  const query = view === "sent" ? sentQuery : receivedQuery;
  const setQuery = view === "sent" ? setSentQuery : setReceivedQuery;
  const [attachmentsByBroadcast, setAttachmentsByBroadcast] = useState<
    Record<string, ChannelFeedAttachment[]>
  >({});
  const [lightbox, setLightbox] = useState<ChannelFeedAttachment | null>(null);
  const [emailTarget, setEmailTarget] = useState<{ name: string; email: string } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editItem, setEditItem] = useState<SentBroadcastListItem | null>(null);

  const returnState = { from: `${location.pathname}${location.search}` };

  const reload = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    const result =
      view === "sent"
        ? await fetchChannelSentBroadcasts(category)
        : await fetchChannelReceivedBroadcasts(category);
    setError(result.error);
    setRows(result.rows);
    setLoading(false);

    if (result.rows.length) {
      const grouped = await fetchBroadcastAttachments(result.rows.map((r) => r.id));
      setAttachmentsByBroadcast(grouped);
    } else {
      setAttachmentsByBroadcast({});
    }
  }, [category, view]);

  useEffect(() => {
    if (!category) {
      navigate("/communications", { replace: true });
      return;
    }
    void reload();
  }, [category, view, reload, navigate]);

  useEffect(() => {
    if (composeRequested) setComposeOpen(true);
  }, [composeRequested]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const senderName = r.sender?.name?.toLowerCase() ?? "";
      const senderEmail = r.sender?.email?.toLowerCase() ?? "";
      return (
        senderName.includes(q) ||
        senderEmail.includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const setView = (next: CommsChannelView) => {
    const nextParams = new URLSearchParams(params);
    if (next === "sent") nextParams.set("view", "sent");
    else nextParams.delete("view");
    nextParams.delete("compose");
    setParams(nextParams, { replace: true });
  };

  const handleComposeOpenChange = (open: boolean) => {
    setComposeOpen(open);
    if (!open && composeRequested) {
      const nextParams = new URLSearchParams(params);
      nextParams.delete("compose");
      setParams(nextParams, { replace: true });
    }
  };

  if (!channel) return null;

  return (
    <PageShell className="pb-12">
      <Seo
        title={`${channel.title} | Communications Center`}
        description={channel.tagline}
        noindex
      />

      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-neutral-600">
          <Link to="/communications">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Communications Center
          </Link>
        </Button>
      </div>

      <PageHeader title={channel.title} subtitle={channel.tagline} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={channel.searchPlaceholder}
            className="h-10 rounded-full border-neutral-300 pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("received")}
              className={cn(
                "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                view === "received"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:text-neutral-900",
              )}
            >
              Received
            </button>
            <button
              type="button"
              onClick={() => setView("sent")}
              className={cn(
                "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                view === "sent"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:text-neutral-900",
              )}
            >
              Sent
            </button>
          </div>

          <Button type="button" onClick={() => setComposeOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" />
            {channel.sendLabel}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {loading ? (
          <AacMonogramLoader message={`Loading ${channel.title}…`} />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            {rows.length === 0
              ? view === "sent"
                ? `You haven't sent any ${channel.title.toLowerCase()} yet.`
                : `No ${channel.title.toLowerCase()} from other agents yet.`
              : "No matches for your search."}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {filtered.map((r) => (
              <li key={r.id} className="px-6 py-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-semibold text-neutral-900">
                    {r.subject || "(no subject)"}
                  </p>
                  <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                    {view === "sent" ? formatSentDateTime(r.created_at) : commsRelativeTime(r.created_at)}
                  </span>
                </div>

                {r.message ? (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-neutral-700">
                    {view === "sent" ? previewSentMessage(r.message) : r.message}
                  </p>
                ) : null}

                {(attachmentsByBroadcast[r.id]?.length ?? 0) > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {attachmentsByBroadcast[r.id].map((a) =>
                      a.kind === "image" ? (
                        <li key={a.path}>
                          <button
                            type="button"
                            onClick={() => setLightbox(a)}
                            className="block h-28 w-28 overflow-hidden rounded-lg border border-neutral-200"
                          >
                            <img
                              src={a.url}
                              alt={a.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        </li>
                      ) : (
                        <li key={a.path} className="w-64">
                          <video
                            src={a.url}
                            controls
                            preload="metadata"
                            className="w-full rounded-lg border border-neutral-200"
                          />
                        </li>
                      ),
                    )}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
                  {view === "sent" ? (
                    <>
                      <span>
                        Sent to {r.recipient_count ?? 0}{" "}
                        {(r.recipient_count ?? 0) === 1 ? "agent" : "agents"}
                      </span>
                      {r.attachment_count > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {r.attachment_count}
                        </span>
                      ) : null}
                      {r.edit_count && r.edit_count > 0 && r.edited_at ? (
                        <span>Edited · {formatSentDateTime(r.edited_at)}</span>
                      ) : null}
                      <div className="ml-auto flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditItem(toSentListItem(r))}
                        >
                          Edit
                        </Button>
                      </div>
                    </>
                  ) : r.sender ? (
                    <>
                      <Link
                        to={`/agent/${r.sender.id}`}
                        state={returnState}
                        className="font-medium text-[#0E56F5] hover:underline"
                      >
                        {r.sender.name}
                      </Link>
                      {r.sender.company ? (
                        <span className="text-neutral-500">{r.sender.company}</span>
                      ) : null}
                      {r.sender.phone ? (
                        <span className="inline-flex items-center gap-1 text-neutral-600">
                          <Phone className="h-3 w-3" aria-hidden />
                          {formatPhoneNumber(r.sender.phone)}
                        </span>
                      ) : null}
                      {r.sender.email ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEmailTarget({ name: r.sender!.name, email: r.sender!.email! })
                          }
                          className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900 hover:underline"
                        >
                          <Mail className="h-3 w-3" aria-hidden />
                          {r.sender.email}
                        </button>
                      ) : null}
                      {r.attachment_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-neutral-500">
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {r.attachment_count}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SendMessageDialog
        open={composeOpen}
        onOpenChange={handleComposeOpenChange}
        category={channel.key}
        categoryTitle={channel.title}
        defaultSubject={channel.title}
      />

      <EditSentCommunicationDialog
        open={!!editItem}
        broadcast={editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        onSaved={() => void reload()}
      />

      <AgentEmailQuickDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        agentName={emailTarget?.name ?? ""}
        agentEmail={emailTarget?.email ?? ""}
      />

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl bg-white p-2">
          {lightbox ? (
            <img src={lightbox.url} alt={lightbox.name} className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
