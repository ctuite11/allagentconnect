import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import HomepageHero from "@/components/home/HomepageHero";
import PlatformIntelligenceSection from "@/components/home/PlatformIntelligenceSection";
import NetworkResultsSection from "@/components/home/NetworkResultsSection";
import AgentTestimonialsSection from "@/components/home/AgentTestimonialsSection";
import ScalePersistenceSection from "@/components/home/ScalePersistenceSection";
import GlobalNetworkSection from "@/components/home/GlobalNetworkSection";
import FinalCTASection from "@/components/home/FinalCTASection";
import HomepageFooter from "@/components/home/HomepageFooter";

export default function Homepage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Redirect authenticated users to /home
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data?.session) {
          navigate("/home", { replace: true });
          return;
        }
      } catch {
        // ignore
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="absolute left-0 right-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-white">All Agent</span>{" "}
            <span className="text-zinc-500">Connect</span>
          </span>

          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#platform-intelligence" className="hover:text-white transition-colors">Features</a>
            <a href="/our-agents" className="hover:text-white transition-colors">Agents</a>
            <a href="/browse" className="hover:text-white transition-colors">Marketplace</a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/auth?mode=register&source=home")}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Request Access
            </button>
          </div>
        </div>
      </header>

      <main>
        <HomepageHero />
        <PlatformIntelligenceSection />
        <NetworkResultsSection />
        <AgentTestimonialsSection />
        <ScalePersistenceSection />
        <GlobalNetworkSection />
        <FinalCTASection />
      </main>

      <HomepageFooter />
    </div>
  );
}
