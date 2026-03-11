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

const propertyCards = [
  { price: "$1,250,000", address: "42 Beacon St, Boston", beds: 4, baths: 3, sqft: "2,800", status: "Active" },
  { price: "$425,000", address: "18 Elm Ave, Hartford", beds: 3, baths: 2, sqft: "1,650", status: "Coming Soon" },
  { price: "$2,100,000", address: "7 Ocean Dr, Newport", beds: 5, baths: 4, sqft: "4,200", status: "Active" },
  { price: "$875,000", address: "215 Main St, Cambridge", beds: 3, baths: 2, sqft: "1,900", status: "Matched" },
  { price: "$650,000", address: "33 Park Rd, Providence", beds: 2, baths: 2, sqft: "1,400", status: "Active" },
];

const statusColor: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-400",
  "Coming Soon": "bg-amber-500/20 text-amber-400",
  Matched: "bg-blue-500/20 text-blue-400",
};

export default function NetworkIntelligenceSection() {
  return (
    <section className="py-20 md:py-28 bg-white text-zinc-900">
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
            <div className="grid grid-cols-[1fr_80px_120px_90px_50px] gap-2 px-5 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/50">
              <span>Address</span>
              <span>City</span>
              <span className="text-right">Price</span>
              <span className="text-center">Status</span>
              <span className="text-right">Days</span>
            </div>
            {tableRows.map((r) => (
              <div
                key={r.address}
                className="grid grid-cols-[1fr_80px_120px_90px_50px] gap-2 px-5 py-2.5 text-sm border-b border-zinc-800/30 last:border-0"
              >
                <span className="text-white truncate">{r.address}</span>
                <span className="text-zinc-400">{r.city}</span>
                <span className="text-white text-right font-medium">{r.price}</span>
                <span className="text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[r.status]}`}>
                    {r.status}
                  </span>
                </span>
                <span className="text-zinc-400 text-right">{r.days}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Property Cards Row */}
        <div className="mt-10 mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {propertyCards.map((p) => (
            <div key={p.address} className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              {/* Photo placeholder */}
              <div className="aspect-[4/3] bg-gradient-to-br from-zinc-200 to-zinc-300" />
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-zinc-900">{p.price}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusColor[p.status] || "bg-zinc-200 text-zinc-600"}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate mb-1">{p.address}</p>
                <p className="text-[10px] text-zinc-400">
                  {p.beds}bd · {p.baths}ba · {p.sqft} sqft
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
