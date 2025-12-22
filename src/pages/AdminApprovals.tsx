import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ExternalLink, Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Agent {
  user_id: string;
  agent_status: string;
  license_number: string | null;
  license_state: string | null;
  license_last_name: string | null;
  created_at: string;
  verified_at: string | null;
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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  unverified: "bg-gray-100 text-gray-800",
};

export default function AdminApprovals() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthRole();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  // Fetch all agents
  useEffect(() => {
    async function fetchAgents() {
      if (!isAdmin) return;

      setLoading(true);
      
      const { data: settings, error: settingsError } = await supabase
        .from("agent_settings")
        .select("user_id, agent_status, license_number, license_state, license_last_name, created_at, verified_at")
        .order("created_at", { ascending: false });

      if (settingsError) {
        console.error("Error fetching agents:", settingsError);
        toast.error("Failed to load agents");
        setLoading(false);
        return;
      }

      if (!settings || settings.length === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all agents
      const userIds = settings.map((s) => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const agentsWithProfiles: Agent[] = settings.map((s) => ({
        ...s,
        profile: profileMap.get(s.user_id) || null,
      }));

      setAgents(agentsWithProfiles);
      setLoading(false);
    }

    if (isAdmin) {
      fetchAgents();
    }
  }, [isAdmin]);

  const handleApprove = async (userId: string, email: string, firstName: string) => {
    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
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

      const { error: emailError } = await supabase.functions.invoke(
        "send-agent-approval-email",
        { body: { userId, email, firstName, approved: true } }
      );

      if (emailError) {
        console.error("Error sending approval email:", emailError);
      }

      toast.success(`${firstName} has been approved!`);
      setAgents((prev) => prev.map((a) => 
        a.user_id === userId 
          ? { ...a, agent_status: "verified", verified_at: new Date().toISOString() }
          : a
      ));
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
      const { error: updateError } = await supabase
        .from("agent_settings")
        .update({ agent_status: "rejected" })
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      const { error: emailError } = await supabase.functions.invoke(
        "send-agent-approval-email",
        { body: { userId, email, firstName, approved: false } }
      );

      if (emailError) {
        console.error("Error sending rejection email:", emailError);
      }

      toast.success(`${firstName} has been rejected`);
      setAgents((prev) => prev.map((a) => 
        a.user_id === userId 
          ? { ...a, agent_status: "rejected" }
          : a
      ));
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

  const filteredAgents = agents.filter((agent) => {
    if (statusFilter === "all") return true;
    return agent.agent_status === statusFilter;
  });

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
            <h1 className="text-3xl font-bold text-foreground">Agent Management</h1>
          </div>
          <p className="text-muted-foreground">
            View and manage all agent verification requests
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {filteredAgents.length} of {agents.length} agents
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No agents found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>License #</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => {
                  const isProcessing = processingIds.has(agent.user_id);
                  const licenseUrl = agent.license_state 
                    ? stateLicenseLookupUrls[agent.license_state] 
                    : null;
                  const stateName = agent.license_state 
                    ? stateNames[agent.license_state] || agent.license_state 
                    : "—";

                  return (
                    <TableRow key={agent.user_id}>
                      <TableCell className="font-medium">
                        {agent.profile?.first_name} {agent.profile?.last_name || agent.license_last_name}
                      </TableCell>
                      <TableCell>{agent.profile?.email || "—"}</TableCell>
                      <TableCell>
                        {agent.license_number ? (
                          <div className="flex items-center gap-1">
                            {agent.license_number}
                            {licenseUrl && (
                              <a 
                                href={licenseUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{stateName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={statusColors[agent.agent_status] || statusColors.unverified}
                        >
                          {agent.agent_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(agent.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.agent_status === "pending" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(
                                agent.user_id,
                                agent.profile?.email || "",
                                agent.profile?.first_name || "Agent"
                              )}
                              disabled={isProcessing}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(
                                agent.user_id,
                                agent.profile?.email || "",
                                agent.profile?.first_name || "Agent"
                              )}
                              disabled={isProcessing}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
