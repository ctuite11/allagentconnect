/**
 * Auth Debug Utilities
 * 
 * Provides debug logging gated behind VITE_DEBUG_AUTH=true
 * and centralized has_role RPC calls for admin detection.
 */

import { supabase } from "@/integrations/supabase/client";

// Check if debug logging is enabled
export const isAuthDebugEnabled = (): boolean => {
  return import.meta.env.VITE_DEBUG_AUTH === "true";
};

// Debug log helper - only logs when VITE_DEBUG_AUTH=true
export const authDebug = (context: string, data: Record<string, unknown>) => {
  if (isAuthDebugEnabled()) {
    console.log(`[AUTH_DEBUG] ${context}:`, data);
  }
};

// Centralized admin check using has_role RPC
export const checkIsAdmin = async (
  userId: string
): Promise<{ isAdmin: boolean; error: string | null }> => {
  try {
    authDebug("checkIsAdmin", { userId });

    // IMPORTANT: has_role returns a boolean. Treat it as such.
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as "admin" | "agent" | "buyer",
    });

    if (error) {
      authDebug("checkIsAdmin error", { userId, error: error.message });
      return { isAdmin: false, error: error.message };
    }

    const isAdmin = data === true;
    authDebug("checkIsAdmin result", { userId, rpcData: data, isAdmin });
    return { isAdmin, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    authDebug("checkIsAdmin exception", { userId, error: message });
    return { isAdmin: false, error: message };
  }
};

// Get agent status
export const getAgentStatus = async (userId: string): Promise<{ status: string | null; error: string | null }> => {
  try {
    authDebug("getAgentStatus", { userId });
    
    const { data, error } = await supabase
      .from("agent_settings")
      .select("agent_status")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      authDebug("getAgentStatus error", { userId, error: error.message });
      return { status: null, error: error.message };
    }
    
    const status = data?.agent_status || null;
    authDebug("getAgentStatus result", { userId, status });
    return { status, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    authDebug("getAgentStatus exception", { userId, error: message });
    return { status: null, error: message };
  }
};

// Full auth diagnostic data
export interface AuthDiagnostic {
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
  adminCheckError: string | null;
  agentStatus: string | null;
  agentStatusError: string | null;
  timestamp: string;
}

export const getAuthDiagnostics = async (): Promise<AuthDiagnostic> => {
  const result: AuthDiagnostic = {
    userId: null,
    email: null,
    isAdmin: false,
    adminCheckError: null,
    agentStatus: null,
    agentStatusError: null,
    timestamp: new Date().toISOString(),
  };
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      result.adminCheckError = "No session";
      result.agentStatusError = "No session";
      return result;
    }
    
    result.userId = session.user.id;
    result.email = session.user.email || null;
    
    // Check admin status
    const adminResult = await checkIsAdmin(session.user.id);
    result.isAdmin = adminResult.isAdmin;
    result.adminCheckError = adminResult.error;
    
    // Get agent status
    const agentResult = await getAgentStatus(session.user.id);
    result.agentStatus = agentResult.status;
    result.agentStatusError = agentResult.error;
    
    authDebug("getAuthDiagnostics", { ...result });
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.adminCheckError = message;
    result.agentStatusError = message;
    return result;
  }
};
