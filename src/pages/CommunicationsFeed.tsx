import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Search, ArrowLeft, Home, MessageSquare, TrendingUp, Users, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { AgentEmailQuickDialog } from "@/components/agent-search/AgentEmailQuickDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";

type Category = "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
type Filter = "all" | Category;

const CATEGORY_META: Record<Category, { title: string; icon: JSX.Element }> = {
  buyer_need: { title: "Buyer Needs", icon: <Users className="h-3.5 w-3.5 text-emerald-600" /> },
  sales_intel: { title: "Sales Intel", icon: <TrendingUp className="h-3.5 w-3.5 text-[#0E56F5]" /> },
  renter_need: { title: "Renter Needs", icon: <Home className="h-3.5 w-3.5 text-amber-600" /> },
  general_discussion: { title: "General Discussions", icon: <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> },
};

const FILTER_ORDER: Filter[] = ["all", "buyer_need", "sales_intel", "renter_need", "general_discussion"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  buyer_need: "Buyer Needs",
  sales_intel: "Sales Intel",
  renter_need: "Renter Needs",
  general_discussion: "General Discussions",
};

interface BroadcastRow {
  id: string;
  category: Category;
  subject: string;
  message: string;
  recipient_count: number | null;
  created_at: string;
  sender: { id: string; name: string; email: string | null; phone: string | null; company: string | null } | null;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Communications Center > Feed — single searchable list of all broadcasts, filterable by message type. */
export default function CommunicationsFeed() {
  const [params] = useSearchParams();
  const location = useLocation();
  const channelParam = params.get("channel");
  const initialFilter: Filter = (FILTER_ORDER as string[]).includes(channelParam ?? "")
    ? (channelParam as Filter)
    : "all";

  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [emailTarget, setEmailTarget] = useState<{ name: string; email: string } | null>(null);
  const returnState = { from: `${location.pathname}${location.search}` };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("comms_broadcasts" as any)
        .select("id, category, subject, message, recipient_count, created_at, sender_id")
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const senderIds = Array.from(new Set((data as any[]).map((d) => d.sender_id).filter(Boolean)));
      const senders = new Map<string, BroadcastRow["sender"]>();
      if (senderIds.length) {
        const { data: agents } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email, phone, company")
          .in("id", senderIds);
        (agents || []).forEach((a: any) => {
          senders.set(a.id, {
            id: a.id,
            name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "AAC Agent",
            email: a.email ?? null,
            phone: a.phone ?? null,
            company: a.company ?? null,
          });
        });
      }

      const mapped: BroadcastRow[] = (data as any[]).map((d) => ({
        id: d.id,
        category: d.category,
        subject: d.subject ?? "",
        message: d.message ?? "",
        recipient_count: d.recipient_count ?? null,
        created_at: d.created_at,
        sender: d.sender_id ? senders.get(d.sender_id) ?? null : null,
      }));

      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filter === "all" ? rows : rows.filter((r) => r.category === filter);
    if (!q) return base;
    return base.filter((r) => {
      const senderName = r.sender?.name?.toLowerCase() ?? "";
      const senderEmail = r.sender?.email?.toLowerCase() ?? "";
      return (
        senderName.includes(q) ||
        senderEmail.includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <PageShell className="pb-12">
      <Seo title="Communications · All Messages" description="All Communications Center activity on AAC" noindex />
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-neutral-600">
          <Link to="/agent-dashboard">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Success Hub
          </Link>
        </Button>
      </div>

      <PageHeader title="Communications" />
      <p className="-mt-3 mb-4 text-sm text-neutral-500">
        All Communications Center broadcasts across the network.
      </p>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or keyword"
            className="pl-9 h-10 rounded-full border-neutral-300"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_ORDER.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  active
                    ? "h-8 rounded-full bg-neutral-900 px-3 text-[12px] font-medium text-white"
                    : "h-8 rounded-full border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-700 hover:border-neutral-300"
                }
              >
                {FILTER_LABEL[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white">
        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              {rows.length === 0 ? "No activity yet." : "No matches for your search."}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {filtered.map((r) => (
                <li key={r.id} className="px-6 py-6">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                    {CATEGORY_META[r.category].icon}
                    <span>{CATEGORY_META[r.category].title}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{r.subject || "(no subject)"}</p>
                    <span className="shrink-0 text-[11px] font-medium text-neutral-400">{relativeTime(r.created_at)}</span>
                  </div>
                  {r.message && (
                    <p className="mt-1 text-[13px] leading-snug text-neutral-700 line-clamp-2 whitespace-pre-wrap">
                      {r.message}
                    </p>
                  )}
                  {r.sender && (
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                      <Link
                        to={`/agent/${r.sender.id}`}
                        state={returnState}
                        className="font-medium text-[#0E56F5] hover:underline"
                      >
                        {r.sender.name}
                      </Link>
                      {r.sender.company && <span className="text-neutral-500">{r.sender.company}</span>}
                      {r.sender.phone && (
                        <span className="inline-flex items-center gap-1 text-neutral-600">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(r.sender.phone)}
                        </span>
                      )}
                      {r.sender.email && (
                        <button
                          type="button"
                          onClick={() => setEmailTarget({ name: r.sender!.name, email: r.sender!.email! })}
                          className="inline-flex items-center gap-1 text-[#0E56F5] hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {r.sender.email}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AgentEmailQuickDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        agentName={emailTarget?.name ?? ""}
        agentEmail={emailTarget?.email ?? ""}
      />
    </PageShell>
  );
}