import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onGetStarted: () => void;
  onSkip: () => void;
}

export const WelcomeModal = ({ open, onGetStarted, onSkip }: WelcomeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-white border-neutral-200 shadow-xl p-8"
        hideCloseButton
      >
        <div className="text-center space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-neutral-800 tracking-tight">
              Welcome to AllAgentConnect
            </h1>
            <p className="text-muted-foreground">
              Set up once. Start seeing deal flow immediately.
            </p>
          </div>

          {/* Bullets */}
          <div className="space-y-3 text-left py-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center mt-0.5">
                <Check className="w-3 h-3 text-neutral-500" />
              </div>
              <span className="text-sm text-neutral-700">Complete your agent profile</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center mt-0.5">
                <Check className="w-3 h-3 text-neutral-500" />
              </div>
              <span className="text-sm text-neutral-700">Choose the markets and property types you want</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center mt-0.5">
                <Check className="w-3 h-3 text-neutral-500" />
              </div>
              <span className="text-sm text-neutral-700">Decide how often you're notified</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-2">
            <Button 
              onClick={onGetStarted}
              className="w-full"
              size="lg"
            >
              Get Started
            </Button>
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-neutral-700 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
