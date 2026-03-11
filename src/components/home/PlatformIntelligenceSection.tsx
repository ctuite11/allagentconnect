import { Globe } from "lucide-react";

const stats = [
  { label: "Active Listings", value: "1,247" },
  { label: "Network Matches", value: "389" },
  { label: "Avg. Days on Network", value: "12" },
  { label: "Agents Online", value: "94" },
];

const chartBars = [35, 52, 45, 68, 80, 62, 74, 55, 90, 72, 60, 85];

const tableRows = [
  { address: "42 Beacon St", city: "Boston", price: "$1,250,000", status: "Active", days: 3 },
  { address: "18 Elm Ave", city: "Hartford", price: "$425,000", status: "Matched", days: 1 },
  { address: "7 Ocean Dr", city: "Newport", price: "$2,100,000", status: "Coming Soon", days: 0 },
  { address: "215 Main St", city: "Cambridge", price: "$875,000", status: "Active", days: 5 },
];

const statusColor: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-400",
  "Coming Soon": "bg-amber-500/20 text-amber-400",
  Matched: "bg-blue-500/20 text-blue-400",
};

const listingCards = [
  { price: "$1,250,000", address: "42 Beacon St, Boston", badge: "Coming Soon", gradient: "from-zinc-300 to-zinc-400" },
  { price: "$875,000", address: "215 Main St, Cambridge", badge: "Off Market", gradient: "from-zinc-400 to-zinc-500" },
  { price: "$2,100,000", address: "7 Ocean Dr, Newport", badge: "Active", gradient: "from-zinc-200 to-zinc-300" },
  { price: "$425,000", address: "18 Elm Ave, Hartford", badge: "Matched", gradient: "from-zinc-300 to-zinc-500" },
  { price: "$1,675,000", address: "99 Park Ave, Providence", badge: "Coming Soon", gradient: "from-zinc-400 to-zinc-300" },
];

const badgeColor: Record<string, string> = {
  "Coming Soon": "bg-amber-100 text-amber-700",
  "Off Market": "bg-zinc-100 text-zinc-700",
  Active: "bg-emerald-100 text-emerald-700",
  Matched: "bg-blue-100 text-blue-700",
};

export default function PlatformIntelligenceSection() {
  return (
    <section id="platform-intelligence" className="py-20 md:py-28 bg-white text-zinc-900">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-xs font-medium text-zinc-600 mb-6">
            <Globe className="h-3.5 w-3.5" />
            Network Intelligence
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Operate on network intelligence,
            <br className="hidden md:block" />
            not the public feed.
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            See what's happening across the agent network before it reaches portals, feeds, or the MLS.
          </p>
        </div>

        {/* Dashboard Mockup */}
        <div className="mx-auto max-w-5xl rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <div className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="ml-3 text-xs text-zinc-500 font-mono">allagentconnect.com/dashboard</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800">
            {stats.map((s) => (
              <div key={s.label} className="bg-zinc-900 px-5 py-4">
                <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="px-5 py-6 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-4 font-medium">Network Activity — Last 12 Weeks</p>
            <div className="flex items-end gap-1.5 h-24">
              {chartBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-emerald-500/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Mini table */}
          <div className="border-t border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                    <th className="text-left px-5 py-3 font-medium">Address</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">City</th>
                    <th className="text-left px-5 py-3 font-medium">Price</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.address} className="border-b border-zinc-800/50 text-white">
                      <td className="px-5 py-3 font-medium">{r.address}</td>
                      <td className="px-5 py-3 text-zinc-400 hidden md:table-cell">{r.city}</td>
                      <td className="px-5 py-3">{r.price}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[r.status] ?? "text-zinc-400"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-500 hidden md:table-cell">{r.days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Listing Cards Row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {listingCards.map((card) => (
            <div key={card.address} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className={`aspect-[4/3] bg-gradient-to-br ${card.gradient}`} />
              <div className="p-3">
                <span className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mb-1.5 ${badgeColor[card.badge] ?? "bg-zinc-100 text-zinc-700"}`}>
                  {card.badge}
                </span>
                <p className="text-sm font-semibold text-zinc-900">{card.price}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{card.address}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
