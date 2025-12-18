import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get session from URL hash (Supabase puts tokens there after magic link click)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AuthCallback] Session error:", sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          console.log("[AuthCallback] Session found, redirecting to /verify-agent");
          navigate("/verify-agent", { replace: true });
          return;
        }

        // No session yet - might be processing the hash
        // Supabase client auto-processes the hash, wait for auth state change
      } catch (err: any) {
        console.error("[AuthCallback] Error:", err);
        setError(err.message || "Authentication failed");
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AuthCallback] Auth state change:", event);
        
        if (event === "SIGNED_IN" && session) {
          navigate("/verify-agent", { replace: true });
        } else if (event === "TOKEN_REFRESHED" && session) {
          navigate("/verify-agent", { replace: true });
        }
      }
    );

    handleAuthCallback();

    return () => {
      subscription.unsubscribe();
    };
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
