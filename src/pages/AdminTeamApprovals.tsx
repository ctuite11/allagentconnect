import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuthRole } from "@/hooks/useAuthRole";
import { Navigate, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";

type Team = any;

const TABS: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
];

const AdminTeamApprovals = () => {
  const { user, isAdmin, loading } = useAuthRole();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [teams, setTeams] = useState<Team[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });
      setTeams(data || []);
    })();
  }, [status, isAdmin, refreshTick]);

  if (loading) return <div className="min-h-screen pt-20 text-center">Loading...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  async function setTeamStatus(t: Team, next: string, reason?: string) {
    const update: any = { status: next };
    if (next === "approved") {
      update.approved_at = new Date().toISOString();
      update.approved_by = user!.id;
    }
    if (next === "rejected" && reason) update.rejection_reason = reason;
    const { error } = await supabase.from("teams").update(update).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Team ${next}`);
    setRefreshTick((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <PageHeader title="Team Account Approvals" subtitle="Review, approve, and manage Team Accounts." backTo="/admin/approvals" />

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="space-y-4 mt-4">
              {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams in this state.</p>}
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <CardDescription>
                          {team.company || "—"} · slug: {team.slug} · requester role: {team.requester_role || "lead"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{team.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {team.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{team.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      Lead user: {team.team_lead_user_id} · Created by: {team.created_by}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/team/${team.slug || team.id}`)}>Preview profile</Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/team/${team.id}/manage`)}>Open manage</Button>
                      {status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => setTeamStatus(team, "approved")}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            const r = window.prompt("Reason for rejection?");
                            if (r) setTeamStatus(team, "rejected", r);
                          }}>Reject</Button>
                        </>
                      )}
                      {status === "approved" && (
                        <Button size="sm" variant="destructive" onClick={() => setTeamStatus(team, "suspended")}>Suspend</Button>
                      )}
                      {status === "suspended" && (
                        <Button size="sm" onClick={() => setTeamStatus(team, "approved")}>Reactivate</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminTeamApprovals;