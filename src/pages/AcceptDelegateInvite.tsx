import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { acceptAccountDelegateInvite } from "@/lib/agentDelegatesApi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, UserPlus } from "lucide-react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

export default function AcceptDelegateInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "needs_auth" | "accepting" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [ownerName, setOwnerName] = useState("the account owner");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Missing invite token.");
      return;
    }
    void checkAuthAndAccept();
  }, [token]);

  const checkAuthAndAccept = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus("needs_auth");
      return;
    }
    await acceptInvite();
  };

  const acceptInvite = async () => {
    if (!token) return;
    setStatus("accepting");

    const result = await acceptAccountDelegateInvite(token);
    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error || "Failed to accept invite");
      return;
    }

    setOwnerName(result.owner_display_name || "the account owner");
    setStatus("success");
    toast.success(`You can now act on behalf of ${result.owner_display_name || "this account"}.`);

    setTimeout(() => {
      navigate("/settings");
    }, 2000);
  };

  if (status === "loading" || status === "accepting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <AacMonogramLoader
          variant="section"
          className="min-h-[40vh]"
          message={status === "accepting" ? "Accepting invitation..." : "Loading..."}
        />
      </div>
    );
  }

  if (status === "needs_auth") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You&apos;ve been invited as a delegate</CardTitle>
            <CardDescription>
              Sign in with your agent account to accept this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() =>
                navigate(`/auth?redirect=${encodeURIComponent(`/accept-delegate-invite?token=${token}`)}`)
              }
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invite Error</CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/agent-dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You&apos;re a delegate</CardTitle>
          <CardDescription>
            You can now help manage {ownerName}&apos;s account. Choose which account to act as from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">Redirecting to settings...</p>
        </CardContent>
      </Card>
    </div>
  );
}
