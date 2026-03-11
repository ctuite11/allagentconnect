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
          {/* Left: visual composition */}
          <div className="relative flex justify-center">
            <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]">
              {/* Earth / globe visual */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border border-zinc-700/50 shadow-2xl overflow-hidden">
                {/* Grid lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 200">
                  <ellipse cx="100" cy="100" rx="90" ry="90" fill="none" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <ellipse cx="100" cy="100" rx="60" ry="90" fill="none" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <ellipse cx="100" cy="100" rx="30" ry="90" fill="none" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <line x1="10" y1="100" x2="190" y2="100" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <line x1="100" y1="10" x2="100" y2="190" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <ellipse cx="100" cy="100" rx="90" ry="30" fill="none" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                  <ellipse cx="100" cy="100" rx="90" ry="60" fill="none" stroke="currentColor" className="text-accent" strokeWidth="0.5" />
                </svg>
                {/* Glow center */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
              </div>

              {/* Floating node dots */}
              {[
                { top: "10%", left: "50%", size: "w-3 h-3" },
                { top: "25%", left: "85%", size: "w-2.5 h-2.5" },
                { top: "70%", left: "90%", size: "w-2 h-2" },
                { top: "85%", left: "45%", size: "w-3 h-3" },
                { top: "65%", left: "10%", size: "w-2.5 h-2.5" },
                { top: "20%", left: "15%", size: "w-2 h-2" },
              ].map((dot, i) => (
                <div
                  key={i}
                  className={`absolute ${dot.size} rounded-full bg-accent shadow-[0_0_8px_rgba(5,150,105,0.5)]`}
                  style={{ top: dot.top, left: dot.left }}
                />
              ))}
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
