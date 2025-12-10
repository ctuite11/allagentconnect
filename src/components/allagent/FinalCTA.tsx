import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
            Turn Connections Into Closings
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Join thousands of agents who are already growing their business through AllAgentConnect.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-slate-900 hover:bg-slate-100 font-medium px-8 py-6 text-base rounded-full"
            >
              Join AllAgentConnect
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/submit-client-need")}
              className="border-slate-700 text-white hover:bg-slate-800 font-medium px-8 py-6 text-base rounded-full bg-transparent"
            >
              Create a Buyer Need
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
