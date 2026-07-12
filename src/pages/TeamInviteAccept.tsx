import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthRole } from "@/hooks/useAuthRole";

const TeamInviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthRole();
  const [invite, setInvite] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/team/invite/${token}`)}`);
      return;
    }
    (async () => {
      const { data: row } = await supabase
        .from("team_members")
        .select("id, team_id, agent_id, role, status")
        .eq("invite_token", token)
        .maybeSingle();
      if (!row) {
        setLoading(false);
        return;
      }
      setInvite(row);
      const { data: t } = await supabase.from("teams").select("*").eq("id", row.team_id).maybeSingle();
      setTeam(t);
      setLoading(false);
    })();
  }, [token, user, authLoading, navigate]);

  async function accept() {
    if (!invite || !user) return;
    if (invite.agent_id !== user.id) {
      toast.error("This invitation is not for the signed-in account.");
      return;
    }
    setBusy(true);
    try {
      // Enforce one-accepted-team-per-agent client-side with a friendly message.
      const { data: existing } = await supabase
        .from("team_members")
        .select("id, team_id")
        .eq("agent_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();
      if (existing && existing.team_id !== invite.team_id) {
        toast.error("You are already on another team. Leave that team before accepting this invitation.");
        setBusy(false);
        return;
      }
      const { error } = await supabase
        .from("team_members")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      toast.success("You joined the team!");
      navigate(`/team/${team?.slug || team?.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to accept invitation");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!invite || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("team_members")
        .update({ status: "declined" })
        .eq("id", invite.id);
      if (error) throw error;
      toast.success("Invitation declined.");
      navigate("/agent-dashboard");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen pt-20 text-center">Loading invitation...</div>;

  if (!invite || !team) {
    return (
      <div className="min-h-screen pt-20">
        <div className="container mx-auto max-w-md">
          <Card><CardContent className="py-10 text-center">Invitation not found or expired.</CardContent></Card>
        </div>
      </div>
    );
  }

  const status = invite.status as string;

  return (
    <div className="min-h-screen pt-20">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Join {team.name}</CardTitle>
            <CardDescription>
              You have been invited to join {team.name} as {invite.role === "lead" ? "Team Lead" : invite.role === "delegate" ? "Team Delegate" : "Team Member"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {team.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{team.description}</p>}
            {status === "invited" ? (
              <div className="flex gap-3">
                <Button onClick={accept} disabled={busy}>Accept</Button>
                <Button variant="outline" onClick={decline} disabled={busy}>Decline</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Invitation status: <strong>{status}</strong></p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamInviteAccept;