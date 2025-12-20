import { useNavigate } from "react-router-dom";
import { Building2, Home, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ChooseRole = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-foreground mb-3">
            Welcome to AllAgentConnect
          </h1>
          <p className="text-muted-foreground">
            Choose how you'd like to get started
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Agent Card */}
          <button
            onClick={() => navigate("/auth?role=agent")}
            className="group bg-card border border-border rounded-2xl p-8 text-left transition-all hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-colors">
              <Building2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              I'm an Agent
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Off-market network + verified access
            </p>
          </button>

          {/* Consumer Card */}
          <button
            onClick={() => navigate("/consumer/auth")}
            className="group bg-card border border-border rounded-2xl p-8 text-left transition-all hover:border-slate-400 hover:shadow-lg hover:shadow-slate-400/10 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            <div className="w-14 h-14 bg-slate-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-slate-500/20 transition-colors">
              <Home className="h-7 w-7 text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              I'm a Buyer / Consumer
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Search homes + connect directly
            </p>
          </button>
        </div>

        {/* Not Sure Dialog */}
        <div className="mt-8 text-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4 mr-1.5" />
                Not sure which to choose?
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Agent vs. Consumer</DialogTitle>
                <DialogDescription className="pt-4 space-y-4 text-left">
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Choose Agent if:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• You are a licensed real estate agent</li>
                      <li>• You want access to the off-market network</li>
                      <li>• You represent buyers or sellers professionally</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Choose Consumer if:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• You're looking to buy or rent a home</li>
                      <li>• You want to browse listings and save favorites</li>
                      <li>• You want to connect with agents directly</li>
                    </ul>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>

        {/* Already have an account */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button
              variant="link"
              className="p-0 h-auto text-emerald-600 hover:text-emerald-700"
              onClick={() => navigate("/auth?role=agent")}
            >
              Sign in as Agent
            </Button>
            {" or "}
            <Button
              variant="link"
              className="p-0 h-auto text-slate-600 hover:text-slate-700"
              onClick={() => navigate("/consumer/auth")}
            >
              Sign in as Consumer
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChooseRole;
