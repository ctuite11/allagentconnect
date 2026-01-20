import { ArrowRight, Share2, Users, Megaphone, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import NetworkGlobe from "@/components/home/NetworkGlobe";
import VersionStamp from "@/components/VersionStamp";

function ModuleCard({
  icon: Icon,
  title,
  body,
  tier,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tier: "hub" | "premium";
}) {
  return (
    <div className="relative h-full rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-colors duration-200">
      <span
        className={`absolute top-4 right-4 text-xs font-medium tracking-normal px-2.5 py-1 rounded-full border ${
          tier === "hub"
            ? "bg-zinc-100 text-zinc-700 border-zinc-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        {tier === "hub" ? "Success Hub" : "AAC Premium"}
      </span>
      <Icon className="h-6 w-6 text-[#0E56F5] mb-4" />
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
    </div>
  );
}

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header - NOT sticky, part of page flow */}
      <header className="relative bg-transparent">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between pt-4">
            <div className="flex items-center gap-3 -ml-1">
              <Logo size="3xl" />
            </div>
            <a href="/auth" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Log in
            </a>
          </div>
        </div>
      </header>

      <main className="pb-12">
        {/* Hero */}
        <section className="relative flex items-center overflow-visible">
          {/* Background globe layer */}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            <div className="absolute right-[-60px] top-[-92px] md:top-[-110px] lg:top-[-128px] lg:right-[-40px] xl:right-[-20px] 2xl:right-0">
              <NetworkGlobe />
            </div>
          </div>
          
          {/* Foreground content */}
          <div 
            className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-10 md:pt-14 lg:pt-16 pb-12"
            style={{ animation: 'fadeUp 0.55s ease-out both' }}
          >
            <div className="relative z-10 max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0E56F5]" />
                <span className="text-xs font-medium tracking-wide text-zinc-600 uppercase">
                  AAC Private Network
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-zinc-900 leading-[1.08] mb-5">
                Where Real Deals<br />Get Done
              </h1>

              {/* Tension line */}
              <p className="text-lg text-zinc-500 max-w-md mb-4 leading-relaxed">
                The deals you don't see are the ones that can change a client's life — and your bottom line.
              </p>


              {/* Capability pills */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['Off-market', 'Coming soon', 'Agent-to-agent'].map((pill) => (
                  <span
                    key={pill}
                    className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-full"
                  >
                    {pill}
                  </span>
                ))}
              </div>

              {/* CTAs - Royal Blue for early access */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center justify-center gap-3 h-12 px-6 rounded-xl bg-zinc-900 text-white text-[15px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:bg-zinc-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(24,24,27,0.18)] transition-colors"
                >
                  Request Early Access
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
                    <ArrowRight className="h-4 w-4 text-white/80" />
                  </span>
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </section>

        {/* Success Hub — How AAC Gets Used */}
        <section className="w-full px-6 sm:px-10 lg:px-20 py-12 md:py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center text-[22px] md:text-[24px] font-semibold tracking-tight leading-tight">
              <span className="text-[#0E56F5]">By Agents</span>
              <span className="text-zinc-300 mx-2">·</span>
              <span className="text-[#0E56F5]">For Agents</span>
              <span className="text-zinc-300 mx-2">·</span>
              <span className="text-zinc-400">All Agents</span>
            </h2>
            <p className="mt-3 text-lg md:text-xl font-medium text-zinc-600 text-center">
              Built on what already works
            </p>

            <div className="mt-10 grid md:grid-cols-2 gap-6">
              <ModuleCard
                icon={Share2}
                tier="hub"
                title="Listings Exchange"
                body="Quietly share off-market sales and rental listings with verified agents — with full control over visibility and timing."
              />
              <ModuleCard
                icon={Megaphone}
                tier="hub"
                title="Buyer & Renter Needs"
                body="Post active buyer and renter demand privately, so opportunities surface without public exposure."
              />
              <ModuleCard
                icon={Users}
                tier="premium"
                title="Private Matching"
                body="Match listings, buyers, and renters before they hit the open market — or without going public at all."
              />
              <ModuleCard
                icon={MessageCircle}
                tier="premium"
                title="Agent-to-Agent Workspace"
                body="Direct, verified agent collaboration — sales and rentals — without feeds, noise, or outside interference."
              />
            </div>
          </div>
        </section>

        {/* Footer fine print */}
        <footer className="mt-12 text-center pb-6">
          <div className="text-xs text-neutral-500">© {new Date().getFullYear()} AAC Member Network</div>
          <VersionStamp className="mt-1" />
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
