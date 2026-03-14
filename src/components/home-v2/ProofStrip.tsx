import React from "react";
import { Shield, UserCheck, MessageCircle, TrendingUp } from "lucide-react";

const proofs = [
  {
    icon: Shield,
    label: "Private by design",
    description: "Off-market opportunities and agent collaboration inside a trusted network.",
  },
  {
    icon: UserCheck,
    label: "Verified agents only",
    description: "Built for licensed professionals, not public lead routing.",
  },
  {
    icon: MessageCircle,
    label: "Direct connections",
    description: "Message, share, and match directly with other agents.",
  },
  {
    icon: TrendingUp,
    label: "Built for deal flow",
    description: "Help buyers, market listings early, and move deals forward faster.",
  },
];

const ProofStrip = () => (
  <section className="bg-white border-t border-zinc-200/70 py-16 lg:py-20">
    <div className="max-w-[1210px] mx-auto px-6 lg:px-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
        {proofs.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.label} className="flex flex-col gap-3">
              <Icon className="w-5 h-5 text-[#0E56F5]" strokeWidth={1.8} />
              <h3 className="font-['Manrope'] font-semibold text-[#0f172a] text-base leading-snug">
                {p.label}
              </h3>
              <p className="font-['Manrope'] font-normal text-[#64748b] text-sm leading-relaxed">
                {p.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default ProofStrip;
