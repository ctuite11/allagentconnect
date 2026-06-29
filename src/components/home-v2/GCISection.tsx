import React from "react";
import { Link } from "react-router-dom";
import { Zap, Target, Lock, Users, TrendingUp, ShieldCheck } from "lucide-react";

const props = [
  { icon: Zap, title: "Speed to Market", desc: "Share and discover listings hours or days before they go public." },
  { icon: Target, title: "Precision Matching", desc: "AI-powered buyer-listing matching across the verified network." },
  { icon: Lock, title: "Deal Privacy", desc: "Control who sees your inventory — keep sensitive deals confidential." },
  { icon: Users, title: "Agent Network", desc: "Collaborate with verified agents across markets and brokerages." },
  { icon: TrendingUp, title: "GCI Growth", desc: "More deals, faster closings, and stronger commission outcomes." },
  { icon: ShieldCheck, title: "Compliance", desc: "Built-in compliance rails for NAR Clear Cooperation and state rules." },
];

const GCISection = () => {
  return (
    <section className="py-24 lg:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: text block */}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
              GCI driven by better information
              <br className="hidden sm:block" />
              and faster connections
            </h2>
            <p className="mt-5 text-lg text-zinc-400 max-w-lg">
              Members who operate on network intelligence consistently outperform agents relying on public feeds alone.
            </p>
            <div className="mt-10">
              <Link
                to="/auth?mode=register&source=gci_v2"
                className="bg-accent hover:bg-accent-hover text-accent-foreground font-semibold px-10 py-3.5 rounded-lg text-base transition-colors inline-block"
              >
                Get Access
              </Link>
            </div>
          </div>

          {/* Right: 2x3 value props grid */}
          <div className="grid sm:grid-cols-2 gap-5">
            {props.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-accent/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-accent" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{p.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GCISection;
