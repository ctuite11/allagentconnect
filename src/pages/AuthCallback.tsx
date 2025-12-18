import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Guard against double navigation
      if (didNavigate.current) return;

      try {
        // Single source of truth: getSession after URL hash is processed
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AuthCallback] Session error:", sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          console.log("[AuthCallback] Session hydrated, navigating to /verify-agent");
          didNavigate.current = true;
          navigate("/verify-agent", { replace: true });
          return;
        }

        // No session yet - Supabase client auto-processes hash tokens
        // Wait briefly for hash processing, then retry
        setTimeout(async () => {
          if (didNavigate.current) return;
          
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError) {
            setError(retryError.message);
            return;
          }
          
          if (retrySession) {
            console.log("[AuthCallback] Session hydrated on retry, navigating to /verify-agent");
            didNavigate.current = true;
            navigate("/verify-agent", { replace: true });
          } else {
            setError("Unable to complete sign in. Please try again.");
          }
        }, 500);
      } catch (err: any) {
        console.error("[AuthCallback] Error:", err);
        setError(err.message || "Authentication failed");
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Authentication Error
          </h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate("/auth")}
            className="text-primary hover:underline"
          >
            Return to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
