import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info } from "lucide-react";
import { useAgentProposalIncentives, ProposalIncentivesData } from "@/hooks/useAgentProposalIncentives";

interface AgentProposalIncentivesFormProps {
  userId: string;
  featureEnabled: boolean;
}

/**
 * Agent Proposal Incentives Form
 * 
 * Allows agents to configure:
 * - Visibility toggles (show_buyer_proposal, show_seller_proposal)
 * - Incentives (fee credits, flat-fee option, custom notes)
 * 
 * All microcopy from docs/proposal-system-copy.md (locked)
 */
const AgentProposalIncentivesForm = ({ userId, featureEnabled }: AgentProposalIncentivesFormProps) => {
  const { data, loading, saving, save } = useAgentProposalIncentives(userId, featureEnabled);
  
  // Local form state
  const [formData, setFormData] = useState<ProposalIncentivesData>(data);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when data loads
  useEffect(() => {
    setFormData(data);
    setIsDirty(false);
  }, [data]);

  const updateField = <K extends keyof ProposalIncentivesData>(
    field: K,
    value: ProposalIncentivesData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const success = await save(formData);
    if (success) {
      setIsDirty(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Proposal Visibility & Incentives
        </CardTitle>
        {/* Global rule - locked microcopy */}
        <div className="flex items-start gap-2 mt-2 p-3 bg-muted/50 rounded-md">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Proposals are shown only when both sides opt in.
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Visibility Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Visibility
          </h4>
          
          {/* Buyer proposal toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="show-buyer-proposal" className="text-sm font-medium">
                Show my buyer-agent proposal to qualified buyers
              </Label>
              <p className="text-xs text-muted-foreground">
                Qualified buyers have provided proof of funds, a pre-approval, or agreed to provide documentation upon request.
              </p>
            </div>
            <Switch
              id="show-buyer-proposal"
              checked={formData.showBuyerProposal}
              onCheckedChange={(checked) => updateField("showBuyerProposal", checked)}
            />
          </div>

          {/* Seller proposal toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="show-seller-proposal" className="text-sm font-medium">
                Show my listing proposal to verified sellers
              </Label>
              <p className="text-xs text-muted-foreground">
                Verified sellers have submitted property details through AllAgentConnect.
              </p>
            </div>
            <Switch
              id="show-seller-proposal"
              checked={formData.showSellerProposal}
              onCheckedChange={(checked) => updateField("showSellerProposal", checked)}
            />
          </div>
        </div>

        <Separator />

        {/* Incentives Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Incentives (Optional)
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Incentives are optional. If offered, they are shown only to qualified users and may include fee credits, flat-fee options, or reduced commissions.
            </p>
          </div>

          {/* Buyer-agent fee credit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="credit-type" className="text-sm">
                Buyer-agent fee credit type
              </Label>
              <Select
                value={formData.buyerFeeCredItType ?? "none"}
                onValueChange={(value) =>
                  updateField("buyerFeeCredItType", value === "none" ? null : (value as "percentage" | "flat"))
                }
              >
                <SelectTrigger id="credit-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="flat">Flat Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit-value" className="text-sm">
                Credit value
              </Label>
              <div className="relative">
                <Input
                  id="credit-value"
                  type="number"
                  placeholder={formData.buyerFeeCredItType === "percentage" ? "e.g., 0.5" : "e.g., 2500"}
                  value={formData.buyerFeeCreditValue ?? ""}
                  onChange={(e) =>
                    updateField("buyerFeeCreditValue", e.target.value ? parseFloat(e.target.value) : null)
                  }
                  disabled={!formData.buyerFeeCredItType}
                  className="pr-8"
                />
                {formData.buyerFeeCredItType === "percentage" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                )}
                {formData.buyerFeeCredItType === "flat" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Flat-fee option */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="flat-fee-option" className="text-sm font-medium">
                I offer a flat-fee option
              </Label>
              <Switch
                id="flat-fee-option"
                checked={formData.flatFeeOption}
                onCheckedChange={(checked) => updateField("flatFeeOption", checked)}
              />
            </div>
            
            {formData.flatFeeOption && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="flat-fee-amount" className="text-sm">
                  Flat-fee amount
                </Label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    id="flat-fee-amount"
                    type="number"
                    placeholder="e.g., 4995"
                    value={formData.flatFeeAmount ?? ""}
                    onChange={(e) =>
                      updateField("flatFeeAmount", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="pl-7"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custom notes */}
          <div className="space-y-2">
            <Label htmlFor="custom-notes" className="text-sm">
              Custom incentive notes
            </Label>
            <Textarea
              id="custom-notes"
              placeholder="Describe any additional incentives you offer..."
              value={formData.customIncentiveNotes ?? ""}
              onChange={(e) => updateField("customIncentiveNotes", e.target.value || null)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentProposalIncentivesForm;
