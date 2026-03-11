import React from "react";

const stats = [
  { label: "Active Listings", value: "2,847" },
  { label: "Network Matches", value: "1,203" },
  { label: "Agents Online", value: "489" },
  { label: "Pre-MLS Alerts", value: "156" },
];

const agentCards = [
  { name: "Sarah M.", role: "Listing Agent", location: "Boston, MA" },
  { name: "David R.", role: "Buyer Agent", location: "Cambridge, MA" },
  { name: "Jennifer L.", role: "Listing Agent", location: "Brookline, MA" },
  { name: "Michael K.", role: "Buyer Agent", location: "Newton, MA" },
];

const NetworkIntelSection = () => {
  return (
    <section id="network" className="py-24 lg:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        {/* Pill */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium tracking-wide uppercase">
            Network Intelligence
          </span>
        </div>

        {/* Headlines */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-center leading-tight tracking-tight">
          Operate on network intelligence,
          <br className="hidden sm:block" />
          not the public feed.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          See what's happening across the agent network before it reaches portals, feeds, or the MLS.
        </p>

        {/* Dashboard mockup */}
        <div className="mt-16 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3 bg-zinc-900 border-b border-zinc-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
            </div>
            <div className="ml-4 flex-1 max-w-sm">
              <div className="h-6 rounded-md bg-zinc-800 px-3 flex items-center">
                <span className="text-[11px] text-zinc-500">app.allagentconnect.com/dashboard</span>
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-6 lg:p-8">
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Chart mockup */}
            <div className="bg-zinc-900/40 rounded-xl p-5 border border-zinc-800/40">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-400 font-medium">Network Activity — Last 7 Days</span>
                <span className="text-xs text-accent font-medium">Live</span>
              </div>
              <div className="flex items-end gap-2 h-32">
                {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                  <div key={i} className="flex-1 bg-accent/20 rounded-t" style={{ height: `${h}%` }}>
                    <div className="w-full rounded-t bg-accent/60" style={{ height: `${Math.min(h + 10, 100) * 0.6}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agent cards row */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {agentCards.map((agent) => (
            <div key={agent.name} className="flex items-center gap-3 p-4 rounded-xl bg-background border border-border hover:border-accent/30 transition-colors">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
                {agent.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.role} · {agent.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NetworkIntelSection;
