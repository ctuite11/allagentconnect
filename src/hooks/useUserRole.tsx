import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type UserRole = "buyer" | "agent" | "admin" | null;

export const useUserRole = (user: User | null) => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const fetchRole = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(true);

      // Failsafe timeout - prevents roleLoading from being stuck forever
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          console.warn("useUserRole: timeout reached, forcing loading=false");
          setLoading(false);
        }
      }, 2000);

      try {
        // Check admin role
        const { data: hasAdminRole, error: adminError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin" as const,
        });

        if (cancelled) return;

        if (!adminError && hasAdminRole === true) {
          setRole("admin");
          return;
        }

        // Check agent role
        const { data: hasAgentRole, error: agentError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "agent" as const,
        });

        if (cancelled) return;

        if (!agentError && hasAgentRole === true) {
          setRole("agent");
          return;
        }

        // Check buyer role
        const { data: hasBuyerRole, error: buyerError } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "buyer" as const,
        });

        if (cancelled) return;

        if (!buyerError && hasBuyerRole === true) {
          setRole("buyer");
          return;
        }

        if (!cancelled) setRole(null);
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (!cancelled) setRole(null);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };

    fetchRole();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user?.id]);

  return { role, loading };
};
