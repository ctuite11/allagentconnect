import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, ArrowLeft, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

const emailSchema = z.string().trim().email("Please enter a valid email address");

type AuthStep = "email" | "link-sent";

const Auth = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Check for existing session on mount
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (session?.user) {
        navigate('/verify-agent');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        
        if (session?.user) {
          console.log('[Analytics] auth_login_success', { user_id: session.user.id });
          navigate('/verify-agent');
        }
      }
    );

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      const validatedEmail = emailSchema.parse(email);

      console.log('[Analytics] auth_magic_link_requested', { email: validatedEmail });

      const { error } = await supabase.auth.signInWithOtp({
        email: validatedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setStep("link-sent");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to send link");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendLink = async () => {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      toast.success("New login link sent to your email");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend link");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setEmail("");
    setStep("email");
    setTimeout(() => emailInputRef.current?.focus(), 0);
  };

  const getEmailDomain = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain?.includes("gmail")) return "gmail";
    if (domain?.includes("outlook") || domain?.includes("hotmail") || domain?.includes("live")) return "outlook";
    if (domain?.includes("yahoo")) return "yahoo";
    return null;
  };

  const openEmailClient = (provider: string) => {
    const urls: Record<string, string> = {
      gmail: "https://mail.google.com",
      outlook: "https://outlook.live.com",
      yahoo: "https://mail.yahoo.com",
    };
    if (urls[provider]) {
      window.open(urls[provider], "_blank");
    }
  };

  const emailProvider = getEmailDomain(email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border relative">
          {step === "email" ? (
            <>
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Sign in to AllAgentConnect
                </h1>
                <p className="text-muted-foreground text-sm">
                  Enter your email and we'll send you a secure login link
                </p>
              </div>

              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoFocus
                    ref={emailInputRef}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send login link"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={handleChangeEmail}
                className="absolute left-6 top-6 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Use a different email"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Check your email
                </h1>
                <p className="text-muted-foreground text-sm">
                  We sent a secure login link to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Click <span className="font-semibold text-foreground">Log In</span> in the email to continue.
                </p>
              </div>

              <div className="space-y-3">
                {emailProvider && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => openEmailClient(emailProvider)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open {emailProvider.charAt(0).toUpperCase() + emailProvider.slice(1)}
                  </Button>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleResendLink}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Resend link"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={handleChangeEmail}
                  >
                    Different email
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-6">
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
