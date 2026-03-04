import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, LogIn } from "lucide-react";

export default function AcceptBuyerWorkspaceInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "needs_auth" | "accepting" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Missing invite token.");
      return;
    }
    checkAuthAndAccept();
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
    setStatus("accepting");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke(
      "accept-buyer-workspace-invite",
      {
        body: { token },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }
    );

    if (error || !data?.success) {
      setStatus("error");
      setErrorMsg(data?.error || error?.message || "Failed to accept invite");
      return;
    }

    setOwnerName(data.ownerName || "your friend");
    setStatus("success");
    toast.success(`You've joined ${data.ownerName || "your friend"}'s workspace!`);

    // Redirect after a short delay
    setTimeout(() => {
      navigate("/client/dashboard");
    }, 2000);
  };

  if (status === "loading" || status === "accepting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">
            {status === "accepting" ? "Joining workspace..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "needs_auth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>You've been invited!</CardTitle>
            <CardDescription>
              Sign in or create an account to join your friend's home search.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/accept-buyer-workspace-invite?token=${token}`)}`)}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/auth?mode=register&redirect=${encodeURIComponent(`/accept-buyer-workspace-invite?token=${token}`)}`)}
            >
              Create Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Invite Error</CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/client/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // success
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>You're in!</CardTitle>
          <CardDescription>
            You've joined {ownerName}'s workspace. You'll now share favorites, hot sheets, and saved searches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Redirecting to your dashboard...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
