import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AuthDiagnostics = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [resetTestResult, setResetTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
    method?: string;
  }>({ status: "idle" });

  // Environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "NOT SET";
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "NOT SET";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "NOT SET";
  
  // Mask the anon key for display
  const maskedAnonKey = anonKey.length > 12 
    ? `${anonKey.slice(0, 6)}...${anonKey.slice(-6)}`
    : anonKey;

  // Extract project ID from URL for comparison
  const urlProjectId = supabaseUrl.includes("supabase.co") 
    ? supabaseUrl.split("//")[1]?.split(".")[0] || "unknown"
    : "non-supabase-url";

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setSessionLoading(false);
      }
    };
    checkSession();
  }, []);

  const testPasswordReset = async () => {
    setResetTestResult({ status: "testing" });
    
    const testEmail = "test-diagnostics@example.com";
    
    try {
      // First try the custom edge function
      console.log("[Diagnostics] Testing send-password-reset function...");
      const { error: fnError } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: testEmail,
          redirectUrl: `${window.location.origin}/auth/callback`,
        },
      });

      if (fnError) {
        console.log("[Diagnostics] Edge function failed:", fnError);
        
        // Try fallback to native Supabase auth
        console.log("[Diagnostics] Testing native resetPasswordForEmail...");
        const { error: nativeError } = await supabase.auth.resetPasswordForEmail(testEmail, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });

        if (nativeError) {
          setResetTestResult({
            status: "error",
            message: `Both methods failed. Edge fn: ${fnError.message || JSON.stringify(fnError)}. Native: ${nativeError.message}`,
            method: "both-failed",
          });
        } else {
          setResetTestResult({
            status: "success",
            message: "Edge function failed but native Supabase auth works! Fallback is functional.",
            method: "native-fallback",
          });
        }
      } else {
        setResetTestResult({
          status: "success",
          message: "Custom edge function works correctly.",
          method: "edge-function",
        });
      }
    } catch (err: any) {
      console.error("[Diagnostics] Test error:", err);
      
      // Try native fallback on exception
      try {
        const { error: nativeError } = await supabase.auth.resetPasswordForEmail("test@example.com", {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        
        if (nativeError) {
          setResetTestResult({
            status: "error",
            message: `Exception: ${err.message}. Native fallback also failed: ${nativeError.message}`,
            method: "both-failed",
          });
        } else {
          setResetTestResult({
            status: "success",
            message: `Edge function threw exception but native fallback works.`,
            method: "native-fallback",
          });
        }
      } catch (fallbackErr: any) {
        setResetTestResult({
          status: "error",
          message: `All methods failed: ${err.message}`,
          method: "all-failed",
        });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const DiagnosticRow = ({ 
    label, 
    value, 
    status,
    copyable = false 
  }: { 
    label: string; 
    value: string; 
    status?: "ok" | "warning" | "error";
    copyable?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-sm bg-muted px-2 py-1 rounded font-mono max-w-[300px] truncate">
          {value}
        </code>
        {copyable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => copyToClipboard(value, label)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
        {status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
        {status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/auth")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Auth Diagnostics</h1>
            <p className="text-muted-foreground text-sm">
              Debug authentication configuration and test password reset
            </p>
          </div>
        </div>

        {/* Environment Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environment Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <DiagnosticRow 
              label="Current Origin" 
              value={window.location.origin}
              copyable
            />
            <DiagnosticRow 
              label="VITE_SUPABASE_URL" 
              value={supabaseUrl}
              status={supabaseUrl.includes("qocduqtfbsevnhlgsfka") ? "ok" : "error"}
              copyable
            />
            <DiagnosticRow 
              label="URL Project ID" 
              value={urlProjectId}
              status={urlProjectId === "qocduqtfbsevnhlgsfka" ? "ok" : "error"}
            />
            <DiagnosticRow 
              label="VITE_SUPABASE_PROJECT_ID" 
              value={supabaseProjectId}
              status={supabaseProjectId === "qocduqtfbsevnhlgsfka" ? "ok" : "warning"}
            />
            <DiagnosticRow 
              label="Anon Key (masked)" 
              value={maskedAnonKey}
            />
          </CardContent>
        </Card>

        {/* Expected vs Actual */}
        <Card className={urlProjectId === "qocduqtfbsevnhlgsfka" ? "border-green-500" : "border-destructive"}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Backend Match Check
              {urlProjectId === "qocduqtfbsevnhlgsfka" ? (
                <Badge variant="default" className="bg-green-500">MATCH</Badge>
              ) : (
                <Badge variant="destructive">MISMATCH</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Project ID:</span>
                <code className="font-mono">qocduqtfbsevnhlgsfka</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Project ID:</span>
                <code className={`font-mono ${urlProjectId !== "qocduqtfbsevnhlgsfka" ? "text-destructive font-bold" : ""}`}>
                  {urlProjectId}
                </code>
              </div>
              {urlProjectId !== "qocduqtfbsevnhlgsfka" && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-destructive font-medium">
                    ⚠️ This build is connected to a DIFFERENT Supabase project!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This domain is serving a build with the wrong backend configuration.
                    The live domain needs to be re-published from the correct Lovable project.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Checking session...</span>
              </div>
            ) : session ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Authenticated</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Email: {session.user?.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  User ID: <code className="font-mono text-xs">{session.user?.id}</code>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not authenticated</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Reset Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Password Reset Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tests both the custom edge function and native Supabase auth to determine which method works.
            </p>
            
            <Button 
              onClick={testPasswordReset}
              disabled={resetTestResult.status === "testing"}
            >
              {resetTestResult.status === "testing" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Password Reset"
              )}
            </Button>

            {resetTestResult.status !== "idle" && resetTestResult.status !== "testing" && (
              <div className={`p-4 rounded-lg ${
                resetTestResult.status === "success" 
                  ? "bg-green-500/10 border border-green-500/20" 
                  : "bg-destructive/10 border border-destructive/20"
              }`}>
                <div className="flex items-start gap-2">
                  {resetTestResult.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      resetTestResult.status === "success" ? "text-green-700" : "text-destructive"
                    }`}>
                      {resetTestResult.status === "success" ? "Success" : "Error"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {resetTestResult.message}
                    </p>
                    {resetTestResult.method && (
                      <Badge variant="outline" className="mt-2">
                        Method: {resetTestResult.method}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Diagnostics page for debugging auth issues.</p>
          <p>Expected backend: qocduqtfbsevnhlgsfka.supabase.co</p>
        </div>
      </div>
    </div>
  );
};

export default AuthDiagnostics;
