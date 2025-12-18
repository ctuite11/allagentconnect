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
import { CheckCircle2, Shield, ArrowRight, Loader2, FileText } from "lucide-react";
import { User } from "@supabase/supabase-js";
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

const VerifyAgent = () => {
  const navigate = useNavigate();
  const didNavigate = useRef(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<string>("unverified");
  
  // Verification form state
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [licenseLastName, setLicenseLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUserAndSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (!session?.user) {
        if (!didNavigate.current) {
          didNavigate.current = true;
          navigate('/auth', { replace: true });
        }
        return;
      }

      setUser(session.user);

      // Fetch agent status and existing verification data from agent_settings
      const { data: settings, error } = await supabase
        .from('agent_settings')
        .select('agent_status, license_number, license_state, license_last_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (mounted) {
        if (error) {
          console.error('Error fetching agent settings:', error);
        }
        
        if (settings) {
          setAgentStatus(settings.agent_status || 'unverified');
          setLicenseNumber(settings.license_number || '');
          setLicenseState(settings.license_state || '');
          setLicenseLastName(settings.license_last_name || '');
        } else {
          // No settings row exists - create one
          const { data: newSettings } = await supabase
            .from('agent_settings')
            .insert({ user_id: session.user.id })
            .select('agent_status, license_number, license_state, license_last_name')
            .single();
          
          if (newSettings) {
            setAgentStatus(newSettings.agent_status || 'unverified');
          }
        }
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        
        if (!session?.user && !didNavigate.current) {
          didNavigate.current = true;
          navigate('/auth', { replace: true });
        }
      }
    );

    loadUserAndSettings();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmitVerification = async () => {
    if (!user) return;
    
    if (!licenseNumber.trim() || !licenseState || !licenseLastName.trim()) {
      toast.error("Please fill in all required fields");
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
          verification_attempt_count: 1,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setAgentStatus('pending');
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

  // Show loading until we have both session and settings
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isVerified = agentStatus === 'verified';
  const isPending = agentStatus === 'pending';
  const isUnverified = agentStatus === 'unverified';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              {isVerified ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : isPending ? (
                <Loader2 className="h-8 w-8 text-amber-500" />
              ) : (
                <Shield className="h-8 w-8 text-primary" />
              )}
            </div>

            <h1 className="text-2xl font-semibold text-foreground mb-2">
              {isVerified
                ? "You're verified!"
                : isPending
                ? "Verification Pending"
                : "Verify Your License"}
            </h1>

            <p className="text-muted-foreground text-sm mb-3">
              {user?.email}
            </p>

            <Badge 
              variant={isVerified ? 'default' : isPending ? 'secondary' : 'outline'}
              className="text-sm"
            >
              Status: {agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}
            </Badge>
          </div>

          {/* Verification Form (only show for unverified) */}
          {isUnverified && (
            <div className="space-y-4 mb-6">
              <p className="text-sm text-muted-foreground text-center">
                Enter your real estate license details to get verified and unlock full platform access.
              </p>

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
          )}

          {/* Pending message */}
          {isPending && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 text-center">
                Your verification is being reviewed. This typically takes 1-2 business days.
                You can continue to explore the platform while you wait.
              </p>
            </div>
          )}

          {/* Verified message */}
          {isVerified && (
            <p className="text-sm text-muted-foreground mb-6 text-center">
              You have full access to all platform features.
            </p>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <Button onClick={handleContinue} className="w-full" variant={isUnverified ? "outline" : "default"}>
              {isUnverified ? "Skip for Now" : "Continue to Dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyAgent;
