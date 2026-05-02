import { useNavigate } from "react-router-dom";
import { ChevronRight, Heart } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardBuyersTableProps {
  buyers: SuccessHubSummary["buyers"];
}

function displayName(b: SuccessHubSummary["buyers"][number]) {
  const n = [b.first_name, b.last_name].filter(Boolean).join(" ").trim();
  return n || b.email || "Buyer";
}

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  return phone;
}

export function DashboardBuyersTable({ buyers }: DashboardBuyersTableProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900">Buyers</h3>
          <p className="mt-0.5 text-[13px] text-neutral-500">Pipeline, contacts, and saved listings</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/success-hub/buyers")}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-[#0E56F5] hover:underline"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white md:hidden">
        {buyers.length === 0 ? (
          <div className="py-6 text-center text-sm text-neutral-500">No buyers yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {buyers.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left transition-colors hover:bg-zinc-50/80"
                  onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-neutral-900">{displayName(b)}</span>
                    {b.attentionNote ? (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
                        {b.attentionNote}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[12px] text-neutral-500">
                    <p className="truncate">{formatPhone(b.phone)}</p>
                    <p className="truncate">{b.email || "—"}</p>
                    <p className="text-neutral-600">
                      <span className="tabular-nums font-medium">{b.hotSheetCount}</span> hot sheets ·{" "}
                      <span className="tabular-nums font-medium">{b.favoriteCount}</span>{" "}
                      <span className="inline-flex items-center gap-0.5 align-middle">
                        <Heart className="inline h-3 w-3 text-[#50C878]" aria-hidden strokeWidth={2} /> fav
                      </span>
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-zinc-100 bg-white md:block">
        {buyers.length === 0 ? (
          <div className="py-6 text-center text-sm text-neutral-500">No buyers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Phone</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Email</th>
                <th className="w-24 px-2 py-2 text-center text-xs font-medium text-neutral-500">Sheets</th>
                <th className="w-28 px-2 py-2 text-center text-xs font-medium text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3 text-[#50C878]" aria-hidden strokeWidth={2} />
                    Favorites
                  </span>
                </th>
                <th className="min-w-[8rem] px-3 py-2 text-left text-xs font-medium text-neutral-500">Note</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {buyers.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer bg-white hover:bg-neutral-50/40"
                  onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                >
                  <td className="max-w-[150px] truncate px-3 py-2 font-medium text-neutral-900">
                    {displayName(b)}
                  </td>
                  <td className="max-w-[120px] whitespace-nowrap px-3 py-2 text-neutral-600">
                    {formatPhone(b.phone)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-neutral-600">{b.email || "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-neutral-600">{b.hotSheetCount}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-neutral-600">{b.favoriteCount}</td>
                  <td className="max-w-[200px] px-3 py-2">
                    {b.attentionNote ? (
                      <span className="inline-flex max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-100">
                        {b.attentionNote}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
