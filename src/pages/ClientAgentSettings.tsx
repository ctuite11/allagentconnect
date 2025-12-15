import { useState, useEffect } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Loader2, Mail, Phone, UserX } from "lucide-react";

const ClientAgentSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to view your settings");
      navigate("/auth");
      return;
    }

    loadAgentRelationship(user.id);
  };

  const loadAgentRelationship = async (userId: string) => {
    try {
      setLoading(true);

      // Find active relationship
      const { data: relationship, error: relError } = await supabase
        .from("client_agent_relationships")
        .select("id, agent_id")
        .eq("client_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (relError) throw relError;

      if (relationship) {
        setRelationshipId(relationship.id);

        // Load agent profile
        const { data: agentData, error: agentError } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", relationship.agent_id)
          .maybeSingle();

        if (agentError) throw agentError;
        setAgent(agentData);
      }
    } catch (error: any) {
      console.error("Error loading agent relationship:", error);
      toast.error("Failed to load agent information");
    } finally {
      setLoading(false);
    }
  };

  const handleEndRelationship = async () => {
    if (!relationshipId) return;

    try {
      setEnding(true);

      const { error } = await supabase
        .from("client_agent_relationships")
        .update({
          status: "inactive",
          ended_at: new Date().toISOString(),
        })
        .eq("id", relationshipId);

      if (error) throw error;

      toast.success("Relationship ended successfully");
      setAgent(null);
      setRelationshipId(null);
    } catch (error: any) {
      console.error("Error ending relationship:", error);
      toast.error("Failed to end relationship");
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <PageTitle className="mb-2">My Agent</PageTitle>
            <p className="text-muted-foreground mb-8">
              View and manage your agent relationship
            </p>

            {!agent ? (
              <Card>
                <CardHeader>
                  <CardTitle>No Active Agent</CardTitle>
                  <CardDescription>
                    You currently don't have an active agent relationship on All Agent Connect.
                    You can connect with an agent by accepting their invitation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate("/")}>
                    Browse Properties
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Your Agent</CardTitle>
                  <CardDescription>
                    You're currently working with this agent on All Agent Connect
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Agent Info */}
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={agent.headshot_url || ""} />
                      <AvatarFallback className="text-lg">
                        {agent.first_name?.[0]}{agent.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">
                        {agent.first_name} {agent.last_name}
                      </h3>
                      {agent.title && (
                        <p className="text-sm text-muted-foreground">{agent.title}</p>
                      )}
                      {agent.company && (
                        <p className="text-sm text-muted-foreground">{agent.company}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3">
                    {agent.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${agent.email}`} className="hover:underline">
                          {agent.email}
                        </a>
                      </div>
                    )}
                    {(agent.phone || agent.cell_phone) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${agent.cell_phone || agent.phone}`} className="hover:underline">
                          {agent.cell_phone || agent.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => navigate(`/agent/${agent.id}`)}
                      className="flex-1"
                    >
                      Contact {agent.first_name}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <UserX className="h-4 w-4 mr-2" />
                          End Relationship
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>End Relationship?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to end your relationship with {agent.first_name} {agent.last_name} on All Agent Connect? 
                            You can always connect with a different agent later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleEndRelationship}
                            disabled={ending}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {ending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Ending...
                              </>
                            ) : (
                              "End Relationship"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ClientAgentSettings;
