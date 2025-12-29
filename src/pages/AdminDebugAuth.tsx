import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, ArrowLeft, RefreshCw, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getAuthDiagnostics, getAgentStatus, type AuthDiagnostic } from "@/lib/authDebug";
import { isAdmin as checkIsAdminRole } from "@/lib/auth/roles";

interface ViewAsState {
  active: boolean;
  targetEmail: string | null;
  targetUserId: string | null;
  targetData: AuthDiagnostic | null;
}

const AdminDebugAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostic | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // View As state
  const [viewAs, setViewAs] = useState<ViewAsState>({
    active: false,
    targetEmail: null,
    targetUserId: null,
    targetData: null,
  });
  const [viewAsEmail, setViewAsEmail] = useState("");
  const [viewAsLoading, setViewAsLoading] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth", { replace: true });
        return;
      }
      
      const ok = await checkIsAdminRole(session.user.id);
      
      if (!ok) {
        toast.error("Admin access required");
        navigate("/", { replace: true });
        return;
      }
      
      setIsAdmin(true);
      await loadDiagnostics();
      setLoading(false);
    };
    
    checkAccess();
  }, [navigate]);

  const loadDiagnostics = async () => {
    const data = await getAuthDiagnostics();
    setDiagnostics(data);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDiagnostics();
    setRefreshing(false);
    toast.success("Diagnostics refreshed");
  };

  const handleCopy = () => {
    if (!diagnostics) return;
    
    const text = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewAs = async () => {
    if (!viewAsEmail.trim()) {
      toast.error("Please enter an email");
      return;
    }
    
    setViewAsLoading(true);
    
    try {
      // Look up the user by email in agent_profiles
      const { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("id, email, first_name, last_name")
        .eq("email", viewAsEmail.trim().toLowerCase())
        .maybeSingle();
      
      if (profileError) {
        toast.error(`Error: ${profileError.message}`);
        setViewAsLoading(false);
        return;
      }
      
      if (!profile) {
        toast.error("User not found");
        setViewAsLoading(false);
        return;
      }
      
      // Get admin status and agent status for that user
      const adminOk = await checkIsAdminRole(profile.id);
      const agentResult = await getAgentStatus(profile.id);
      
      const targetData: AuthDiagnostic = {
        userId: profile.id,
        email: profile.email,
        isAdmin: adminOk,
        adminCheckError: null,
        agentStatus: agentResult.status,
        agentStatusError: agentResult.error,
        timestamp: new Date().toISOString(),
      };
      
      setViewAs({
        active: true,
        targetEmail: profile.email,
        targetUserId: profile.id,
        targetData,
      });
      
      toast.success(`Viewing auth state for ${profile.first_name || profile.email}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Error: ${message}`);
    } finally {
      setViewAsLoading(false);
    }
  };

  const handleClearViewAs = () => {
    setViewAs({
      active: false,
      targetEmail: null,
      targetUserId: null,
      targetData: null,
    });
    setViewAsEmail("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const displayData = viewAs.active ? viewAs.targetData : diagnostics;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/approvals")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">Auth Debug Panel</h1>
        </div>

        {/* View As Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              View As (Safe Impersonation)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              View auth state for another user without switching sessions. No authentication is swapped.
            </p>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="viewAsEmail" className="sr-only">Email</Label>
                <Input
                  id="viewAsEmail"
                  type="email"
                  placeholder="Enter user email..."
                  value={viewAsEmail}
                  onChange={(e) => setViewAsEmail(e.target.value)}
                  disabled={viewAsLoading}
                />
              </div>
              <Button onClick={handleViewAs} disabled={viewAsLoading}>
                {viewAsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "View"
                )}
              </Button>
              {viewAs.active && (
                <Button variant="outline" onClick={handleClearViewAs}>
                  Clear
                </Button>
              )}
            </div>
            
            {viewAs.active && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Viewing auth state for: <strong>{viewAs.targetEmail}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnostics Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {viewAs.active ? "Target User Auth State" : "Current Auth State"}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {displayData ? (
              <div className="space-y-4">
                <DiagnosticRow label="Email" value={displayData.email} />
                <DiagnosticRow label="User ID" value={displayData.userId} mono />
                <DiagnosticRow
                  label="is_admin (has_role)"
                  value={displayData.isAdmin ? "true" : "false"}
                  status={displayData.isAdmin ? "success" : "neutral"}
                />
                {displayData.adminCheckError && (
                  <DiagnosticRow
                    label="Admin Check Error"
                    value={displayData.adminCheckError}
                    status="error"
                  />
                )}
                <DiagnosticRow
                  label="agent_status"
                  value={displayData.agentStatus || "(none)"}
                  status={
                    displayData.agentStatus === "verified"
                      ? "success"
                      : displayData.agentStatus === "pending"
                      ? "warning"
                      : "neutral"
                  }
                />
                {displayData.agentStatusError && (
                  <DiagnosticRow
                    label="Agent Status Error"
                    value={displayData.agentStatusError}
                    status="error"
                  />
                )}
                <DiagnosticRow label="Timestamp" value={displayData.timestamp} />
              </div>
            ) : (
              <p className="text-slate-500">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/approvals")}
            >
              Agent CRM
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/pending-verification")}
            >
              Test Pending Screen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/auth")}
            >
              Auth Page
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface DiagnosticRowProps {
  label: string;
  value: string | null;
  mono?: boolean;
  status?: "success" | "warning" | "error" | "neutral";
}

const DiagnosticRow = ({ label, value, mono, status }: DiagnosticRowProps) => {
  const statusColors = {
    success: "text-emerald-600",
    warning: "text-amber-600",
    error: "text-red-600",
    neutral: "text-slate-700",
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <span className="text-sm text-slate-500 sm:w-40 shrink-0">{label}</span>
      <span
        className={`text-sm break-all ${mono ? "font-mono text-xs" : ""} ${
          status ? statusColors[status] : "text-slate-900"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
};

export default AdminDebugAuth;
