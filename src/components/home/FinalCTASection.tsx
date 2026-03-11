import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const trustBadges = [
  "Private Agent Network",
  "Direct Agent Collaboration",
  "Off-Market Intelligence",
  "Built for Scale",
];

export default function FinalCTASection() {
  const navigate = useNavigate();

  return (
    <section className="py-24 md:py-32 bg-zinc-900 border-t border-zinc-800">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
          See the Market Before
          <br />
          it Happens.
        </h2>
        <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
          Join the private agent network where off-market listings, buyer demand, and agent collaboration drive real results.
        </p>
        <button
          onClick={() => navigate("/auth?mode=register&source=home")}
          className="rounded-full bg-emerald-600 px-10 py-4 text-lg font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          Request Access
          <ArrowRight className="inline-block ml-2 h-5 w-5" />
        </button>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {trustBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-1.5 text-xs font-medium text-zinc-400"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
