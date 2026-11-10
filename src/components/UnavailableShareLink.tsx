import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthRole } from "@/hooks/useAuthRole";
import { privacyRpc } from "@/lib/privacyApi";
import { Seo } from "@/components/Seo";

export function UnavailableShareLink({ token }: { token?: string }) {
  const { user } = useAuthRole();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = async () => {
    if (!token || busy) return;
    setBusy(true); setFailed(false);
    try { await privacyRpc("request_new_listing_share_link", { p_token: token }); setRequested(true); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
    <Seo title="Private shared link" description="Secure access through All Agent Connect." noindex />
    <h1 className="text-2xl font-semibold">This link is no longer available.</h1>
    <p className="text-muted-foreground">Ask your agent for a new link.</p>
    {user && token && /^[0-9a-f]{64}$/.test(token) && <Button disabled={busy || requested} onClick={() => void request()}>
      {requested ? "Request received" : busy ? "Requesting…" : "Request new link"}
    </Button>}
    {failed && <p role="alert">The request could not be completed. Please try again.</p>}
    {!user && <Button variant="outline" asChild><Link to="/auth">Sign in</Link></Button>}
  </main>;
}
