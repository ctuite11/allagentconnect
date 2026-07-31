import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Mail } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email();

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
}

interface HotSheetSubscribersSectionProps {
  hotSheetId: string;
}

export function HotSheetSubscribersSection({ hotSheetId }: HotSheetSubscribersSectionProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adding, setAdding] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    const { data, error } = await supabase
      .from("hot_sheet_subscribers")
      .select("id, email, first_name, last_name, status, created_at")
      .eq("hot_sheet_id", hotSheetId)
      .order("created_at", { ascending: false });

    if (!error && data) setSubscribers(data);
    setLoading(false);
  }, [hotSheetId]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  const handleAdd = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    setEmailError(null);

    if (!emailSchema.safeParse(trimmedEmail).success) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setAdding(true);
    try {
      // Check for existing subscriber (exact match on lowercase email)
      const { data: existing } = await supabase
        .from("hot_sheet_subscribers")
        .select("id, status")
        .eq("hot_sheet_id", hotSheetId)
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (existing && existing.status === "active") {
        toast.info("This email is already subscribed");
        setAdding(false);
        return;
      }

      if (existing && existing.status !== "active") {
        // Re-activate
        const { error } = await supabase
          .from("hot_sheet_subscribers")
          .update({
            status: "active",
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            unsubscribed_at: null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new — no agent_id; RLS derives ownership from hot_sheets.user_id
        const { error } = await supabase
          .from("hot_sheet_subscribers")
          .insert({
            hot_sheet_id: hotSheetId,
            email: trimmedEmail,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
          });

        if (error) throw error;
      }

      // Baseline existing matches so a new/reactivated subscriber does not
      // receive the full open backlog on the next send-new-match-notification
      // pass. Best-effort: never fail the add if baselining fails.
      try {
        const { error: baselineErr } = await supabase.functions.invoke(
          "process-hot-sheet",
          { body: { hotSheetId, baselineOnly: true } },
        );
        if (baselineErr) {
          console.warn("[HotSheetSubscribersSection] baseline invoke failed:", baselineErr);
        }
      } catch (baselineEx) {
        console.warn("[HotSheetSubscribersSection] baseline threw:", baselineEx);
      }

      toast.success("Friend added! They'll receive email updates for new matches.");
      setEmail("");
      setFirstName("");
      setLastName("");
      fetchSubscribers();
    } catch (err: any) {
      console.error("Add subscriber error:", err);
      toast.error(err?.message || "Failed to add subscriber");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase
      .from("hot_sheet_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to remove subscriber");
    } else {
      toast.success("Subscriber removed");
      fetchSubscribers();
    }
  };

  const activeCount = subscribers.filter(s => s.status === "active").length;

  return (
    <Card className="mb-8" id="hot-sheet-add-friend">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5" />
          Share This Hot Sheet
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Send listing updates to anyone by email. No login required.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Add form */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="sub_email">Email *</Label>
            <Input
              id="sub_email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              placeholder="jane@example.com"
              className="h-10"
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="w-full sm:w-32 space-y-1.5">
            <Label htmlFor="sub_first">First name</Label>
            <Input
              id="sub_first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              className="h-10"
            />
          </div>
          <div className="w-full sm:w-32 space-y-1.5">
            <Label htmlFor="sub_last">Last name</Label>
            <Input
              id="sub_last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              className="h-10"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={adding || !email.trim()}
            className="h-10 whitespace-nowrap"
          >
            <Mail className="h-4 w-4 mr-2" />
            {adding ? "Adding..." : "Add Friend"}
          </Button>
        </div>

        {/* Subscriber list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : subscribers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No email subscribers yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              {activeCount} active subscriber{activeCount !== 1 ? "s" : ""}
            </p>
            {subscribers.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {[sub.first_name, sub.last_name].filter(Boolean).join(" ") || sub.email}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        sub.status === "active"
                          ? "text-emerald-700 bg-emerald-50 border-0 text-[10px]"
                          : "text-muted-foreground bg-muted border-0 text-[10px]"
                      }
                    >
                      {sub.status === "active" ? "Active" : "Unsubscribed"}
                    </Badge>
                  </div>
                  {(sub.first_name || sub.last_name) && (
                    <p className="text-xs text-muted-foreground truncate">{sub.email}</p>
                  )}
                </div>
                {sub.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(sub.id)}
                    className="text-destructive hover:text-destructive h-8 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
