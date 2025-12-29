import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Copy, ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Derive expected project ID from VITE_SUPABASE_URL at runtime
const getProjectIdFromUrl = (url: string): string => {
  if (!url || !url.includes("supabase.co")) return "unknown";
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
};

// Get key fingerprint (first 8 + last 8 chars)
const getKeyFingerprint = (key: string): string => {
  if (!key || key.length < 20) return key || "MISSING";
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
};

interface ProbeResult {
  status: "idle" | "running" | "success" | "error";
  httpStatus?: number;
  body?: string;
  error?: string;
  url?: string;
}

interface SDKProbeResult {
  status: "idle" | "running" | "success" | "error";
  data?: unknown;
  error?: {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
  };
}

const AuthDiagnostics = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [resetTestResult, setResetTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
    method?: string;
  }>({ status: "idle" });

  // Probe results
  const [sdkProbe, setSdkProbe] = useState<SDKProbeResult>({ status: "idle" });
  const [restProbe, setRestProbe] = useState<ProbeResult>({ status: "idle" });

  // Environment variables - try both key names
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const anonKey = 
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    "";
  
  // Derive expected project ID from the URL (the source of truth)
  const expectedProjectId = getProjectIdFromUrl(supabaseUrl);
  
  // Key fingerprint for display
  const keyFingerprint = getKeyFingerprint(anonKey);

  // Extract project ID from URL for comparison
  const urlProjectId = supabaseUrl.includes("supabase.co") 
    ? supabaseUrl.split("//")[1]?.split(".")[0] || "unknown"
    : "non-supabase-url";

  // Check if configuration is consistent
  const isConfigValid = urlProjectId !== "unknown" && urlProjectId !== "non-supabase-url" && anonKey.length > 0;

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

  // Run SDK probe
  const runSdkProbe = useCallback(async () => {
    setSdkProbe({ status: "running" });
    try {
      const { data, error } = await supabase
        .from("agent_settings")
        .select("agent_status")
        .limit(1);

      if (error) {
        setSdkProbe({
          status: "error",
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            // PostgREST errors may have a status property
            status: (error as any).status,
          },
        });
      } else {
        setSdkProbe({
          status: "success",
          data,
        });
      }
    } catch (err: any) {
      setSdkProbe({
        status: "error",
        error: { message: err.message || "Unknown error" },
      });
    }
  }, []);

  // Run direct REST probe
  const runRestProbe = useCallback(async () => {
    if (!supabaseUrl || !anonKey) {
      setRestProbe({
        status: "error",
        error: "Missing SUPABASE_URL or ANON_KEY",
      });
      return;
    }

    const url = `${supabaseUrl}/rest/v1/agent_settings?select=agent_status&limit=1`;
    setRestProbe({ status: "running", url });

    try {
      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      const text = await response.text();
      setRestProbe({
        status: response.ok ? "success" : "error",
        httpStatus: response.status,
        body: text.length > 500 ? text.slice(0, 500) + "..." : text,
        url,
      });
    } catch (err: any) {
      setRestProbe({
        status: "error",
        error: err.message || "Network error",
        url,
      });
    }
  }, [supabaseUrl, anonKey]);

  // Auto-run probes on mount
  useEffect(() => {
    runSdkProbe();
    runRestProbe();
  }, [runSdkProbe, runRestProbe]);

  // Run all probes
  const runAllProbes = () => {
    runSdkProbe();
    runRestProbe();
  };

  // Build debug report JSON
  const buildDebugReport = () => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      origin: window.location.origin,
      supabaseUrl,
      urlProjectId,
      envProjectId: supabaseProjectId,
      keyFingerprint,
      isConfigValid,
      session: session ? { email: session.user?.email, userId: session.user?.id } : null,
      sdkProbe: {
        status: sdkProbe.status,
        data: sdkProbe.data,
        error: sdkProbe.error,
      },
      restProbe: {
        status: restProbe.status,
        httpStatus: restProbe.httpStatus,
        body: restProbe.body,
        error: restProbe.error,
        url: restProbe.url,
      },
    }, null, 2);
  };

  const copyDebugReport = () => {
    navigator.clipboard.writeText(buildDebugReport());
    toast.success("Debug report copied to clipboard");
  };

  const testPasswordReset = async () => {
    setResetTestResult({ status: "testing" });
    
    const testEmail = "test-diagnostics@example.com";
    
    try {
      console.log("[Diagnostics] Testing send-password-reset function...");
      const { error: fnError } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: testEmail,
          redirectUrl: `${window.location.origin}/auth/callback`,
        },
      });

      if (fnError) {
        console.log("[Diagnostics] Edge function failed:", fnError);
        
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
    status?: "ok" | "warning" | "error" | "neutral";
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
              Debug authentication configuration and backend connectivity
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
              value={supabaseUrl || "NOT SET"}
              status={supabaseUrl ? "ok" : "error"}
              copyable
            />
            <DiagnosticRow 
              label="URL Project Ref" 
              value={urlProjectId}
              status={isConfigValid ? "ok" : "error"}
            />
            <DiagnosticRow 
              label="VITE_SUPABASE_PROJECT_ID" 
              value={supabaseProjectId || "NOT SET"}
              status={supabaseProjectId === expectedProjectId ? "ok" : "warning"}
            />
            <DiagnosticRow 
              label="Anon Key Fingerprint" 
              value={keyFingerprint}
              status={anonKey ? "ok" : "error"}
            />
          </CardContent>
        </Card>

        {/* Backend REST Probe */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Backend REST Probe</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={runAllProbes}>
                <Play className="h-4 w-4 mr-1" />
                Run Probes
              </Button>
              <Button size="sm" variant="outline" onClick={copyDebugReport}>
                <Copy className="h-4 w-4 mr-1" />
                Copy Debug Report
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SDK Probe */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">SDK Probe</span>
                {sdkProbe.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                {sdkProbe.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {sdkProbe.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
              <code className="text-xs text-muted-foreground block mb-2">
                supabase.from("agent_settings").select("agent_status").limit(1)
              </code>
              {sdkProbe.status !== "idle" && sdkProbe.status !== "running" && (
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  {sdkProbe.status === "success" ? (
                    <div>
                      <span className="text-green-600">Data:</span> {JSON.stringify(sdkProbe.data)}
                    </div>
                  ) : (
                    <div className="text-destructive">
                      <div>message: {sdkProbe.error?.message}</div>
                      {sdkProbe.error?.code && <div>code: {sdkProbe.error.code}</div>}
                      {sdkProbe.error?.status && <div>status: {sdkProbe.error.status}</div>}
                      {sdkProbe.error?.hint && <div>hint: {sdkProbe.error.hint}</div>}
                      {sdkProbe.error?.details && <div>details: {sdkProbe.error.details}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Direct REST Probe */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">Direct REST Probe</span>
                {restProbe.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                {restProbe.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {restProbe.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
              {restProbe.url && (
                <code className="text-xs text-muted-foreground block mb-2 break-all">
                  GET {restProbe.url}
                </code>
              )}
              {restProbe.status !== "idle" && restProbe.status !== "running" && (
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  <div className={restProbe.httpStatus === 200 ? "text-green-600" : "text-destructive"}>
                    HTTP Status: {restProbe.httpStatus || "N/A"}
                  </div>
                  {restProbe.error && <div className="text-destructive">Error: {restProbe.error}</div>}
                  {restProbe.body && (
                    <div className="mt-2">
                      <span className="text-muted-foreground">Body:</span>
                      <pre className="whitespace-pre-wrap">{restProbe.body}</pre>
                      {restProbe.body.length >= 500 && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="mt-1 h-6 text-xs"
                          onClick={() => copyToClipboard(restProbe.body || "", "Full response")}
                        >
                          Copy full response
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Interpretation */}
            {restProbe.status !== "idle" && restProbe.status !== "running" && (
              <div className={`p-3 rounded-lg text-sm ${
                restProbe.httpStatus === 200 
                  ? "bg-green-500/10 border border-green-500/20" 
                  : "bg-destructive/10 border border-destructive/20"
              }`}>
                {restProbe.httpStatus === 200 && (
                  <p>✅ Table exists and is visible. If you're stuck on "Almost there", the issue is routing logic or data, not REST visibility.</p>
                )}
                {restProbe.httpStatus === 401 && (
                  <p>⚠️ 401 Unauthorized: Wrong or missing anon key in production environment.</p>
                )}
                {restProbe.httpStatus === 403 && (
                  <p>⚠️ 403 Forbidden: Auth headers missing or RLS blocking anonymous access.</p>
                )}
                {restProbe.httpStatus === 404 && (
                  <p>❌ 404 Not Found: Table not exposed to API or backend URL mismatch. This is NOT RLS—the table is simply not visible to PostgREST.</p>
                )}
                {restProbe.httpStatus === 500 && (
                  <p>❌ 500 Server Error: PostgREST configuration issue on the backend.</p>
                )}
                {!restProbe.httpStatus && restProbe.error && (
                  <p>❌ Network error: Could not reach backend at all. Check URL and network.</p>
                )}
              </div>
            )}
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
          <p>Backend: {supabaseUrl}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthDiagnostics;
