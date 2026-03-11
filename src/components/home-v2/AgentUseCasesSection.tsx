import React from "react";
import { ArrowUpRight } from "lucide-react";

const useCases = [
  {
    title: "Pre-MLS Listing Distribution",
    description: "Share exclusive listings with verified agents before they hit the public market. Build anticipation and secure stronger offers.",
    stat: "48 hrs",
    statLabel: "avg. pre-market advantage",
    initials: "PL",
  },
  {
    title: "Buyer-Agent Matching",
    description: "Instantly connect qualified buyers with listing agents based on property criteria, price range, and geographic preferences.",
    stat: "3.2x",
    statLabel: "faster buyer connections",
    initials: "BM",
  },
  {
    title: "Off-Market Deal Flow",
    description: "Access private inventory that never appears on public portals. Close deals discreetly with verified network participants.",
    stat: "67%",
    statLabel: "of deals start off-market",
    initials: "OM",
  },
];

const AgentUseCasesSection = () => {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-zinc-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-center leading-tight tracking-tight">
          How agents are using
          <br className="hidden sm:block" />
          All Agent Connect
        </h2>
        <p className="mt-5 text-lg text-muted-foreground text-center max-w-xl mx-auto">
          Real results from active network members.
        </p>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {useCases.map((uc) => (
            <div
              key={uc.title}
              className="group relative bg-background rounded-2xl border border-border p-8 hover:border-accent/30 transition-all hover:shadow-lg"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm mb-6">
                {uc.initials}
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">{uc.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">{uc.description}</p>

              {/* Stat callout */}
              <div className="mt-auto pt-6 border-t border-border">
                <p className="text-2xl font-bold text-accent">{uc.stat}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{uc.statLabel}</p>
              </div>

              <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground/40 group-hover:text-accent transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentUseCasesSection;
