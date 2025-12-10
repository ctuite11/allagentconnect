import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight } from "lucide-react";

const HeroAgentFirst = () => {
  const navigate = useNavigate();

  const badges = [
    "Agent First. Always.",
    "Your Listing. Your Lead.",
    "Built by Agents. For Agents.",
    "Patent Protected",
  ];

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Gradient accent - subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/8 rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge strip */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {badges.map((badge, index) => (
              <span
                key={index}
                className="px-4 py-1.5 text-xs font-medium tracking-wide uppercase text-slate-400 border border-slate-700/50 rounded-sm bg-slate-900/50"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6 leading-[0.95]">
            More Agents.
            <br />
            More Listings.
            <br />
            <span className="text-blue-500">More Deals.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            The agent-first collaboration network where real connections create real deal flow.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-slate-950 hover:bg-slate-100 font-semibold px-8 py-6 text-base rounded-sm"
            >
              Join the Network
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/submit-client-need")}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium px-8 py-6 text-base rounded-sm bg-transparent"
            >
              Post a Buyer Need
              <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent" />
    </section>
  );
};

export default HeroAgentFirst;
