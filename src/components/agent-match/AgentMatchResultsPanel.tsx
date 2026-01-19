import { useState } from "react";
import { Users, CheckCircle2, Lock, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AgentMatchResultsPanelProps {
  matchCount: number;
  submissionId: string | null;
  propertyData: {
    address: string;
    city: string;
    state: string;
    asking_price: string;
    buyer_agent_commission: string;
  };
  isAuthenticated: boolean;
  isProcessing: boolean;
  onTriggerAuth: () => void;
}

const AgentMatchResultsPanel = ({
  matchCount,
  submissionId,
  propertyData,
  isAuthenticated,
  isProcessing,
  onTriggerAuth,
}: AgentMatchResultsPanelProps) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [messageToAgents, setMessageToAgents] = useState(
    "I'm interested in connecting with buyer agents who have clients looking for a home like mine."
  );

  const handleProceedToPayment = async () => {
    if (!acceptedTerms) {
      toast.error("Please accept the terms to continue");
      return;
    }

    if (!isAuthenticated) {
      onTriggerAuth();
      return;
    }

    // Placeholder: In production, this would integrate with Stripe
    toast.info("Payment integration coming soon! Your submission has been saved.");
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Post-payment success state
  if (submissionId && isAuthenticated) {
    return (
      <div className="space-y-6">
        {/* Success Hero */}
        <div className="text-center py-8 px-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">
            Your listing is now active in the AAC private network
          </h1>
          
          <p className="text-zinc-600 max-w-lg mx-auto">
            Your home has been securely matched against active buyer needs from AAC Verified agents.
          </p>
        </div>

        {/* Property Summary */}
        <div className="p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm font-medium text-zinc-900">
            {propertyData.address}, {propertyData.city}, {propertyData.state}
          </p>
          <p className="text-sm text-zinc-600 mt-1">
            {formatPrice(propertyData.asking_price)} • {propertyData.buyer_agent_commission} buyer agent commission
          </p>
        </div>

        {/* Active Status */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#0E56F5] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-zinc-900">Active for 30 days</p>
              <p className="text-sm text-zinc-600 mt-1">
                Your listing will remain active for 30 days and will continue to be presented automatically as new matching buyer needs are added — no additional action required.
              </p>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">What happens next</h2>
          <div className="space-y-2 p-4 bg-zinc-50 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-700">Your property is not publicly listed</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-700">Details are shared only with verified agents whose clients match your home</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-700">You'll be notified if an agent requests to connect</p>
            </div>
          </div>
        </div>

        {/* Renewal note */}
        <p className="text-xs text-zinc-500 text-center">
          You can renew or update your listing at any time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Count Hero */}
      <div className="text-center py-8 px-4 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0E56F5]/10 mb-4">
          <Users className="h-8 w-8 text-[#0E56F5]" />
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-2">
          {matchCount === 0 ? (
            "No matches yet"
          ) : (
            <>
              <span className="text-[#0E56F5]">{matchCount}</span> AAC Verified Agent{matchCount !== 1 ? "s" : ""}
            </>
          )}
        </h1>
        
        <p className="text-zinc-600 max-w-md mx-auto">
          {matchCount === 0
            ? "We don't currently have agents with matching buyer criteria, but we'll notify you when we do."
            : "currently working with qualified buyers looking for this type of home in this location."}
        </p>
      </div>

      {/* Property Summary */}
      <div className="p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-900">
          {propertyData.address}, {propertyData.city}, {propertyData.state}
        </p>
        <p className="text-sm text-zinc-600 mt-1">
          {formatPrice(propertyData.asking_price)} • {propertyData.buyer_agent_commission} buyer agent commission
        </p>
      </div>

      {matchCount > 0 && (
        <>
          {/* Message to Agents */}
          <div className="space-y-2">
            <Label htmlFor="message">Message to agents (optional)</Label>
            <Textarea
              id="message"
              value={messageToAgents}
              onChange={(e) => setMessageToAgents(e.target.value)}
              placeholder="Add a personal message to send with your property introduction..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* What's Next */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Ready to connect?</h2>
            <p className="text-sm text-zinc-600">
              For a one-time fee of <strong>$29.99</strong>, we'll introduce your property to all {matchCount} matched agents privately.
            </p>

            <div className="space-y-2 p-4 bg-zinc-50 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-zinc-700">Private introduction to verified buyer agents only</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-zinc-700">Your property is never publicly listed or syndicated</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-zinc-700">Agents can respond directly to schedule showings</p>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="p-4 border border-zinc-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(!!checked)}
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                I agree to pay the <strong>{propertyData.buyer_agent_commission}</strong> buyer agent commission upon successful sale and the <strong>$29.99</strong> Agent Match delivery fee.
              </Label>
            </div>
          </div>

          {/* CTA */}
          <Button
            onClick={handleProceedToPayment}
            disabled={!acceptedTerms || isProcessing}
            className="w-full bg-black hover:bg-zinc-800 text-white h-12 text-base"
          >
            {isProcessing ? (
              "Processing..."
            ) : isAuthenticated ? (
              <>
                Proceed to Payment — $29.99
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Create Account & Pay — $29.99
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </>
      )}

      {matchCount === 0 && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-[#0E56F5] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-zinc-900">We'll keep looking</p>
              <p className="text-xs text-zinc-600 mt-1">
                When new agents register buyer needs matching your property, we'll notify you by email.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <div className="flex items-start gap-3 pt-4 border-t">
        <Lock className="h-4 w-4 text-zinc-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Your property details are never shared publicly. Agent identities are revealed only after you complete payment.
        </p>
      </div>
    </div>
  );
};

export default AgentMatchResultsPanel;