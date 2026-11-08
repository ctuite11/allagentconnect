import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { COMMS_CHANNEL_BY_KEY } from "@/lib/commsChannels";
import { isCommsChannelKey } from "@/lib/commsChannels";

type RequestStatus = "new" | "in_progress" | "completed" | "declined";
type ConciergeRequest = {
  id: string;
  agent_id: string;
  request_type: "listing" | "broadcast";
  communication_channel: string | null;
  subject: string;
  property_address: string | null;
  details: string;
  reference_url: string | null;
  status: RequestStatus;
  created_at: string;
};
type AgentIdentity = { email: string | null; first_name: string | null; last_name: string | null };

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

/** Staff-only manual queue; never sends emails or auto-publishes listings. */
export default function AdminConciergeRequests() {
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentIdentity>>({});
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("agent_concierge_requests")
        .select("id, agent_id, request_type, communication_channel, subject, property_address, details, reference_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as ConciergeRequest[];
      setRequests(rows);

      const ids = Array.from(new Set(rows.map((r) => r.agent_id)));
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("agent_profiles")
          .select("id, email, first_name, last_name")
          .in("id", ids);
        if (!profilesError) {
          setAgents(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile])));
        }
      } else {
        setAgents({});
      }
    } catch {
      toast.error("Unable to load concierge requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function setStatus(id: string, status: RequestStatus) {
    setChangingId(id);
    try {
      const { error } = await (supabase as any)
        .from("agent_concierge_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success("Request status updated.");
    } catch {
      toast.error("Could not update this request.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <AgentAacPage>
      <Seo title="Concierge Requests | AAC Admin" description="Private staff concierge queue." />
      <AgentPageHeader title="Concierge Requests" subtitle="Manual review queue — no automatic network sends or publishing."
        actions={<Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>} />
      {loading ? (
        <p className="flex items-center gap-2 text-zinc-600"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-zinc-600">No concierge requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const agent = agents[request.agent_id];
            const name = [agent?.first_name, agent?.last_name].filter(Boolean).join(" ");
            return (
              <article key={request.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {request.request_type === "listing" ? "Property listing" : "Network broadcast"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900">{request.subject}</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      {name || agent?.email || request.agent_id} · {new Date(request.created_at).toLocaleString()}
                    </p>
                    {name && agent?.email && <p className="mt-1 text-sm text-zinc-600">{agent.email}</p>}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Status
                    <select aria-label={`Status for ${request.subject}`}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                      value={request.status} disabled={changingId === request.id}
                      onChange={(event) => void setStatus(request.id, event.target.value as RequestStatus)}>
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                {request.request_type === "broadcast" && request.communication_channel && (
                  <p className="mt-3 text-sm text-zinc-800">
                    <strong>Communications channel:</strong>{" "}
                    {isCommsChannelKey(request.communication_channel)
                      ? COMMS_CHANNEL_BY_KEY[request.communication_channel].title
                      : "Unknown channel"}
                  </p>
                )}
                {request.property_address && <p className="mt-3 text-sm text-zinc-800"><strong>Property:</strong> {request.property_address}</p>}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{request.details}</p>
                {request.reference_url && <p className="mt-3 break-all text-sm">
                  <strong>Reference:</strong> {request.reference_url}
                </p>}
              </article>
            );
          })}
        </div>
      )}
    </AgentAacPage>
  );
}
