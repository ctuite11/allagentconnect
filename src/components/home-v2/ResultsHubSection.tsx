import React from "react";
import { Globe, Users, TrendingUp, Building2, Handshake, BarChart3 } from "lucide-react";

const nodes = [
  { icon: Users, label: "Buyer Matching", position: "top-0 left-1/2 -translate-x-1/2 -translate-y-6" },
  { icon: Building2, label: "Off-Market Listings", position: "top-1/4 right-0 translate-x-4" },
  { icon: TrendingUp, label: "Market Intelligence", position: "bottom-1/4 right-0 translate-x-4" },
  { icon: BarChart3, label: "Deal Analytics", position: "bottom-0 left-1/2 -translate-x-1/2 translate-y-6" },
  { icon: Handshake, label: "Agent Collaboration", position: "bottom-1/4 left-0 -translate-x-4" },
  { icon: Globe, label: "Network Reach", position: "top-1/4 left-0 -translate-x-4" },
];

const ResultsHubSection = () => {
  return (
    <section id="results" className="py-24 lg:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-center leading-tight tracking-tight">
          Turning network intelligence
          <br className="hidden sm:block" />
          into real results.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          Every connection, listing, and match flows through the AAC network — turning data into deals.
        </p>

        {/* Hub-and-spoke composition */}
        <div className="mt-20 flex justify-center">
          <div className="relative w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] lg:w-[540px] lg:h-[540px]">
            {/* Concentric rings */}
            <div className="absolute inset-8 sm:inset-12 lg:inset-16 rounded-full border border-accent/10" />
            <div className="absolute inset-16 sm:inset-24 lg:inset-28 rounded-full border border-accent/15" />

            {/* Center globe */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full bg-zinc-950 border-2 border-accent/30 flex items-center justify-center shadow-[0_0_40px_rgba(5,150,105,0.15)]">
                <Globe className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-accent" strokeWidth={1.2} />
              </div>
            </div>

            {/* Orbital nodes */}
            {nodes.map((node, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = 46; // % from center
              const left = 50 + radius * Math.cos(angle);
              const top = 50 + radius * Math.sin(angle);
              const Icon = node.icon;

              return (
                <div
                  key={node.label}
                  className="absolute flex flex-col items-center gap-2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-background border border-border shadow-md flex items-center justify-center hover:border-accent/40 transition-colors">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {node.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResultsHubSection;
