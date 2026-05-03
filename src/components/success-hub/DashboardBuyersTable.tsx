import { useNavigate } from "react-router-dom";
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900">Buyers</h3>
          <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">
            Name, phone, email, hot sheets, and favorites
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/success-hub/buyers")}
          className="shrink-0 text-sm font-medium text-[#0E56F5] hover:underline"
        >
          View all →
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto overscroll-contain rounded-xl border border-zinc-100 bg-white">
        {buyers.length === 0 ? (
          <div className="py-5 text-center text-sm text-neutral-500">No buyers yet.</div>
        ) : (
          <>
            <div className="md:hidden">
              <ul className="divide-y divide-zinc-100">
                {buyers.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left transition-colors hover:bg-zinc-50/80"
                      onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                    >
                      <span className="block truncate text-sm font-semibold text-neutral-900">{displayName(b)}</span>
                      <div className="mt-0.5 space-y-0.5 text-[12px] text-neutral-500">
                        <p className="truncate">{formatPhone(b.phone)}</p>
                        <p className="truncate">{b.email || "—"}</p>
                        <p className="text-[11px] text-neutral-600">
                          <span className="tabular-nums font-medium">{b.hotSheetCount}</span> Hot Sheets ·{" "}
                          <span className="tabular-nums font-medium">{b.favoriteCount}</span> Favorites
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Name</th>
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Phone</th>
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Email</th>
                    <th className="w-[5.5rem] px-1.5 py-1.5 text-center text-[11px] font-medium text-neutral-500">
                      Hot Sheets
                    </th>
                    <th className="w-24 px-1.5 py-1.5 text-center text-[11px] font-medium text-neutral-500">
                      Favorites
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {buyers.map((b) => (
                    <tr
                      key={b.id}
                      className="cursor-pointer bg-white hover:bg-neutral-50/40"
                      onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                    >
                      <td className="max-w-[9rem] truncate px-2.5 py-1.5 text-[13px] font-medium text-neutral-900">
                        {displayName(b)}
                      </td>
                      <td className="max-w-[6rem] whitespace-nowrap px-2.5 py-1.5 text-[12px] text-neutral-600">
                        {formatPhone(b.phone)}
                      </td>
                      <td className="max-w-[14rem] truncate px-2.5 py-1.5 text-[12px] text-neutral-600">
                        {b.email || "—"}
                      </td>
                      <td className="px-1.5 py-1.5 text-center text-[12px] tabular-nums text-neutral-600">
                        {b.hotSheetCount}
                      </td>
                      <td className="px-1.5 py-1.5 text-center text-[12px] tabular-nums text-neutral-600">
                        {b.favoriteCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
