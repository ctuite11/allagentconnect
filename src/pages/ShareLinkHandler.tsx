import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

const ShareLinkHandler = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!token) {
        setError("This link is invalid or has expired.");
        return;
      }

      try {
        const { data: rpcData, error: queryError } = await supabase
          .rpc('resolve_share_token', { _token: token });
        const data = (rpcData ?? null) as
          | {
              agent_id?: string | null;
              expires_at?: string | null;
              revoked_at?: string | null;
            }
          | null;

        if (queryError || !data) {
          setError("This link is no longer available. Please contact your agent.");
          return;
        }

        // Revoked tokens (e.g. buyer was removed before accepting the invite)
        if (data.revoked_at) {
          setError("This link is no longer available. Please contact your agent.");
          return;
        }

        // Check if token is expired
        const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
        
        if (isExpired) {
          setError("This link is no longer available. Please contact your agent.");
          return;
        }

        if (data.agent_id) {
          // Set cookie for 90 days (7776000 seconds)
          document.cookie = `primary_agent_id=${data.agent_id}; path=/; max-age=7776000`;
          // Also store in localStorage
          localStorage.setItem("primary_agent_id", data.agent_id);
        }

        // Redirect to main page
        navigate("/");
      } catch (err) {
        console.error("Error validating token:", err);
        setError("This link is invalid or has expired.");
      }
    };

    validateAndRedirect();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return <AacMonogramLoader variant="fullscreen" message="Validating link…" />;
};

export default ShareLinkHandler;
