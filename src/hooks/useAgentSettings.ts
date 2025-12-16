import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export interface AgentSettings {
  user_id: string;
  onboarding_started: boolean;
  onboarding_completed: boolean;
  preferences_set: boolean;
  notifications_set: boolean;
  price_min: number | null;
  price_max: number | null;
  price_no_min: boolean;
  price_no_max: boolean;
  property_types: string[];
  state: string | null;
  county: string | null;
  towns: string[];
  email_frequency: string;
  notifications_enabled: boolean;
  muted_all: boolean;
  tour_completed: boolean;
  welcome_modal_dismissed: boolean;
}

const defaultSettings: Omit<AgentSettings, "user_id"> = {
  onboarding_started: false,
  onboarding_completed: false,
  preferences_set: false,
  notifications_set: false,
  price_min: null,
  price_max: null,
  price_no_min: false,
  price_no_max: false,
  property_types: [],
  state: null,
  county: null,
  towns: [],
  email_frequency: "immediate",
  notifications_enabled: true,
  muted_all: false,
  tour_completed: false,
  welcome_modal_dismissed: false,
};

export const useAgentSettings = (user: User | null) => {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("agent_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as AgentSettings);
      } else {
        // Create default settings for new user
        const newSettings = { user_id: user.id, ...defaultSettings };
        const { data: inserted, error: insertError } = await supabase
          .from("agent_settings")
          .insert(newSettings)
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(inserted as AgentSettings);
      }
    } catch (error) {
      console.error("Error fetching agent settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<AgentSettings>) => {
    if (!user || !settings) return false;

    try {
      const { error } = await supabase
        .from("agent_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setSettings((prev) => (prev ? { ...prev, ...updates } : null));
      return true;
    } catch (error) {
      console.error("Error updating agent settings:", error);
      return false;
    }
  };

  const dismissWelcomeModal = () => updateSettings({ welcome_modal_dismissed: true, onboarding_started: true });

  const markProfileComplete = () => updateSettings({ onboarding_started: true });

  const markPreferencesSet = () => updateSettings({ preferences_set: true });

  const markNotificationsSet = () => updateSettings({ notifications_set: true });

  const completeOnboarding = () => updateSettings({ onboarding_completed: true });

  const completeTour = () => updateSettings({ tour_completed: true });

  // Check if profile is complete (using agent_profiles table)
  const checkProfileComplete = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, company, phone, email")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return false;

      // Profile complete when name + company + (phone OR email)
      const hasName = !!(data.first_name && data.last_name);
      const hasBrokerage = !!data.company;
      const hasContact = !!(data.phone || data.email);

      return hasName && hasBrokerage && hasContact;
    } catch (error) {
      console.error("Error checking profile complete:", error);
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    dismissWelcomeModal,
    markProfileComplete,
    markPreferencesSet,
    markNotificationsSet,
    completeOnboarding,
    completeTour,
    checkProfileComplete,
    refetch: fetchSettings,
  };
};
