import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, Users } from "lucide-react";

interface Invite {
  id: string;
  token: string;
  buyer_email: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
}

export function PendingInvitesCard() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Resolve workspace
    const { data: ws } = await supabase
      .from("buyer_workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!ws) {
      setLoading(false);
      return;
    }

    setWorkspaceId(ws.id);

    const { data, error } = await supabase
      .from("buyer_workspace_invites")
      .select("id, token, buyer_email, buyer_first_name, buyer_last_name, created_at, expires_at, accepted_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setInvites(data as Invite[]);
    }
    setLoading(false);
  };

  const getStatus = (invite: Invite): "pending" | "accepted" | "expired" => {
    if (invite.accepted_at) return "accepted";
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return "expired";
    return "pending";
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/accept-buyer-workspace-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const handleRevoke = async (inviteId: string) => {
    const { error } = await supabase
      .from("buyer_workspace_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      toast.error("Failed to revoke invite");
      return;
    }
    toast.success("Invite revoked");
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleResend = async (inviteId: string, extend = false) => {
    try {
      setResendingId(inviteId);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("resend-buyer-workspace-invite", {
        body: { inviteId, extend },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Failed to resend invite");
        return;
      }

      toast.success(extend ? "Invite resent & extended" : "Invite resent");

      // Refresh list after every successful resend to reflect latest state
      await loadInvites();
    } finally {
      setResendingId(null);
    }
  };

  if (loading) return null;
  if (!workspaceId || invites.length === 0) return null;

  return (
    <SectionCard
      title="Shared With"
      icon={<Users />}
      description="People you've invited to your home search"
    >
      <div className="space-y-3">
        {invites.map((invite) => {
          const status = getStatus(invite);
          const name = [invite.buyer_first_name, invite.buyer_last_name].filter(Boolean).join(" ");
          const isResending = resendingId === invite.id;

          return (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {name || invite.buyer_email}
                  </span>
                  <Badge
                    variant={status === "accepted" ? "default" : status === "expired" ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {status === "accepted" ? "Joined" : status === "expired" ? "Expired" : "Pending"}
                  </Badge>
                </div>
                {name && (
                  <p className="text-xs text-muted-foreground truncate">{invite.buyer_email}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sent {new Date(invite.created_at).toLocaleDateString()}
                </p>
              </div>

              {status === "pending" && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleCopyLink(invite.token)}
                    title="Copy invite link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleResend(invite.id)}
                    disabled={isResending}
                    title="Resend invite"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(invite.id)}
                    title="Revoke invite"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {status === "expired" && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleResend(invite.id, true)}
                    disabled={isResending}
                    title="Resend and extend invite by 30 days"
                  >
                    <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                    Resend + Extend
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
