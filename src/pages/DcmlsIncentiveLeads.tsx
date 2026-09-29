import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Lead {
  id: string;
  incentive_type: "buyer" | "seller";
  consumer_name: string;
  consumer_email: string;
  source_zip: string | null;
  source_listing_id: string | null;
  incentive_snapshot: { incentives?: string[]; more?: string | null } | null;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  body: string | null;
  metadata: { lead_id?: string; route?: string } | null;
  read_at: string | null;
  created_at: string;
}

const fmt = (d: string) => new Date(d).toLocaleString();

/** Resolves a notification's destination from metadata (no link_url column). */
export function routeForAgentNotification(n: { type?: string; metadata: Notification["metadata"] }): string | null {
  const leadId = n.metadata?.lead_id;
  return leadId ? `/agent/dcmls/leads/${leadId}` : n.metadata?.route ?? null;
}

export function DcmlsIncentiveLeadsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    supabase
      .from("agent_notifications")
      .select("id, title, body, metadata, read_at, created_at")
      .eq("type", "dcmls_incentive_lead")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setItems((data ?? []) as Notification[]));
  }, []);

  const open = async (n: Notification) => {
    const to = routeForAgentNotification(n);
    if (!n.read_at) await supabase.from("agent_notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    if (to) navigate(to);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">DCMLS incentive requests</h1>
      {items === null ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {items && items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No requests yet.</p> : null}
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {(items ?? []).map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => void open(n)} className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-muted">
              <span className={`text-sm ${n.read_at ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</span>
              {n.body ? <span className="text-xs text-muted-foreground">{n.body}</span> : null}
              <span className="text-xs text-muted-foreground">{fmt(n.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DcmlsIncentiveLeadDetail() {
  const { leadId } = useParams();
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);

  useEffect(() => {
    if (!leadId) return;
    supabase
      .from("dcmls_incentive_leads")
      .select("id, incentive_type, consumer_name, consumer_email, source_zip, source_listing_id, incentive_snapshot, created_at")
      .eq("id", leadId)
      .maybeSingle()
      .then(({ data }) => setLead((data as Lead | null) ?? null));
    void supabase
      .from("agent_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("type", "dcmls_incentive_lead")
      .is("read_at", null)
      .contains("metadata", { lead_id: leadId });
  }, [leadId]);

  if (lead === undefined) return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-muted-foreground">Loading…</div>;
  if (lead === null)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Request not found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/agent/dcmls/leads">All requests</Link></Button>
      </div>
    );

  const label = lead.incentive_type === "buyer" ? "Buyer" : "Seller";
  const snap = lead.incentive_snapshot ?? {};
  const rows: [string, React.ReactNode][] = [
    ["Request", `${label} incentive details`],
    ["Name", lead.consumer_name],
    ["Email", <a key="e" className="text-primary underline-offset-2 hover:underline" href={`mailto:${lead.consumer_email}`}>{lead.consumer_email}</a>],
    ["ZIP", lead.source_zip ?? "—"],
    ["Property", lead.source_listing_id ? <Link key="l" className="text-primary underline-offset-2 hover:underline" to={`/property/${lead.source_listing_id}`}>View listing</Link> : "—"],
    ["Requested", fmt(lead.created_at)],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/agent/dcmls/leads" className="text-sm text-muted-foreground hover:text-foreground">All requests</Link>
      <h1 className="mt-2 text-xl font-medium text-foreground">{label} incentive request</h1>
      <dl className="mt-6 divide-y divide-border rounded-lg border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="col-span-2 text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Incentives offered when requested</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
          {(snap.incentives ?? []).filter((i) => i !== "More").map((i) => <li key={i}>{i}</li>)}
        </ul>
        {snap.more ? <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{snap.more}</p> : null}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Reply to the consumer by email with your incentive details.</p>
    </div>
  );
}
