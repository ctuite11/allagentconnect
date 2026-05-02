import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { SuccessHubSummary } from "@/hooks/useSuccessHubData";

interface DashboardBuyersTableProps {
  buyers: SuccessHubSummary["buyers"];
}

export function DashboardBuyersTable({ buyers }: DashboardBuyersTableProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-900">Buyers</h3>
          <p className="mt-0.5 text-[13px] text-neutral-500">Active pipeline</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/success-hub/buyers")}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-[#0E56F5] hover:underline"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl">
        {buyers.length === 0 ? (
          <div className="py-6 text-center text-sm text-neutral-500">No buyers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500">Hot Sheets</th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-neutral-500 sm:table-cell">
                  Email
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {buyers.slice(0, 6).map((b) => {
                const name = (b as any).name || [b.first_name, b.last_name].filter(Boolean).join(" ").trim() || b.email;
                return (
                  <tr
                    key={b.id}
                    className="cursor-pointer bg-white hover:bg-neutral-50/40"
                    onClick={() => navigate(`/success-hub/buyers/${b.id}`)}
                  >
                    <td className="max-w-[140px] truncate px-3 py-2 font-medium text-neutral-900">{name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-sm font-medium ${b.status === "active" ? "text-[#50C878]" : "text-[#0E56F5]"}`}
                      >
                        {b.status === "active" ? "Active" : "Pending"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-neutral-500">{b.hotSheetCount}</td>
                    <td className="hidden max-w-[160px] truncate px-3 py-2 text-neutral-500 sm:table-cell">
                      {b.email}
                    </td>
                    <td className="px-2 py-2">
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
