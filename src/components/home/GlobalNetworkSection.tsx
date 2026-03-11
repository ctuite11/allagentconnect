import { useNavigate } from "react-router-dom";
import { Zap, Target, Lock, Users, TrendingUp, Shield } from "lucide-react";
import NetworkGlobe from "./NetworkGlobe";

const valueProps = [
  { icon: Zap, label: "Private Agent Network", desc: "Verified agents only" },
  { icon: Target, label: "Faster Deal Discovery", desc: "See deals before the MLS" },
  { icon: Lock, label: "Direct Communication", desc: "Agent-to-agent messaging" },
  { icon: Users, label: "Better Referral Flow", desc: "Network-powered referrals" },
  { icon: TrendingUp, label: "Buyer Demand Visibility", desc: "Real-time buyer signals" },
  { icon: Shield, label: "Market Intelligence", desc: "Before public exposure" },
];

export default function GlobalNetworkSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 bg-zinc-950 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16 relative">
          {/* Globe background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <div className="w-[300px] h-[300px]">
              <NetworkGlobe variant="ambient" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 relative">
            GCI driven by better information
            <br className="hidden md:block" />
            and faster connections
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto relative">
            Members who operate on network intelligence consistently outperform agents relying on public feeds alone.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
          {valueProps.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3">
                <Icon className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-zinc-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate("/auth?mode=register&source=home")}
            className="rounded-full bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            Request Access
          </button>
        </div>
      </div>
    </section>
  );
}
