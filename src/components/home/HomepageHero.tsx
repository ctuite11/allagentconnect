import { useNavigate } from "react-router-dom";
import heroAgent from "@/assets/hero-agent.jpg";
import { Users } from "lucide-react";
import CredibilityTicker from "./CredibilityTicker";

export default function HomepageHero() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-zinc-950 pt-32 pb-10 md:pt-40 md:pb-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400 mb-4">
              Private Agent Network
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-white mb-6">
              See the market before it hits the{" "}
              <span className="text-emerald-400">MLS.</span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-lg">
              The private network where agents share off-market listings, buyer demand, and deal intelligence before properties go public.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate("/auth?mode=register&source=home")}
                className="rounded-full bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Request Access
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("platform-intelligence");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-full border border-zinc-700 px-8 py-3.5 text-base font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right: Hero image */}
          <div className="relative hidden lg:block">
            <img
              src={heroAgent}
              alt="Real estate agent working on laptop"
              className="aspect-[4/5] rounded-3xl object-cover w-full"
            />
            {/* Floating stats card */}
            <div className="absolute -left-8 bottom-16 rounded-2xl bg-zinc-900/90 backdrop-blur border border-zinc-700/50 px-5 py-4">
              <p className="text-xs text-zinc-500 mb-1">Network Matches</p>
              <p className="text-2xl font-bold text-emerald-400">2,847</p>
              <p className="text-xs text-zinc-500 mt-1">Active this month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Credibility strip + ticker */}
      <CredibilityTicker />
    </section>
  );
}
