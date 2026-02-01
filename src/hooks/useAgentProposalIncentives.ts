import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProposalIncentivesData {
  // From agent_settings
  showBuyerProposal: boolean;
  showSellerProposal: boolean;
  // From agent_proposal_incentives
  buyerFeeCredItType: "percentage" | "flat" | null;
  buyerFeeCreditValue: number | null;
  flatFeeOption: boolean;
  flatFeeAmount: number | null;
  customIncentiveNotes: string | null;
}

const defaultData: ProposalIncentivesData = {
  showBuyerProposal: false,
  showSellerProposal: false,
  buyerFeeCredItType: null,
  buyerFeeCreditValue: null,
  flatFeeOption: false,
  flatFeeAmount: null,
  customIncentiveNotes: null,
};

/**
 * Hook to manage agent proposal incentives and visibility settings.
 * CRITICAL: Only executes queries when featureEnabled === true.
 * 
 * @param userId - The agent's user ID
 * @param featureEnabled - Whether the FEATURE_AGENT_PROPOSALS flag is enabled
 */
export const useAgentProposalIncentives = (
  userId: string | null,
  featureEnabled: boolean
) => {
  const { toast } = useToast();
  const [data, setData] = useState<ProposalIncentivesData>(defaultData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data - STRICT GUARD: only runs when featureEnabled === true
  const fetchData = useCallback(async () => {
    // Guard: no queries if flag is off or no user
    if (!featureEnabled || !userId) {
      setData(defaultData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch agent_settings for toggles
      const { data: settingsData, error: settingsError } = await supabase
        .from("agent_settings")
        .select("show_buyer_proposal, show_seller_proposal")
        .eq("user_id", userId)
        .maybeSingle();

      if (settingsError) throw settingsError;

      // Fetch agent_proposal_incentives (may not exist yet)
      const { data: incentivesData, error: incentivesError } = await supabase
        .from("agent_proposal_incentives")
        .select("*")
        .eq("agent_id", userId)
        .maybeSingle();

      if (incentivesError) throw incentivesError;

      setData({
        showBuyerProposal: settingsData?.show_buyer_proposal ?? false,
        showSellerProposal: settingsData?.show_seller_proposal ?? false,
        buyerFeeCredItType: incentivesData?.buyer_fee_credit_type as "percentage" | "flat" | null,
        buyerFeeCreditValue: incentivesData?.buyer_fee_credit_value ?? null,
        flatFeeOption: incentivesData?.flat_fee_option ?? false,
        flatFeeAmount: incentivesData?.flat_fee_amount ?? null,
        customIncentiveNotes: incentivesData?.custom_incentive_notes ?? null,
      });
    } catch (err) {
      console.error("[useAgentProposalIncentives] Fetch error:", err);
      setError("Failed to load proposal settings");
    } finally {
      setLoading(false);
    }
  }, [userId, featureEnabled]);

  // Only trigger fetch when featureEnabled becomes true
  useEffect(() => {
    if (featureEnabled && userId) {
      fetchData();
    }
  }, [featureEnabled, userId, fetchData]);

  /**
   * Save data with atomic semantics: only show success if BOTH updates succeed.
   * Uses fail-fast: if first update fails, second is not attempted.
   */
  const save = async (updates: Partial<ProposalIncentivesData>): Promise<boolean> => {
    if (!featureEnabled || !userId) {
      toast({
        title: "Error",
        description: "Feature not available",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    setError(null);

    const newData = { ...data, ...updates };

    try {
      // Step 1: Update agent_settings (toggles)
      const { error: settingsError } = await supabase
        .from("agent_settings")
        .update({
          show_buyer_proposal: newData.showBuyerProposal,
          show_seller_proposal: newData.showSellerProposal,
        })
        .eq("user_id", userId);

      if (settingsError) {
        throw new Error(`Settings update failed: ${settingsError.message}`);
      }

      // Step 2: Upsert agent_proposal_incentives
      const { error: incentivesError } = await supabase
        .from("agent_proposal_incentives")
        .upsert(
          {
            agent_id: userId,
            buyer_fee_credit_type: newData.buyerFeeCredItType,
            buyer_fee_credit_value: newData.buyerFeeCreditValue,
            flat_fee_option: newData.flatFeeOption,
            flat_fee_amount: newData.flatFeeAmount,
            custom_incentive_notes: newData.customIncentiveNotes,
          },
          { onConflict: "agent_id" }
        );

      if (incentivesError) {
        throw new Error(`Incentives update failed: ${incentivesError.message}`);
      }

      // BOTH succeeded - update local state and show success
      setData(newData);
      toast({
        title: "Saved",
        description: "Proposal settings updated successfully",
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save proposal settings";
      console.error("[useAgentProposalIncentives] Save error:", err);
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    data,
    loading,
    saving,
    error,
    save,
    refetch: fetchData,
  };
};
