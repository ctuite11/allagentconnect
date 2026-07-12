import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

interface Props {
  userId: string | null;
  isVerifiedAgent: boolean;
}

type Status =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "member"; teamId: string }
  | { kind: "pending"; teamId: string };

const TeamAccountCTA = ({ userId, isVerifiedAgent }: Props) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setStatus({ kind: "none" });
        return;
      }
      // Accepted membership (any team)
      const { data: mem } = await supabase
        .from("team_members")
        .select("team_id,status")
        .eq("agent_id", userId)
        .eq("status", "accepted")
        .maybeSingle();
      if (cancelled) return;
      if (mem?.team_id) {
        setStatus({ kind: "member", teamId: mem.team_id });
        return;
      }
      // Pending team the user created
      const { data: pending } = await supabase
        .from("teams")
        .select("id")
        .eq("created_by", userId)
        .eq("status", "pending")
        .maybeSingle();
      if (cancelled) return;
      if (pending?.id) {
        setStatus({ kind: "pending", teamId: pending.id });
        return;
      }
      setStatus({ kind: "none" });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!isVerifiedAgent || !userId || status.kind === "loading") return null;

  return (
    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Users className="h-4 w-4" />
        </div>
        <div className="text-sm">
          {status.kind === "none" && (
            <>
              <p className="font-medium">Have a team?</p>
              <p className="text-muted-foreground">
                Get a shared public Team Profile while keeping your individual agent profile.
              </p>
            </>
          )}
          {status.kind === "pending" && (
            <>
              <p className="font-medium">Team Account request pending review</p>
              <p className="text-muted-foreground">
                An admin will review your request shortly.
              </p>
            </>
          )}
          {status.kind === "member" && (
            <>
              <p className="font-medium">You’re part of a Team Account</p>
              <p className="text-muted-foreground">
                Manage your shared Team Profile and members.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {status.kind === "none" && (
          <Button onClick={() => navigate("/team/request")}>Create a Team Account</Button>
        )}
        {status.kind === "pending" && (
          <Button variant="outline" onClick={() => navigate(`/team/${status.teamId}/manage`)}>
            View request
          </Button>
        )}
        {status.kind === "member" && (
          <Button variant="outline" onClick={() => navigate(`/team/${status.teamId}/manage`)}>
            Manage Team Account
          </Button>
        )}
      </div>
    </div>
  );
};

export default TeamAccountCTA;