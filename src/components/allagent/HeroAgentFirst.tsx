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
    <section className="relative min-h-[85vh] flex items-center justify-center bg-white overflow-hidden">
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(209 213 219) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10 py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge strip */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {badges.map((badge, index) => (
              <span
                key={index}
                className="px-4 py-2 text-xs font-medium tracking-wide uppercase text-muted-foreground border border-border rounded-full bg-white shadow-sm"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground mb-8 leading-[1.1]">
            More Agents.
            <br />
            More Listings.
            <br />
            <span className="text-primary">More Deals.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed">
            The agent-first collaboration network where real connections create real deal flow.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-neutral-900 text-white hover:bg-neutral-800 font-medium px-8 py-6 text-base rounded-full shadow-sm"
            >
              Join the Network
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/submit-client-need")}
              className="border-border text-foreground hover:bg-muted font-medium px-8 py-6 text-base rounded-full"
            >
              Post a Buyer Need
              <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroAgentFirst;
