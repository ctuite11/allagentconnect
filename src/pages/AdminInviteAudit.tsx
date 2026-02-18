import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  AlertCircle,
  Send,
  Search,
  Link2,
} from "lucide-react";

interface InviteEvent {
  id: string;
  created_at: string;
  token_id: string;
  hot_sheet_id: string | null;
  client_id: string | null;
  client_email: string | null;
  event_type: string;
  email_job_id: string | null;
  actor_user_id: string | null;
  meta: Record<string, unknown>;
}

interface TokenGroup {
  token_id: string;
  client_email: string | null;
  hot_sheet_id: string | null;
  events: InviteEvent[];
}

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  token_created:  { label: "Token Created",   icon: <Link2 className="h-3.5 w-3.5" />,        variant: "secondary" },
  email_enqueued: { label: "Email Enqueued",   icon: <Mail className="h-3.5 w-3.5" />,         variant: "outline" },
  email_sent:     { label: "Email Sent",       icon: <Send className="h-3.5 w-3.5" />,         variant: "default" },
  email_failed:   { label: "Email Failed",     icon: <AlertCircle className="h-3.5 w-3.5" />,  variant: "destructive" },
  token_accepted: { label: "Token Accepted",   icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: "default" },
  invite_resent:  { label: "Invite Resent",    icon: <RefreshCw className="h-3.5 w-3.5" />,    variant: "secondary" },
};

function EventBadge({ type }: { type: string }) {
  const cfg = EVENT_CONFIG[type] ?? { label: type, icon: <Clock className="h-3.5 w-3.5" />, variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs py-0.5">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function TokenTimeline({ group }: { group: TokenGroup }) {
  const sorted = [...group.events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const isAccepted = sorted.some((e) => e.event_type === "token_accepted");

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-medium text-sm">{group.client_email ?? "—"}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{group.token_id}</p>
          </div>
          <Badge variant={isAccepted ? "default" : "secondary"}>
            {isAccepted ? "Accepted" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="relative border-l border-border ml-2 space-y-4">
          {sorted.map((ev) => (
            <li key={ev.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-border" />
              <div className="flex items-center gap-2 flex-wrap">
                <EventBadge type={ev.event_type} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(ev.created_at), "MMM d, yyyy HH:mm:ss")}
                </span>
              </div>
              {ev.email_job_id && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  job: {ev.email_job_id}
                </p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

const AdminInviteAudit = () => {
  const [events, setEvents] = useState<InviteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("invite_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data) setEvents(data as InviteEvent[]);
      setLoading(false);
    };
    load();
  }, []);

  // Group events by token_id
  const groups = events.reduce<Record<string, TokenGroup>>((acc, ev) => {
    if (!acc[ev.token_id]) {
      acc[ev.token_id] = {
        token_id: ev.token_id,
        client_email: ev.client_email,
        hot_sheet_id: ev.hot_sheet_id,
        events: [],
      };
    }
    acc[ev.token_id].events.push(ev);
    return acc;
  }, {});

  const q = search.trim().toLowerCase();
  const filtered = Object.values(groups).filter((g) => {
    if (!q) return true;
    return (
      g.client_email?.toLowerCase().includes(q) ||
      g.token_id.toLowerCase().includes(q) ||
      g.hot_sheet_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col pt-20">
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <PageHeader
            title="Invite Audit"
            subtitle="Trace every invite: token → email job → delivery → acceptance"
            backTo="/admin/approvals"
          />

          <div className="relative mb-6 mt-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by client email, token ID, or hot sheet ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No invite events found.</p>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {filtered.length} invite{filtered.length !== 1 ? "s" : ""} found
              </p>
              {filtered.map((g) => (
                <TokenTimeline key={g.token_id} group={g} />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminInviteAudit;
