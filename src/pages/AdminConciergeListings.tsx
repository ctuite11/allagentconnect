import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { listConciergeDrafts, type ConciergeDraftSummary } from "@/lib/conciergeListing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin-only "Create Listing for Agent" (concierge) workspace.
 *
 * AAC staff prepare a listing on behalf of an existing verified + activated
 * member. The listing is owned by the member and always saved as a Draft —
 * the member reviews and publishes it from their own account. No account,
 * login, or credential information is shown or used here.
 */

interface EligibleAgent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  agent_status: string;
  account_activated_at: string | null;
}

const agentName = (a: EligibleAgent) =>
  [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.email || "Unnamed member";

const AdminConciergeListings = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<EligibleAgent[]>([]);
  const [drafts, setDrafts] = useState<ConciergeDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rosterRes, draftRows] = await Promise.all([
          supabase.functions.invoke("admin-list-agents", { body: {} }),
          listConciergeDrafts().catch(() => [] as ConciergeDraftSummary[]),
        ]);
        if (!active) return;
        if (rosterRes.error) throw rosterRes.error;
        const all = ((rosterRes.data as { agents?: EligibleAgent[] })?.agents ?? []).filter(
          (a) =>
            (a.agent_status || "").toLowerCase() === "verified" && !!a.account_activated_at,
        );
        setAgents(all);
        setDrafts(draftRows);
      } catch (err: any) {
        if (active) toast.error(err?.message || "Could not load the member list");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents.slice(0, 25);
    return agents
      .filter((a) =>
        [agentName(a), a.email ?? "", a.company ?? ""].some((v) => v.toLowerCase().includes(q)),
      )
      .slice(0, 25);
  }, [agents, search]);

  const nameFor = (agentId: string) => {
    const a = agents.find((x) => x.id === agentId);
    return a ? agentName(a) : "Member";
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Create a listing for a member
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Enter a listing on behalf of a member who asked us to add it for them. It is saved as a
        draft under their account — they review and publish it themselves.
      </p>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members by name, email, or brokerage..."
              className="pl-9"
              aria-label="Search members"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No matching members.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {filtered.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{agentName(a)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[a.company, a.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/admin/concierge-listings/new?agent=${a.id}`)}
                  >
                    <Plus className="h-4 w-4" />
                    Create listing
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Drafts we have entered</h2>
      <Card className="mt-3">
        <CardContent className="pt-6">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No concierge drafts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {[d.address, d.city, d.state].filter(Boolean).join(", ") || "Untitled draft"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      For {nameFor(d.agent_id)} · Entered by AAC staff
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Draft</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/concierge-listings/${d.id}`)}
                    >
                      Continue
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminConciergeListings;
