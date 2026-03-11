import React from "react";
import { Shield, Repeat, Globe, Layers, Lock, Zap } from "lucide-react";

const callouts = [
  { icon: Shield, label: "Verified Agents", desc: "Every participant is license-verified" },
  { icon: Repeat, label: "Persistent Relationships", desc: "Connections strengthen over time" },
  { icon: Globe, label: "Multi-Market Reach", desc: "Expand across regions seamlessly" },
  { icon: Layers, label: "Scalable Architecture", desc: "Built for thousands of agents" },
  { icon: Lock, label: "Deal Privacy", desc: "Off-market stays off-market" },
  { icon: Zap, label: "Real-Time Signals", desc: "Instant alerts on matching inventory" },
];

const ScaleSection = () => {
  return (
    <section id="about" className="py-24 lg:py-32 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: globe image with overlay cards */}
          <div className="relative flex justify-center">
            <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]">
              <div className="absolute inset-0 rounded-full overflow-hidden shadow-2xl">
                <img
                  src="/brand/aac-globe.png"
                  alt="Global agent network"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Floating overlay cards */}
              <div className="absolute -top-4 -right-8 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-lg">
                <p className="text-xs text-zinc-400">Active Agents</p>
                <p className="text-lg font-bold text-accent">2,847</p>
              </div>
              <div className="absolute -bottom-4 -left-8 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-lg">
                <p className="text-xs text-zinc-400">Markets Covered</p>
                <p className="text-lg font-bold text-accent">6 States</p>
              </div>
              <div className="absolute top-1/2 -right-12 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-lg hidden sm:block">
                <p className="text-xs text-zinc-400">Network Matches</p>
                <p className="text-lg font-bold text-accent">1,203</p>
              </div>
            </div>
          </div>

          {/* Right: text + callouts */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
              Deliberately designed for scale and persistence
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Built to support agent relationships, trusted collaboration, and long-term network value at every level.
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-5">
              {callouts.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-accent" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScaleSection;
