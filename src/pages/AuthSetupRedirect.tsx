import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";

/**
 * Brand-domain redirector for password/magic-link setup emails.
 *
 * Approval emails render a CTA on https://allagentconnect.com/auth/setup?next=<base64url>
 * so recipients (and inbox spam filters) see only the brand domain. We decode the
 * `next` parameter here, validate that it points to a *.supabase.co host, then
 * forward the browser to the underlying auth verify URL. We never log the
 * decoded URL or the token it carries.
 */
export default function AuthSetupRedirect() {
  const [params] = useSearchParams();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const next = params.get("next");
    if (!next) {
      setInvalid(true);
      return;
    }
    try {
      // RFC 4648 base64url decode (no padding).
      const b64 = next.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const decoded = decodeURIComponent(escape(atob(padded)));
      const url = new URL(decoded);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
        setInvalid(true);
        return;
      }
      window.location.replace(url.toString());
    } catch {
      setInvalid(true);
    }
  }, [params]);

  if (invalid) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-sm text-neutral-500">Opening your account…</p>
    </div>
  );
}