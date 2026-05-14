import { useNavigate } from "react-router-dom";
import { Flame, Heart, Users } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

/** Matches `BuyersList`: buyer workspace uses `clients.id` in URL (`/agent/buyers/:id`). */
function buyerAccountPath(clientId: string) {
  return `/agent/buyers/${clientId}`;
}

interface DashboardBuyersTableProps {
  buyers: SuccessHubSummary["buyers"];
}

function displayName(b: SuccessHubSummary["buyers"][number]) {
  const n = [b.first_name, b.last_name]
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .map((x) => x.trim())
    .join(" ")
    .trim();
  if (n) return n;
  const em = typeof b.email === "string" ? b.email.trim() : "";
  if (em) return em;
  return "Buyer";
}

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  return phone;
}

export function DashboardBuyersTable({ buyers }: DashboardBuyersTableProps) {
  const navigate = useNavigate();

  const openBuyer = (clientId: string) => {
    navigate(buyerAccountPath(clientId));
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
            <Users className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
            Buyers
          </h3>
          <p className="mt-0.5 text-xs leading-snug text-neutral-500">
            Name, phone, email, hot sheets, and favorites
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/agent/buyers")}
          className="shrink-0 rounded-sm text-sm font-medium text-indigo-600 underline-offset-2 transition-colors hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2"
        >
          View all →
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-white shadow-sm">
        {buyers.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-neutral-500">
            No buyers yet. Add contacts and relationships to see them here.
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <ul className="divide-y divide-zinc-100">
                {buyers.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="w-full cursor-pointer px-3 py-2 text-left transition-colors duration-150 hover:bg-neutral-50/90 active:bg-neutral-50"
                      onClick={() => openBuyer(b.id)}
                    >
                      <span className="block truncate text-[13px] font-medium text-neutral-900">{displayName(b)}</span>
                      <div className="mt-0.5 space-y-0.5 text-[12px] text-neutral-500">
                        <p className="truncate">{formatPhone(b.phone)}</p>
                        <p className="truncate">{typeof b.email === "string" && b.email.trim() ? b.email.trim() : "—"}</p>
                        <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-neutral-600">
                          <span className="inline-flex items-center gap-0.5">
                            <Flame className="h-3 w-3 text-red-600" aria-hidden />
                            <span className="tabular-nums font-medium text-neutral-700">{b.hotSheetCount}</span>
                            <span className="text-neutral-500">Hot Sheets</span>
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Heart className="h-3 w-3 fill-rose-500/15 text-rose-600" aria-hidden />
                            <span className="tabular-nums font-medium text-neutral-700">{b.favoriteCount}</span>
                            <span className="text-neutral-500">Favorites</span>
                          </span>
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
                  <tr className="border-b border-neutral-100 bg-neutral-50/80">
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Name</th>
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Phone</th>
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-500">Email</th>
                    <th className="w-[5.5rem] px-1.5 py-1.5 text-center text-[11px] font-medium text-neutral-500">
                      <span className="inline-flex items-center justify-center gap-1">
                        <Flame className="h-3 w-3 text-red-600" aria-hidden />
                        Hot Sheets
                      </span>
                    </th>
                    <th className="w-24 px-1.5 py-1.5 text-center text-[11px] font-medium text-neutral-500">
                      <span className="inline-flex items-center justify-center gap-1">
                        <Heart className="h-3 w-3 fill-rose-500/15 text-rose-600" aria-hidden />
                        Favorites
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {buyers.map((b) => (
                    <tr
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer bg-white outline-none transition-colors duration-150 hover:bg-neutral-50/90 focus-visible:bg-neutral-50/90 focus-visible:ring-2 focus-visible:ring-zinc-300/80 focus-visible:ring-inset"
                      onClick={() => openBuyer(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openBuyer(b.id);
                        }
                      }}
                    >
                      <td className="max-w-[9rem] truncate px-2.5 py-1.5 text-[13px] font-medium text-neutral-900">
                        {displayName(b)}
                      </td>
                      <td className="max-w-[6rem] whitespace-nowrap px-2.5 py-1.5 text-[12px] text-neutral-600">
                        {formatPhone(b.phone)}
                      </td>
                      <td className="max-w-[14rem] truncate px-2.5 py-1.5 text-[12px] text-neutral-600">
                        {typeof b.email === "string" && b.email.trim() ? b.email.trim() : "—"}
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
