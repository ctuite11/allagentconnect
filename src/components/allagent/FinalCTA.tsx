import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-32 bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Turn Connections Into Closings
          </h2>

          {/* Subtext */}
          <p className="text-lg text-slate-400 mb-12 max-w-xl mx-auto">
            Join the professional agent network where collaboration creates deal flow.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-slate-950 hover:bg-slate-100 font-semibold px-8 py-6 text-base rounded-sm"
            >
              Join AllAgentConnect
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/submit-client-need")}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium px-8 py-6 text-base rounded-sm bg-transparent"
            >
              Create a Buyer Need
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate("/agent-dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800 font-medium px-8 py-6 text-base rounded-sm"
            >
              Start Collaborating
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
