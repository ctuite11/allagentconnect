import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { CheckCircle2, Loader2 } from "lucide-react";

const ClientInvitationSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const invitationToken = searchParams.get("invitation_token") || "";
  const initialEmail = searchParams.get("email") || "";
  const agentId = searchParams.get("agent_id") || "";
  const clientId = searchParams.get("client_id") || "";
  
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [agentFirstName, setAgentFirstName] = useState<string>("");
  const isEmailLocked = !!initialEmail;

  // Validate token and fetch agent info on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!invitationToken) {
        toast.error("Invalid invitation link");
        setIsValidatingToken(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("share_tokens")
          .select("*")
          .eq("token", invitationToken)
          .maybeSingle();

        if (error || !data) {
          toast.error("This invitation link is invalid or has expired");
          setTokenValid(false);
        } else if (data.accepted_at) {
          toast.info("This invitation has already been used");
          setTokenValid(false);
        } else {
          setTokenValid(true);
          
          // Fetch agent info
          if (agentId) {
            const { data: agentData } = await supabase
              .from("agent_profiles")
              .select("first_name")
              .eq("id", agentId)
              .maybeSingle();
            
            if (agentData) {
              setAgentFirstName(agentData.first_name);
            }
          }
        }
      } catch (error) {
        console.error("Token validation error:", error);
        toast.error("Unable to validate invitation");
        setTokenValid(false);
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [invitationToken, agentId]);

  const handleActivation = async () => {
    // Validation
    if (!email || !email.trim()) {
      toast.error("Please enter your email to continue.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        toast.error("An account with this email already exists. Please log in instead.");
        setIsSubmitting(false);
        navigate(`/auth?redirect=/client-hot-sheet/${invitationToken}`);
        return;
      }

      // Create the account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/client-hot-sheet/${invitationToken}`,
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Account creation failed");
      }

      // Assign buyer role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "buyer",
        });

      if (roleError) {
        console.error("Error assigning buyer role:", roleError);
        // Don't fail the whole process if this fails
      }

      // Check for existing active relationship
      if (agentId) {
        const { data: existingRel } = await supabase
          .from("client_agent_relationships")
          .select("agent_id")
          .eq("client_id", authData.user.id)
          .eq("status", "active")
          .maybeSingle();

        // Create relationship with appropriate status
        const { error: relationshipError } = await supabase
          .from("client_agent_relationships")
          .insert({
            client_id: authData.user.id,
            agent_id: agentId,
            invitation_token: invitationToken,
            status: existingRel ? "pending" : "active",
          });

        if (relationshipError) {
          console.error("Error creating relationship:", relationshipError);
          // Don't fail the whole process if this fails
        }
      }

      // Mark token as accepted
      const { error: tokenUpdateError } = await supabase
        .from("share_tokens")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: authData.user.id,
        })
        .eq("token", invitationToken);

      if (tokenUpdateError) {
        console.error("Error updating token:", tokenUpdateError);
        // Don't fail the whole process if this fails
      }

      // Show success phase
      setPhase("success");
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate(`/client-hot-sheet/${invitationToken}`);
      }, 2000);

    } catch (error: any) {
      console.error("Activation error:", error);
      toast.error(error.message || "Failed to activate account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl text-destructive">Invalid Invitation</CardTitle>
              <CardDescription>
                This invitation link is invalid, has expired, or has already been used.
                {agentFirstName ? ` Please contact ${agentFirstName} for a new invitation.` : " Please contact your agent for a new invitation."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")}>Return Home</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {phase === "form" && (
            <Card className="shadow-lg">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl">Create Your Secure Login</CardTitle>
                <CardDescription className="text-base pt-2">
                  We've pre-loaded your account using {agentFirstName ? `${agentFirstName}'s` : "your agent's"} invitation.
                  All you need to do now is create a password to activate your access.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-8 pt-0">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleActivation();
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      readOnly={isEmailLocked}
                      className={isEmailLocked ? "bg-muted" : ""}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    {isEmailLocked && (
                      <p className="text-xs text-muted-foreground">
                        Email provided by {agentFirstName || "your agent"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      minLength={6}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      minLength={6}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      "Activate My Account"
                    )}
                  </Button>

                  <p className="mt-4 text-xs text-muted-foreground text-center">
                    By clicking Activate My Account, you agree to All Agent Connect's{" "}
                    <a href="/terms" className="underline">Terms of Use</a> and{" "}
                    <a href="/privacy" className="underline">Privacy Policy</a> and consent to
                    receive communications about your home search from {agentFirstName || "your agent"} and All
                    Agent Connect. You can opt out at any time. Property information is deemed
                    reliable but not guaranteed and is subject to change without notice.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}

          {phase === "success" && (
            <Card className="shadow-lg text-center">
              <CardContent className="p-10 space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">You're All Set</h2>
                  <p className="text-base text-muted-foreground max-w-md mx-auto">
                    Your All Agent Connect account is now active.
                    Your personalized home search is ready whenever you are.
                  </p>
                </div>

                <Button
                  onClick={() => navigate(`/client-hot-sheet/${invitationToken}`)}
                  size="lg"
                  className="w-full max-w-xs mx-auto h-12"
                >
                  View My Hot Sheet
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ClientInvitationSetup;
