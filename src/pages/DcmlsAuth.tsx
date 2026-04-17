import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/Seo";
import AACMonogram from "@/components/ui/AACMonogram";
import { toast } from "sonner";
import { z } from "zod";

const AAC_BLUE = "#0E56F5";

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(100)
    .regex(/[A-Z]/, "Needs an uppercase letter")
    .regex(/[a-z]/, "Needs a lowercase letter")
    .regex(/[0-9]/, "Needs a number"),
  firstName: z.string().trim().min(1, "First name required").max(100),
  lastName: z.string().trim().min(1, "Last name required").max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password required"),
});

const DcmlsAuth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Accept both `redirect` (legacy) and `from` (new). Default destination is /account on DCMLS.
  const redirectTo = params.get("from") || params.get("redirect") || "/account";
  // Accept `mode=signup|signin` (new) and legacy `mode=register`. Default = signin.
  const modeParam = params.get("mode");
  const initialIsLogin = modeParam !== "register" && modeParam !== "signup";

  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    let mounted = true;
    const handleSession = (userId: string | undefined) => {
      if (!mounted || !userId) return;
      navigate(redirectTo, { replace: true });
    };
    supabase.auth.getSession().then(({ data }) => handleSession(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      handleSession(session?.user?.id),
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, redirectTo]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = signUpSchema.parse(form);
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
      if (authData.user) {
        await supabase.from("profiles").insert({
          id: authData.user.id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
        });
        await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "buyer",
        });
        toast.success("Welcome to Direct Connect MLS");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else toast.error(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = loginSchema.parse(form);
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
    } catch (err: any) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else toast.error(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = z.object({ email: z.string().trim().email() }).parse({ email: form.email });
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: data.email,
          redirectUrl: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      toast.success("If an account exists, you'll receive a reset link shortly.");
      setIsForgot(false);
    } catch (err: any) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handler = isForgot ? handleForgot : isLogin ? handleLogin : handleSignUp;

  return (
    <>
      <Seo
        title={isLogin ? "Sign In — Direct Connect MLS" : "Create Account — Direct Connect MLS"}
        description="Sign in to save homes and create saved searches on Direct Connect MLS."
        canonical="https://directconnectmls.com/auth"
      />
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2.5" style={{ color: AAC_BLUE }}>
              <AACMonogram className="w-7 h-7" />
              <span
                className="font-semibold tracking-tight text-foreground text-[15px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Direct Connect <span style={{ color: AAC_BLUE }}>MLS</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-3">
                {isForgot
                  ? "Reset your password"
                  : isLogin
                  ? "Welcome back"
                  : "Create your account"}
              </h1>
              <p className="text-muted-foreground">
                {isForgot
                  ? "Enter your email and we'll send a reset link."
                  : isLogin
                  ? "Sign in to access your saved homes and searches."
                  : "Save homes and get notified when new matches hit the network."}
              </p>
            </div>

            <form onSubmit={handler} className="space-y-5">
              {!isLogin && !isForgot && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              {!isForgot && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  {!isLogin && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      8+ characters with uppercase, lowercase, and a number.
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : isForgot
                  ? "Send reset link"
                  : isLogin
                  ? "Sign in"
                  : "Create account"}
              </Button>

              {isLogin && !isForgot && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-sm text-muted-foreground hover:text-foreground w-full text-center block"
                >
                  Forgot your password?
                </button>
              )}
            </form>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              {isForgot ? (
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="hover:text-foreground"
                >
                  {isLogin
                    ? "New here? Create an account"
                    : "Already have an account? Sign in"}
                </button>
              )}
            </div>

            {/* Buyer benefits — only on signup mode */}
            {!isLogin && !isForgot && (
              <div className="mt-10 pt-8 border-t border-border/50">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 text-center">
                  What your account unlocks
                </p>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground/80">
                  <li>· Save homes</li>
                  <li>· Favorites</li>
                  <li>· Hot Sheets</li>
                  <li>· New listing alerts</li>
                  <li>· Invite your agent</li>
                  <li>· Showing requests</li>
                </ul>
              </div>
            )}

            {/* Secondary agent link — never primary */}
            <div className="mt-10 text-center">
              <Link
                to="/auth"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Are you an agent? Agent sign in →
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default DcmlsAuth;
