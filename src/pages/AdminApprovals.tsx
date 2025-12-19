import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ExternalLink, User, Mail, Shield } from "lucide-react";

interface PendingAgent {
  user_id: string;
  license_number: string | null;
  license_state: string | null;
  license_last_name: string | null;
  created_at: string;
  profile: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

const stateLicenseLookupUrls: Record<string, string> = {
  MA: "https://www.mass.gov/orgs/board-of-registration-of-real-estate-brokers-and-salespersons",
  CT: "https://www.elicense.ct.gov/",
  RI: "https://dbr.ri.gov/divisions/commercial-licensing",
  NH: "https://www.oplc.nh.gov/real-estate-commission",
  ME: "https://www.maine.gov/pfr/professionallicensing/",
  VT: "https://sos.vermont.gov/opr/",
  NY: "https://appext20.dos.ny.gov/nydos/selSearchType.do",
  NJ: "https://newjersey.mylicense.com/verification/",
  PA: "https://www.pals.pa.gov/",
};

const stateNames: Record<string, string> = {
  MA: "Massachusetts",
  CT: "Connecticut",
  RI: "Rhode Island",
  NH: "New Hampshire",
  ME: "Maine",
  VT: "Vermont",
  NY: "New York",
  NJ: "New Jersey",
  PA: "Pennsylvania",
};

export default function AdminApprovals() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthRole();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Check if user is admin
  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    }

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  // Fetch pending agents
  useEffect(() => {
    async function fetchPendingAgents() {
      if (!isAdmin) return;

      setLoading(true);
      
      const { data: settings, error: settingsError } = await supabase
        .from("agent_settings")
        .select("user_id, license_number, license_state, license_last_name, created_at")
        .eq("agent_status", "pending");

      if (settingsError) {
        console.error("Error fetching pending agents:", settingsError);
        toast.error("Failed to load pending agents");
        setLoading(false);
        return;
      }

      if (!settings || settings.length === 0) {
        setPendingAgents([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all pending agents
      const userIds = settings.map((s) => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const agentsWithProfiles: PendingAgent[] = settings.map((s) => ({
        ...s,
        profile: profileMap.get(s.user_id) || null,
      }));

      setPendingAgents(agentsWithProfiles);
      setLoading(false);
    }

    if (isAdmin) {
      fetchPendingAgents();
    }
  }, [isAdmin]);

  const handleApprove = async (userId: string, email: string, firstName: string) => {
    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      // Update agent_status to 'verified'
      const { error: updateError } = await supabase
        .from("agent_settings")
        .update({ 
          agent_status: "verified",
          verified_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      // Send approval email
      const { error: emailError } = await supabase.functions.invoke(
        "send-agent-approval-email",
        { body: { userId, email, firstName, approved: true } }
      );

      if (emailError) {
        console.error("Error sending approval email:", emailError);
        // Don't fail the approval if email fails
      }

      toast.success(`${firstName} has been approved!`);
      setPendingAgents((prev) => prev.filter((a) => a.user_id !== userId));
    } catch (error: any) {
      console.error("Error approving agent:", error);
      toast.error("Failed to approve agent");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleReject = async (userId: string, email: string, firstName: string) => {
    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      // Update agent_status to 'rejected'
      const { error: updateError } = await supabase
        .from("agent_settings")
        .update({ agent_status: "rejected" })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      // Send rejection email
      const { error: emailError } = await supabase.functions.invoke(
        "send-agent-approval-email",
        { body: { userId, email, firstName, approved: false } }
      );

      if (emailError) {
        console.error("Error sending rejection email:", emailError);
      }

      toast.success(`${firstName} has been rejected`);
      setPendingAgents((prev) => prev.filter((a) => a.user_id !== userId));
    } catch (error: any) {
      console.error("Error rejecting agent:", error);
      toast.error("Failed to reject agent");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (authLoading || isAdmin === null) {
    return <LoadingScreen />;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Agent Approvals</h1>
          </div>
          <p className="text-muted-foreground">
            Review and approve pending agent verification requests
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : pendingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No pending verification requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingAgents.map((agent) => {
              const isProcessing = processingIds.has(agent.user_id);
              const licenseUrl = agent.license_state 
                ? stateLicenseLookupUrls[agent.license_state] 
                : null;
              const stateName = agent.license_state 
                ? stateNames[agent.license_state] || agent.license_state 
                : "Unknown";

              return (
                <Card key={agent.user_id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {agent.profile?.first_name} {agent.profile?.last_name || agent.license_last_name}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {agent.profile?.email || "No email"}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">License Number</p>
                        <p className="font-medium">{agent.license_number || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">State</p>
                        <p className="font-medium">{stateName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Name on License</p>
                        <p className="font-medium">{agent.license_last_name || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                        <p className="font-medium">
                          {new Date(agent.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
                      {licenseUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={licenseUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Verify {stateName} License
                          </a>
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(
                          agent.user_id,
                          agent.profile?.email || "",
                          agent.profile?.first_name || "Agent"
                        )}
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(
                          agent.user_id,
                          agent.profile?.email || "",
                          agent.profile?.first_name || "Agent"
                        )}
                        disabled={isProcessing}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
