import React from "react";
import { Shield, Users, Eye, Handshake, Network } from "lucide-react";

const pillars = [
  { icon: Shield, label: "Private Agent Network" },
  { icon: Users, label: "Verified Collaboration" },
  { icon: Eye, label: "Off-Market Intelligence" },
  { icon: Handshake, label: "Buyer Matching" },
  { icon: Network, label: "Direct Agent Connections" },
];

const TrustStrip = () => {
  return (
    <section className="py-10 bg-zinc-50 border-y border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="flex flex-wrap justify-center gap-8 lg:gap-14">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex items-center gap-2.5 text-muted-foreground">
                <Icon className="w-4.5 h-4.5 text-accent" strokeWidth={1.8} />
                <span className="text-sm font-medium">{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
