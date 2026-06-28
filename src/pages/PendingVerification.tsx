import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { authDebug, getAgentStatus } from "@/lib/authDebug";
import { AGENT_STATUS } from "@/constants/status";
import { toast } from "sonner";
import AACMonogram from "@/components/ui/AACMonogram";
import { AuthShell as PendingShell } from "@/components/auth/AuthShell";

const POLL_INTERVAL_MS = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const PendingVerification = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const didNavigate = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user already uploaded
  const checkExistingUpload = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("agent_license_uploads")
      .select("id")
      .eq("user_id", uid)
      .limit(1);
    if (data && data.length > 0) {
      setUploadComplete(true);
    }
  }, []);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;

    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user && attempts < maxAttempts) {
        attempts++;
        authDebug("PendingVerification no session", { attempt: attempts, maxAttempts });
        setTimeout(checkStatus, 500);
        return;
      }
      
      if (!session?.user) {
        authDebug("PendingVerification", { action: "no_session_showing_page" });
        setHasSession(false);
        setLoading(false);
        return;
      }

      // Server-confirm session before treating it as active (controls Log out visibility).
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        authDebug("PendingVerification", { action: "stale_session_no_logout", error: userError?.message });
        setHasSession(false);
        setLoading(false);
        return;
      }
      const uid = userData.user.id;
      const email = userData.user.email || null;
      setUserEmail(email);
      setUserId(uid);
      setHasSession(true);
      
      authDebug("PendingVerification checking status", { userId: uid, email });

      // PRIORITY 1: Admin check
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });

      if (isAdmin === true) {
        authDebug("PendingVerification ADMIN_REDIRECT", { action: "terminal_redirect" });
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/admin/approvals", { replace: true });
        }
        return;
      }

      // PRIORITY 2: Check agent status
      const agentResult = await getAgentStatus(uid);
      authDebug("PendingVerification agent status", { userId: uid, status: agentResult.status, error: agentResult.error });
      
      if (agentResult.error) {
        const errStr = agentResult.error;
        const is404 = 
          errStr.includes('404') || 
          errStr.toLowerCase().includes('not found') || 
          errStr.toLowerCase().includes('relation') || 
          errStr.toLowerCase().includes('does not exist');
        
        if (is404) {
          setFatalError("Configuration error: agent_settings table not found in API. Contact support.");
          setLoading(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
      }
      
      const status = agentResult.status || AGENT_STATUS.UNVERIFIED;

      if (status === AGENT_STATUS.VERIFIED) {
        setIsApproved(true);
        setLoading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setTimeout(() => {
          if (!didNavigate.current) {
            didNavigate.current = true;
            navigate("/agent-dashboard", { replace: true });
          }
        }, 2000);
        return;
      }

      if (status === AGENT_STATUS.REJECTED) {
        setIsRejected(true);
        setLoading(false);
        // Stop polling — rejected is terminal until admin re-reviews
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // Check if they already uploaded
        await checkExistingUpload(uid);
        return;
      }

      setLoading(false);
    };

    checkStatus();
    pollIntervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [navigate, checkExistingUpload]);

  const handleFileUpload = async (file: File) => {
    if (!userId) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 10MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${userId}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("agent-license-docs")
        .upload(storagePath, file);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("agent_license_uploads")
        .insert({
          user_id: userId,
          file_path: storagePath,
          file_name: file.name,
          status: "pending_review",
        });

      if (dbError) throw dbError;

      setUploadComplete(true);
      toast.success("License uploaded — we'll review it shortly.");

      // Notify admin via edge function (fire-and-forget)
      supabase.functions.invoke("send-license-upload-notification", {
        body: { userId },
      }).catch((notifyErr) => console.warn("Admin notification failed:", notifyErr));
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleAcknowledge = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const handleSignOutSwitch = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const handleLogoutToHome = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    didNavigate.current = true;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[PendingVerification] signOut failed:", e);
    }
    navigate("/", { replace: true });
  };

  if (loading) {
    return <AacMonogramLoader variant="fullscreen" message="Loading…" />;
  }

  // Fatal error screen
  if (fatalError) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center bg-white">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-red-600 text-2xl">⚠</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
                Configuration Error
              </h1>
              <p className="text-zinc-600 text-base mb-4">{fatalError}</p>
              <p className="text-zinc-500 text-sm mb-6">
                Please contact support at hello@allagentconnect.com
              </p>
              <Button 
                onClick={handleAcknowledge} 
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800 h-11"
              >
                Log Out
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Approved — redirect animation
  if (isApproved) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center">
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
                You're approved.
              </h1>
              <p className="text-zinc-600 text-base mb-6">Taking you in…</p>
              <AacMonogramLoader variant="inline" hideMessage className="min-h-0 gap-0 py-2" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // REJECTED STATE — License upload flow
  // ═══════════════════════════════════════════════════════════════════
  if (isRejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="relative z-10 w-full max-w-md text-center">
          {/* Brand */}
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
            <span className="text-[#0E56F5]">All Agent</span>
            <span className="text-zinc-400"> Connect</span>
          </h1>

          <h2 className="text-2xl md:text-3xl font-medium text-zinc-900 mb-3">
            We couldn't verify your license
          </h2>

          <p className="text-sm text-zinc-600 mb-2">
            This usually happens when:
          </p>
          <ul className="text-sm text-zinc-500 mb-6 space-y-1">
            <li>• License number wasn't found in state records</li>
            <li>• Name doesn't match what's on file</li>
            <li>• License may be expired or inactive</li>
          </ul>

          {uploadComplete ? (
            /* Already uploaded — confirmation */
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
              <p className="text-emerald-800 font-medium mb-1">License received</p>
              <p className="text-emerald-700 text-sm">
                We'll review it and get back to you shortly.
              </p>
            </div>
          ) : (
            /* Upload area */
            <>
              <p className="text-sm text-zinc-600 mb-4">
                Upload a photo or PDF of your license and we'll review it manually.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors mb-4 ${
                  dragOver
                    ? "border-[#0E56F5] bg-blue-50/50"
                    : "border-zinc-300 hover:border-zinc-400 bg-zinc-50/50"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mx-auto" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                    <p className="text-sm text-zinc-600">
                      Drop your file here or <span className="text-[#0E56F5] font-medium">browse</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">JPG, PNG, or PDF — max 10MB</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={onFileChange}
                className="hidden"
              />
            </>
          )}

          {/* Support */}
          <p className="text-zinc-400 text-xs mt-6">
            Questions? Reach us at{" "}
            <a href="mailto:hello@allagentconnect.com" className="hover:text-emerald-600 transition-colors">
              hello@allagentconnect.com
            </a>
          </p>

          <div className="mt-6">
            <Button
              variant="outline"
              onClick={handleSignOutSwitch}
              className="h-10 px-5 border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            >
              Sign out / Use a different account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEFAULT — Pending / Unverified (polling)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <PendingShell maxWidth="560px">
      <div className="flex flex-col items-center text-center">
        <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-normal text-foreground sm:text-[42px]">
          Almost there.
        </h1>

        {userEmail && (
          <p className="mt-4 max-w-[420px] text-[15px] leading-6 text-muted-foreground sm:text-base">
            Your AAC membership request is in review. We’ll email you as soon as verification is complete.
          </p>
        )}

        <div className="mt-8 w-full rounded-[28px] border border-border bg-foreground px-5 py-4 text-primary-foreground shadow-custom-lg sm:mt-10">
          <div className="flex items-center justify-center gap-3 text-sm font-semibold sm:text-[15px]">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aacSuccess opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-aacSuccess" />
            </span>
            Verification in progress
          </div>
        </div>

        <p className="mt-6 text-xs font-medium tracking-normal text-muted-foreground">
          Private by design. Agent-verified.
        </p>

        <p className="mt-4 text-xs text-muted-foreground/80">
          Questions? Reach us at{" "}
          <a href="mailto:hello@allagentconnect.com" className="font-medium text-foreground transition-colors hover:text-aac">
            hello@allagentconnect.com
          </a>
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              navigate("/");
            }}
            className="h-10 px-5"
          >
            Home
          </Button>
          {hasSession && (
            <Button
              variant="ghost"
              onClick={handleLogoutToHome}
              className="h-10 px-5 text-muted-foreground hover:text-foreground"
            >
              Log out
            </Button>
          )}
        </div>
      </div>
    </PendingShell>
  );
};

export default PendingVerification;
