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
        {/* Hero */}
        <section className="relative flex items-center overflow-visible">
          {/* Background globe layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-[52%] -translate-x-[42%] -translate-y-1/2">
              <NetworkGlobe />
            </div>

            {/* subtle radial wash to separate globe from background */}
            <div className="absolute inset-0"
                 style={{
                   background:
                     "radial-gradient(circle at 62% 46%, rgba(14,86,245,0.10) 0%, rgba(250,250,250,0) 60%)"
                 }}
            />
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

              {/* CTAs - Royal Blue for early access */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-[#0E56F5] hover:bg-[#0D4AD9] text-white px-6 py-3 text-base font-medium rounded-xl shadow-sm"
                >
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
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

        {/* From the AAC Facebook group — evolved */}
        <section className="w-full px-6 sm:px-10 lg:px-20 py-16 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 mb-3">
              From the AAC Facebook group — evolved
            </h2>
            <p className="text-lg text-zinc-600 mb-10">
              If you've ever closed a deal through the AAC Facebook group, you already understand this.
            </p>

            <div className="flex flex-col gap-3 text-base sm:text-lg text-zinc-700 font-medium">
              <p>Same agents</p>
              <p>Same off-market and coming-soon inventory</p>
              <p>Same direct conversations</p>
              <p className="text-zinc-900 mt-2">Less noise, more control, better outcomes</p>
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
