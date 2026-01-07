import { ArrowRight, Share2, Users, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import NetworkGlobe from "@/components/home/NetworkGlobe";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header - logo only, no nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-zinc-100">
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

      <main className="pt-14 pb-12">
        {/* Hero */}
        <section className="relative flex items-center overflow-visible">
          {/* Background globe layer */}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            <div className="absolute right-0 lg:right-6 top-[-60px]">
              <NetworkGlobe />
            </div>
          </div>
          
          {/* Foreground content */}
          <div 
            className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12"
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
          </div>
          <style>{`
            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </section>

        {/* What You Can Do - 3 Feature Cards */}
        <section className="w-full px-6 sm:px-10 lg:px-20 py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-semibold text-zinc-900 mb-4 text-center">
              What You Can Do
            </h2>
            <p className="text-zinc-500 text-center mb-12 max-w-xl mx-auto">
              A private network built for how agents actually work together.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="group bg-white rounded-2xl p-6 border border-zinc-100 hover:border-zinc-200 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
                <div className="flex justify-end mb-6">
                  <Share2 className="h-6 w-6 text-[#0E56F5]" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Share Off-Market Listings
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Post coming-soon and pocket listings to a verified agent network before they hit the MLS.
                </p>
              </div>

              {/* Card 2 */}
              <div className="group bg-white rounded-2xl p-6 border border-zinc-100 hover:border-zinc-200 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
                <div className="flex justify-end mb-6">
                  <Users className="h-6 w-6 text-[#0E56F5]" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Post Buyer Needs
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Broadcast what your buyers are looking for and get matched with listing agents who have it.
                </p>
              </div>

              {/* Card 3 */}
              <div className="group bg-white rounded-2xl p-6 border border-zinc-100 hover:border-zinc-200 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
                <div className="flex justify-end mb-6">
                  <Shield className="h-6 w-6 text-[#0E56F5]" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Collaborate Privately
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Work with verified agents in a professional, members-only environment.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
