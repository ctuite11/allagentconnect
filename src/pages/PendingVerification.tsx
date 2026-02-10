import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { authDebug, getAgentStatus } from "@/lib/authDebug";
import NetworkGlobe from "@/components/home/NetworkGlobe";
import { AGENT_STATUS } from "@/constants/status";
import { toast } from "sonner";

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
  const didNavigate = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        setLoading(false);
        return;
      }

      const uid = session.user.id;
      const email = session.user.email || null;
      setUserEmail(email);
      setUserId(uid);
      
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
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
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.12, filter: 'saturate(0.5)' }}
        >
          <div className="w-[300px] h-[300px]">
            <NetworkGlobe />
          </div>
        </div>
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-8 md:p-10 text-center">
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 mb-3">
                You're approved.
              </h1>
              <p className="text-zinc-600 text-base mb-6">Taking you in…</p>
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
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

          {/* Globe — muted */}
          <div className="mx-auto mb-8 w-[100px] h-[100px]" style={{ opacity: 0.3 }}>
            <NetworkGlobe variant="static" strokeColor="#94A3B8" />
          </div>

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
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEFAULT — Pending / Unverified (polling)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div 
        className="fixed pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          width: '280px',
          height: '280px',
          background: 'radial-gradient(circle, rgba(5, 150, 105, 0.08) 0%, transparent 60%)',
        }}
      />
      
      <div className="relative z-10 w-full max-w-md text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
          <span className="text-[#0E56F5]">All Agent</span>
          <span className="text-zinc-400"> Connect</span>
        </h1>
        
        <div className="mx-auto mb-8 w-[130px] h-[130px]">
          <NetworkGlobe variant="static" strokeColor="#0E56F5" fillTriangles />
        </div>
        
        <h2 className="text-2xl md:text-3xl font-medium text-zinc-900 mb-3">
          Almost there.
        </h2>
        
        {userEmail && (
          <p className="text-sm text-zinc-600 mb-6">
            We're verifying your account now. You'll receive a confirmation email shortly.
          </p>
        )}

        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full rounded-full bg-zinc-900 text-white py-3.5 text-sm font-medium cursor-default flex items-center justify-center gap-2"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-aacSuccess" />
          Verification in progress
        </button>

        <p className="text-zinc-500 text-[11px] mt-6 tracking-wide">
          Private by design. Agent-verified.
        </p>

        <p className="text-zinc-400 text-xs mt-4">
          Questions? Reach us at{" "}
          <a href="mailto:hello@allagentconnect.com" className="hover:text-aacSuccess transition-colors">
            hello@allagentconnect.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PendingVerification;
