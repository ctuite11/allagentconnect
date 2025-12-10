import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Users, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-gradient-to-br from-slate-950 via-primary/20 to-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl" />
      </div>
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-6">
            <Zap className="w-4 h-4 text-primary" />
            Ready to grow?
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Turn Connections Into{" "}
            <span className="bg-gradient-to-r from-primary via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Closings
            </span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
            Join thousands of agents who are already using AllAgentConnect to close more deals, faster.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-primary/25"
              onClick={() => navigate("/auth")}
            >
              <Users className="mr-2 w-5 h-5" />
              Join AllAgentConnect
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg"
              onClick={() => navigate("/submit-client-need")}
            >
              <MessageSquare className="mr-2 w-5 h-5" />
              Create a Buyer Need
            </Button>
          </div>

          {/* Secondary CTA */}
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/5"
            onClick={() => navigate("/agent-dashboard")}
          >
            Start Collaborating
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>

          {/* Trust badges */}
          <div className="mt-16 flex flex-wrap justify-center gap-6">
            {[
              "Agent First. Always.",
              "Your Listing. Your Lead.",
              "Patent Protected",
            ].map((badge, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-white/50 text-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
