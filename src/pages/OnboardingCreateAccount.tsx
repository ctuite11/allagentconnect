import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";

const OnboardingCreateAccount = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    // PRIORITY: Check for recovery context FIRST - bypass all onboarding
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const typeFromHash = hashParams.get('type');
    const typeFromQuery = searchParams.get('type');
    
    // Expanded recovery detection: type=recovery OR recovery tokens present
    const hasRecoveryTokens =
      hashParams.has('access_token') ||
      hashParams.has('refresh_token') ||
      searchParams.has('code');
    
    // FIX: Use OR - detect recovery from type OR from tokens
    const isRecoveryContext =
      typeFromHash === 'recovery' ||
      typeFromQuery === 'recovery' ||
      hasRecoveryTokens;
    
    if (isRecoveryContext) {
      console.log("[OnboardingCreateAccount] Recovery context detected - redirecting to password-reset");
      if (!didNavigate.current) {
        didNavigate.current = true;
        navigate("/password-reset", { replace: true });
      }
      return;
    }

    const checkState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/auth", { replace: true });
        }
        return;
      }

      // CRITICAL: Block recovery sessions from touching onboarding - redirect to password reset
      const isRecoverySession = session.user.recovery_sent_at;
      if (isRecoverySession) {
        console.log("[OnboardingCreateAccount] Recovery session detected - redirecting to password-reset");
        didNavigate.current = true;
        navigate("/password-reset", { replace: true });
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || null);

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (existingProfile) {
        // Profile exists - skip to verify license
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/onboarding/verify-license", { replace: true });
        }
        return;
      }

      setLoading(false);
    };

    checkState();
  }, [navigate, searchParams]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !userEmail) {
      toast.error("Session expired. Please sign in again.");
      navigate("/auth", { replace: true });
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }

    setSubmitting(true);

    try {
      // Create agent profile
      const { error: profileError } = await supabase
        .from('agent_profiles')
        .insert({
          id: userId,
          email: userEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });

      if (profileError) throw profileError;

      // Assign agent role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'agent'
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      toast.success("Profile created successfully!");
      navigate("/onboarding/verify-license", { replace: true });
    } catch (error: any) {
      console.error("Profile creation error:", error);
      toast.error(error.message || "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Create Your Profile
            </h1>
            <p className="text-muted-foreground text-sm">
              Tell us a bit about yourself to get started
            </p>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingCreateAccount;
