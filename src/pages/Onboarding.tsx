import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Shield, ArrowRight, Loader2, FileText, User } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

type OnboardingStep = "loading" | "create-profile" | "verify-license" | "pending" | "verified";

const Onboarding = () => {
  const navigate = useNavigate();
  const didNavigate = useRef(false);
  
  const [step, setStep] = useState<OnboardingStep>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Profile creation form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  
  // Verification form state
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [licenseLastName, setLicenseLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveOnboardingState = async () => {
      // 1. Get session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (!session?.user) {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate('/auth', { replace: true });
        }
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || null);

      // 2. Check if agent_profiles row exists
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id, first_name, last_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!agentProfile) {
        // No agent profile - need to create one
        setStep("create-profile");
        return;
      }

      // 3. Check agent_settings for verification status
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status, license_number, license_state, license_last_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!mounted) return;

      // Pre-fill license fields if they exist
      if (settings) {
        setLicenseNumber(settings.license_number || '');
        setLicenseState(settings.license_state || '');
        setLicenseLastName(settings.license_last_name || agentProfile.last_name || '');
      } else {
        setLicenseLastName(agentProfile.last_name || '');
      }

      const status = settings?.agent_status || 'unverified';

      if (status === 'verified') {
        // Already verified - redirect to dashboard
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate('/agent-dashboard', { replace: true });
        }
        return;
      }

      if (status === 'pending') {
        setStep("pending");
        return;
      }

      // Unverified - show license form
      setStep("verify-license");
    };

    resolveOnboardingState();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleCreateProfile = async () => {
    if (!userId || !userEmail) return;
    
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }

    setCreatingProfile(true);

    try {
      const { error } = await supabase
        .from('agent_profiles')
        .insert({
          id: userId,
          email: userEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });

      if (error) throw error;

      // Pre-fill license last name
      setLicenseLastName(lastName.trim());
      setStep("verify-license");
      toast.success("Profile created! Now let's verify your license.");
    } catch (error: any) {
      console.error("Profile creation error:", error);
      toast.error(error.message || "Failed to create profile");
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!userId) return;
    
    if (!licenseNumber.trim() || !licenseState || !licenseLastName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      // Ensure agent_settings row exists and update it
      const { data: existingSettings } = await supabase
        .from('agent_settings')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingSettings) {
        // Create settings row first
        await supabase
          .from('agent_settings')
          .insert({ user_id: userId });
      }

      const { error } = await supabase
        .from('agent_settings')
        .update({
          license_number: licenseNumber.trim(),
          license_state: licenseState,
          license_last_name: licenseLastName.trim(),
          agent_status: 'pending',
          last_verification_attempt_at: new Date().toISOString(),
          verification_attempt_count: 1,
        })
        .eq('user_id', userId);

      if (error) throw error;

      setStep("pending");
      toast.success("Verification submitted! We'll review your license shortly.");
    } catch (error: any) {
      console.error("Verification submission error:", error);
      toast.error(error.message || "Failed to submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (!didNavigate.current) {
      didNavigate.current = true;
      navigate('/agent-dashboard', { replace: true });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (!didNavigate.current) {
      didNavigate.current = true;
      navigate('/auth', { replace: true });
    }
  };

  // Loading gate - no UI until state is resolved
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          
          {/* Step 1: Create Profile */}
          {step === "create-profile" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Create Your Profile
                </h1>
                <p className="text-muted-foreground text-sm">
                  Welcome! Let's set up your agent profile.
                </p>
                {userEmail && (
                  <p className="text-muted-foreground text-xs mt-2">{userEmail}</p>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    First Name *
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1.5"
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    Last Name *
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <Button
                  onClick={handleCreateProfile}
                  className="w-full"
                  disabled={creatingProfile || !firstName.trim() || !lastName.trim()}
                >
                  {creatingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
                Sign out
              </Button>
            </>
          )}

          {/* Step 2: Verify License */}
          {step === "verify-license" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Verify Your License
                </h1>
                <p className="text-muted-foreground text-sm">
                  Enter your real estate license details to unlock full platform access.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="licenseLastName" className="text-sm font-medium">
                    Last Name (as on license) *
                  </Label>
                  <Input
                    id="licenseLastName"
                    type="text"
                    placeholder="Smith"
                    value={licenseLastName}
                    onChange={(e) => setLicenseLastName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="licenseNumber" className="text-sm font-medium">
                    License Number *
                  </Label>
                  <Input
                    id="licenseNumber"
                    type="text"
                    placeholder="e.g. 12345678"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="licenseState" className="text-sm font-medium">
                    License State *
                  </Label>
                  <Select value={licenseState} onValueChange={setLicenseState}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSubmitVerification}
                  className="w-full"
                  disabled={submitting || !licenseNumber.trim() || !licenseState || !licenseLastName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Submit for Verification
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                <Button onClick={handleContinue} className="w-full" variant="outline">
                  Skip for Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
                  Sign out
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Pending */}
          {step === "pending" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-8 w-8 text-amber-500" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Verification Pending
                </h1>
                <Badge variant="secondary" className="text-sm">
                  Status: Pending
                </Badge>
              </div>

              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 text-center">
                  Your verification is being reviewed. This typically takes 1-2 business days.
                  You can continue to explore the platform while you wait.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={handleContinue} className="w-full">
                  Continue to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
                  Sign out
                </Button>
              </div>
            </>
          )}

          {/* Step 4: Verified (fallback - should redirect) */}
          {step === "verified" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  You're Verified!
                </h1>
                <Badge variant="default" className="text-sm">
                  Status: Verified
                </Badge>
                <p className="text-sm text-muted-foreground mt-4">
                  You have full access to all platform features.
                </p>
              </div>

              <Button onClick={handleContinue} className="w-full">
                Continue to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
