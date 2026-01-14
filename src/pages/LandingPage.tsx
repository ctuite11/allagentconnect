import { ArrowRight, Share2, Users, Megaphone, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import HeroDNA from "@/components/visuals/HeroDNA";

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
    <div className="relative h-full rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
      <span
        className={`absolute top-4 right-4 text-xs font-medium tracking-wide px-2.5 py-1 rounded-full border ${
          tier === "hub"
            ? "bg-zinc-100 text-zinc-700 border-zinc-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        {tier === "hub" ? "Success Hub" : "AAC Premium"}
      </span>
      <Icon className="h-6 w-6 text-[#0E56F5] mb-4" />
      <div className="text-base font-semibold tracking-tight text-zinc-900">{title}</div>
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
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3 -ml-1">
              <Logo size="lg" />
            </div>
            <a href="/auth" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
              Log in
            </a>
          </div>
        </div>
      </header>

      <main className="pb-12">
        {/* Hero - 2-col grid with DNA on right */}
        <section className="relative overflow-visible">
          <div 
            className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-10 md:pt-14 lg:pt-16 pb-12"
            style={{ animation: 'fadeUp 0.55s ease-out both' }}
          >
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: headline/CTA */}
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

                {/* Identity */}
                <p className="text-base font-medium text-zinc-700 mb-6">
                  By agents. For agents. All agents.
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

                {/* CTA */}
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-[#0E56F5] hover:bg-[#0D4AD9] text-white px-6 py-3 text-base font-medium rounded-xl shadow-sm"
                >
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Right: DNA helix */}
              <div className="relative overflow-visible pointer-events-none h-[380px] sm:h-[440px] lg:h-[620px]">
                <HeroDNA opacity={0.22} size="lg" className="w-full h-full" />
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
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 mb-2 text-center">
              Success Hub — How AAC Gets Used
            </h2>
            <p className="text-center text-lg text-zinc-600 mb-2">
              Core workflows inside AAC, used daily by working agents across sales and rentals.
            </p>
            <p className="text-center text-sm text-zinc-500 mb-10">
              Supports residential sales, rentals, and agent-only opportunities across markets.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
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
      </main>
    </div>
  );
};

export default LandingPage;
