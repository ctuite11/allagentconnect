import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type Range = "24h" | "7d" | "30d" | "90d";

interface JobRow {
  id: string;
  created_at: string;
  status: string;
  delivery_status: string | null;
  payload: any;
  provider_message_id: string | null;
  last_error: string | null;
}

interface EventRow {
  job_id: string | null;
  event: string;
  provider_message_id: string | null;
}

const RANGE_HOURS: Record<Range, number> = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };

function statusBadge(status: string) {
  const variant =
    status === "sent" || status === "delivered" ? "default"
    : status === "bounced" || status === "failed" || status === "complained" ? "destructive"
    : "secondary";
  return <Badge variant={variant as any}>{status}</Badge>;
}

export default function AdminEmailAnalytics() {
  const [range, setRange] = useState<Range>("30d");
  const [template, setTemplate] = useState<string>("all");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGE_HOURS[range] * 3600_000).toISOString();
      const [{ data: jobsData }, { data: evData }] = await Promise.all([
        supabase
          .from("email_jobs")
          .select("id, created_at, status, delivery_status, payload, provider_message_id, last_error")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("email_events")
          .select("job_id, event, provider_message_id")
          .gte("created_at", since)
          .in("event", ["delivered", "opened", "clicked", "bounced", "complained"])
          .limit(5000),
      ]);
      if (!active) return;
      setJobs((jobsData ?? []) as JobRow[]);
      setEvents((evData ?? []) as EventRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [range]);

  const templates = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => s.add(String(j.payload?.template ?? "unknown")));
    return ["all", ...Array.from(s).sort()];
  }, [jobs]);

  const filteredJobs = useMemo(
    () => template === "all" ? jobs : jobs.filter((j) => (j.payload?.template ?? "unknown") === template),
    [jobs, template]
  );

  const stats = useMemo(() => {
    const jobIds = new Set(filteredJobs.map((j) => j.id));
    const evForJobs = events.filter((e) => e.job_id && jobIds.has(e.job_id));
    const uniqueByJob = (evt: string) => {
      const s = new Set<string>();
      evForJobs.forEach((e) => { if (e.event === evt && e.job_id) s.add(e.job_id); });
      return s.size;
    };
    const sent = filteredJobs.filter((j) => j.status === "sent").length;
    const failed = filteredJobs.filter((j) => j.status === "failed").length;
    const delivered = uniqueByJob("delivered");
    const opened = uniqueByJob("opened");
    const clicked = uniqueByJob("clicked");
    const bounced = uniqueByJob("bounced");
    const complained = uniqueByJob("complained");
    return { total: filteredJobs.length, sent, failed, delivered, opened, clicked, bounced, complained };
  }, [filteredJobs, events]);

  const byTemplate = useMemo(() => {
    const map = new Map<string, { total: number; sent: number; failed: number; delivered: number; opened: number; clicked: number; bounced: number }>();
    const eventByJob = new Map<string, Set<string>>();
    events.forEach((e) => {
      if (!e.job_id) return;
      if (!eventByJob.has(e.job_id)) eventByJob.set(e.job_id, new Set());
      eventByJob.get(e.job_id)!.add(e.event);
    });
    jobs.forEach((j) => {
      const t = String(j.payload?.template ?? "unknown");
      const cur = map.get(t) ?? { total: 0, sent: 0, failed: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      cur.total += 1;
      if (j.status === "sent") cur.sent += 1;
      if (j.status === "failed") cur.failed += 1;
      const evs = eventByJob.get(j.id);
      if (evs) {
        if (evs.has("delivered")) cur.delivered += 1;
        if (evs.has("opened")) cur.opened += 1;
        if (evs.has("clicked")) cur.clicked += 1;
        if (evs.has("bounced")) cur.bounced += 1;
      }
      map.set(t, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [jobs, events]);

  const recipientFor = (j: JobRow): string => {
    const to = j.payload?.to;
    if (typeof to === "string") return to;
    if (Array.isArray(to)) {
      if (to.length > 5) return `${to.length} recipients (bulk)`;
      return to.join(", ");
    }
    return j.payload?.recipient ?? "—";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1280px]">
      <PageHeader title="Email Analytics" subtitle="Bulk and transactional email delivery, opens, clicks, and bounces." />

      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => (<SelectItem key={t} value={t}>{t === "all" ? "All templates" : t}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total queued", value: stats.total },
            { label: "Sent", value: stats.sent },
            { label: "Delivered", value: stats.delivered },
            { label: "Opened", value: stats.opened },
            { label: "Clicked", value: stats.clicked },
            { label: "Bounced", value: stats.bounced },
            { label: "Complained", value: stats.complained },
            { label: "Failed", value: stats.failed },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold mt-1">{s.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>By template</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Bounced</TableHead>
                <TableHead className="text-right">Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTemplate.map(([t, s]) => (
                <TableRow key={t}>
                  <TableCell className="font-medium">{t}</TableCell>
                  <TableCell className="text-right">{s.total}</TableCell>
                  <TableCell className="text-right">{s.sent}</TableCell>
                  <TableCell className="text-right">{s.delivered}</TableCell>
                  <TableCell className="text-right">{s.opened}</TableCell>
                  <TableCell className="text-right">{s.clicked}</TableCell>
                  <TableCell className="text-right">{s.bounced}</TableCell>
                  <TableCell className="text-right">{s.failed}</TableCell>
                </TableRow>
              ))}
              {byTemplate.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No emails in range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent emails ({filteredJobs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.slice(0, 200).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(j.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-xs">{String(j.payload?.template ?? "—")}</TableCell>
                    <TableCell className="text-xs truncate max-w-[260px]">{recipientFor(j)}</TableCell>
                    <TableCell>{statusBadge(j.status)}</TableCell>
                    <TableCell>{j.delivery_status ? statusBadge(j.delivery_status) : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-destructive truncate max-w-[260px]">{j.last_error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
