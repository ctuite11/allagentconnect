import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type UserRole = "buyer" | "agent" | "admin" | null;

export const useUserRole = (user: User | null) => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // Reset loading to true when user transitions from null -> real user
      setLoading(true);

      try {
        // Use has_role RPC for admin check (SECURITY DEFINER - no RLS issues)
        const { data: hasAdminRole, error: adminError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin" as const,
        });

        if (!adminError && hasAdminRole === true) {
          setRole("admin");
          setLoading(false);
          return;
        }

        // Check for agent role using has_role RPC
        const { data: hasAgentRole } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "agent" as const,
        });

        if (hasAgentRole === true) {
          setRole("agent");
          setLoading(false);
          return;
        }

        // Check for buyer role using has_role RPC
        const { data: hasBuyerRole } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "buyer" as const,
        });

        if (hasBuyerRole === true) {
          setRole("buyer");
          setLoading(false);
          return;
        }

        // No recognized role
        setRole(null);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return { role, loading };
};
