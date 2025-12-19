import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Clock, CheckCircle2, LogOut, Edit } from "lucide-react";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "Washington D.C." }
];

type PageState = "loading" | "form" | "pending" | "verified";

const OnboardingVerifyLicense = () => {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [licenseLastName, setLicenseLastName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string | null>(null);
  const didNavigate = useRef(false);

  useEffect(() => {
    const checkState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/auth", { replace: true });
        }
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || null);

      // Check if agent profile exists
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id, first_name, last_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!agentProfile) {
        // No profile - redirect to create account
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/onboarding/create-account", { replace: true });
        }
        return;
      }

      // Store first name for email
      if (agentProfile.first_name) {
        setUserFirstName(agentProfile.first_name);
      }

      // Pre-fill last name from profile
      if (agentProfile.last_name) {
        setLicenseLastName(agentProfile.last_name);
      }

      // Check current status
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status, license_number, license_state, license_last_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const status = settings?.agent_status || 'unverified';

      if (status === 'verified') {
        // Already verified - go to dashboard
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate("/agent-dashboard", { replace: true });
        }
        return;
      }

      if (status === 'pending') {
        // Pre-fill from existing data for "Update License Info"
        if (settings?.license_number) {
          setLicenseNumber(settings.license_number);
        }
        if (settings?.license_state) {
          setLicenseState(settings.license_state);
        }
        if (settings?.license_last_name) {
          setLicenseLastName(settings.license_last_name);
        }
        setPageState("pending");
        return;
      }

      // Pre-fill license info if exists
      if (settings?.license_number) {
        setLicenseNumber(settings.license_number);
      }
      if (settings?.license_state) {
        setLicenseState(settings.license_state);
      }

      setPageState("form");
    };

    checkState();
  }, [navigate]);

  const sendVerificationEmail = async () => {
    if (!userEmail) return;
    
    try {
      await supabase.functions.invoke('send-verification-submitted', {
        body: {
          email: userEmail,
          firstName: userFirstName || 'Agent',
          lastName: licenseLastName,
          licenseState: licenseState,
        }
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Don't block the flow if email fails
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      toast.error("Session expired. Please sign in again.");
      navigate("/auth", { replace: true });
      return;
    }

    if (!licenseNumber.trim() || !licenseState || !licenseLastName.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('agent_settings')
        .update({
          license_number: licenseNumber.trim(),
          license_state: licenseState,
          license_last_name: licenseLastName.trim(),
          agent_status: 'pending',
          last_verification_attempt_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Send confirmation email
      await sendVerificationEmail();

      toast.success("Verification submitted! We'll email you when your license is approved.");
      setPageState("pending");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLicenseInfo = () => {
    setPageState("form");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  // Get state label for display
  const getStateLabel = (stateCode: string) => {
    return US_STATES.find(s => s.value === stateCode)?.label || stateCode;
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pageState === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Thanks — Your License is in Review
              </h1>
              <p className="text-muted-foreground">
                {licenseState === 'MA' 
                  ? "Massachusetts verifications are typically completed within 24 hours."
                  : "Verifications are typically completed within 24 hours."
                }
              </p>
            </div>

            {/* What happens next */}
            <div className="bg-muted/50 rounded-lg p-5 mb-6">
              <h2 className="font-medium text-foreground mb-3">What happens next:</h2>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Our team reviews your license information</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    We verify with the {licenseState ? getStateLabel(licenseState) : 'state'} licensing board
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">You'll receive an email when you're approved</span>
                </li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button 
                onClick={handleUpdateLicenseInfo} 
                variant="outline" 
                className="w-full"
              >
                <Edit className="mr-2 h-4 w-4" />
                Update License Info
              </Button>
              <Button 
                onClick={handleLogout} 
                variant="ghost" 
                className="w-full text-muted-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Verify Your License
            </h1>
            <p className="text-muted-foreground text-sm">
              AllAgentConnect is an agent-only network. Please provide your real estate license information.
            </p>
          </div>

          <form onSubmit={handleSubmitVerification} className="space-y-4">
            <div>
              <Label htmlFor="licenseState">License State</Label>
              <Select value={licenseState} onValueChange={setLicenseState}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                type="text"
                placeholder="Enter your license number"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="licenseLastName">Last Name (as on license)</Label>
              <Input
                id="licenseLastName"
                type="text"
                placeholder="Last name on license"
                value={licenseLastName}
                onChange={(e) => setLicenseLastName(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit for Verification"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <Button onClick={handleLogout} variant="ghost" className="w-full text-muted-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingVerifyLicense;
