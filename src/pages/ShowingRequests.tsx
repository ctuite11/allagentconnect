import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShowingRequestStatus = "new" | "in_progress" | "scheduled" | "completed" | "closed";

interface ShowingRequest {
  id: string;
  created_at: string;
  mls_number: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  message: string | null;
  status: ShowingRequestStatus;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE_CLASS: Record<ShowingRequestStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

const formatStatus = (status: ShowingRequestStatus) => status.replace("_", " ");

export default function ShowingRequests() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<ShowingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status === "all" ? "" : status);
    params.set("q", search.trim());
    params.set("limit", "100");
    return `/api/showing-requests?${params.toString()}`;
  }, [search, status]);

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(endpoint, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load showing requests");
        }
        setRequests(payload.data || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load showing requests");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [endpoint]);

  return (
    <div className="min-h-screen bg-white pt-24 px-6 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Showing Requests" subtitle="Read-only inbox for incoming showing requests" />

        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search MLS #, requester name, or email"
          />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b bg-zinc-50">
            <div className="col-span-2">MLS #</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Requester</div>
            <div className="col-span-3">Message</div>
            <div className="col-span-2">Created</div>
          </div>

          {loading && <div className="p-4 text-sm text-zinc-600">Loading requests…</div>}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          {!loading && !error && requests.length === 0 && (
            <div className="p-4 text-sm text-zinc-600">No showing requests found.</div>
          )}

          {!loading && !error && requests.map((request) => (
            <div key={request.id} className="grid grid-cols-12 gap-3 px-4 py-4 border-t text-sm items-start">
              <div className="col-span-2 font-medium">{request.mls_number}</div>
              <div className="col-span-2">
                <Badge variant="outline" className={STATUS_BADGE_CLASS[request.status]}>
                  {formatStatus(request.status)}
                </Badge>
              </div>
              <div className="col-span-3">
                <p className="font-medium text-zinc-900">{request.requester_name}</p>
                <p className="text-zinc-600">{request.requester_email}</p>
                {request.requester_phone && <p className="text-zinc-500">{request.requester_phone}</p>}
              </div>
              <div className="col-span-3 text-zinc-700 line-clamp-2">{request.message || "—"}</div>
              <div className="col-span-2 text-zinc-600">
                {new Date(request.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
