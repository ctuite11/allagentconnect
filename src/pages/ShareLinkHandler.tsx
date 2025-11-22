import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
        const { data, error: queryError } = await supabase
          .from('share_tokens')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (queryError || !data) {
          setError("This link is invalid or has expired.");
          return;
        }

        // Check if token is expired
        const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
        
        if (isExpired) {
          setError("This link is invalid or has expired.");
          return;
        }

        // Set cookie for 90 days (7776000 seconds)
        document.cookie = `primary_agent_id=${data.agent_id}; path=/; max-age=7776000`;
        
        // Also store in localStorage
        localStorage.setItem("primary_agent_id", data.agent_id);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Validating link...</p>
      </div>
    </div>
  );
};

export default ShareLinkHandler;
