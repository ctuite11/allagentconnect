import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ArrowLeft, Home, MessageSquare, TrendingUp, Users, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

type Category = "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";

const CATEGORY_META: Record<Category, { title: string; icon: JSX.Element }> = {
  buyer_need: { title: "Buyer Needs", icon: <Users className="h-4 w-4 text-emerald-600" /> },
  sales_intel: { title: "Sales Intel", icon: <TrendingUp className="h-4 w-4 text-[#0E56F5]" /> },
  renter_need: { title: "Renter Needs", icon: <Home className="h-4 w-4 text-amber-600" /> },
  general_discussion: { title: "General Discussions", icon: <MessageSquare className="h-4 w-4 text-indigo-600" /> },
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

/** Communications Center > Feed — searchable list of broadcasts for a single channel. */
export default function CommunicationsFeed() {
  const [params] = useSearchParams();
  const channelParam = (params.get("channel") as Category) || "buyer_need";
  const category: Category = ["buyer_need", "sales_intel", "renter_need", "general_discussion"].includes(channelParam)
    ? channelParam
    : "buyer_need";

  const meta = CATEGORY_META[category];
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("comms_broadcasts" as any)
        .select("id, category, subject, message, recipient_count, created_at, sender_id")
        .eq("category", category)
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
  }, [category]);

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

  return (
    <PageShell className="pb-12">
      <Seo title={`${meta.title} · Communications Center`} description={`All ${meta.title} activity on AAC`} noindex />
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-neutral-600">
          <Link to="/agent-dashboard">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Success Hub
          </Link>
        </Button>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {meta.icon}
            {meta.title}
          </span>
        }
        description={`All ${meta.title.toLowerCase()} broadcasts across the network.`}
      />

      <div className="mt-6 mb-4 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or keyword"
          className="pl-9 h-10 rounded-lg border-neutral-300"
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white">
        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              {rows.length === 0 ? "No activity yet on this channel." : "No matches for your search."}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <li key={r.id} className="px-6 py-4">
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
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                      <Link
                        to={`/agent/${r.sender.id}`}
                        className="font-medium text-neutral-900 hover:text-primary hover:underline"
                      >
                        {r.sender.name}
                      </Link>
                      {r.sender.company && <span className="text-neutral-500">{r.sender.company}</span>}
                      {r.sender.phone && (
                        <a href={`tel:${r.sender.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Phone className="h-3 w-3" />
                          {r.sender.phone}
                        </a>
                      )}
                      {r.sender.email && (
                        <a href={`mailto:${r.sender.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Mail className="h-3 w-3" />
                          {r.sender.email}
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}