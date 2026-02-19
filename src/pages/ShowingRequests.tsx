import { useEffect, useMemo, useState } from "react";

type ShowingRequest = {
  id: string;
  created_at: string;
  mls_number: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string | null;
  message?: string | null;
  status: "new" | "in_progress" | "scheduled" | "completed" | "closed";
};

const STATUS_OPTIONS: Array<ShowingRequest["status"] | ""> = [
  "",
  "new",
  "in_progress",
  "scheduled",
  "completed",
  "closed",
];

export default function ShowingRequests() {
  const [rows, setRows] = useState<ShowingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "100");
    return `/api/showing-requests?${params.toString()}`;
  }, [status, q]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json?.error || "Request failed");
        if (!cancelled) setRows(json.data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Showing Requests</h1>
      <p className="mt-1 text-sm text-slate-500">
        Filter by status or search by MLS #, name, or email.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="h-11 w-full rounded-xl border px-3 sm:w-56"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "All statuses" : s.replace("_", " ")}
            </option>
          ))}
        </select>

        <input
          className="h-11 w-full flex-1 rounded-xl border px-3"
          placeholder="Search MLS #, requester name, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-6 rounded-2xl border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium">
          {loading ? "Loading…" : `${rows.length} result(s)`}
        </div>

        {error && <div className="px-4 py-4 text-sm text-red-600">Error: {error}</div>}

        {loading && (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-4 space-y-2">
                <div className="h-4 w-32 bg-neutral-100 rounded animate-pulse" />
                <div className="h-3 w-64 bg-neutral-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="px-4 py-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-600">No showing requests yet.</p>
            <p className="text-xs text-slate-400">Requests submitted via listing pages will appear here.</p>
          </div>
        )}

        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {r.mls_number}{" "}
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-xs font-medium">
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {r.requester_name} • {r.requester_email}
                    {r.requester_phone ? ` • ${r.requester_phone}` : ""}
                  </div>
                  {r.message ? (
                    <div className="mt-2 text-sm text-slate-700">
                      {r.message.length > 160 ? r.message.slice(0, 160) + "…" : r.message}
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
