import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserRound } from "lucide-react";
import { IncentiveLeadDialog, type IncentiveType } from "./IncentiveLeadDialog";

interface CompareAgent {
  id: string;
  aac_id: string | null;
  name: string;
  headshot_url: string | null;
  brokerage: string | null;
  service_area: string | null;
}

interface Props {
  type: IncentiveType;
  excludeAgentId: string;
  initialZip?: string | null;
  listingId?: string | null;
  profileBasePath: string;
}

/** Up to 3 other eligible agents, unranked, in random order. Never shows incentive details. */
export function CompareAgentsPanel({ type, excludeAgentId, initialZip, listingId, profileBasePath }: Props) {
  const [zip, setZip] = useState(initialZip ?? "");
  const [activeZip, setActiveZip] = useState<string | null>(initialZip && /^\d{5}$/.test(initialZip) ? initialZip : null);
  const [agents, setAgents] = useState<CompareAgent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [leadFor, setLeadFor] = useState<CompareAgent | null>(null);
  const label = type === "buyer" ? "Buyer" : "Seller";

  useEffect(() => {
    if (!activeZip) return;
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("dcmls-compare-agents", { body: { type, zip: activeZip, exclude_agent_id: excludeAgentId } })
      .then(({ data }) => {
        if (cancelled) return;
        setAgents(((data as { agents?: CompareAgent[] })?.agents ?? []).slice(0, 3));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeZip, type, excludeAgentId]);

  const submitZip = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) {
      setZipError("Please enter a 5-digit ZIP code.");
      return;
    }
    setZipError(null);
    setActiveZip(z);
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Compare with other agents serving this area</p>

      {!activeZip || !initialZip ? (
        <form onSubmit={submitZip} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`compare-zip-${type}`} className="text-xs">Your ZIP code</Label>
            <Input
              id={`compare-zip-${type}`}
              inputMode="numeric"
              maxLength={5}
              className="w-32"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Show agents</Button>
          {zipError ? <p className="w-full text-xs text-destructive">{zipError}</p> : null}
        </form>
      ) : null}

      {loading ? <p className="mt-3 text-xs text-muted-foreground">Loading…</p> : null}
      {!loading && agents && agents.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No other participating agents serve this ZIP yet.</p>
      ) : null}

      {!loading && agents && agents.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {agents.map((a) => (
            <li key={a.id} className="flex flex-col rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                {a.headshot_url ? (
                  <img src={a.headshot_url} alt={a.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UserRound className="h-6 w-6 text-muted-foreground" aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  {a.brokerage ? <p className="truncate text-xs text-muted-foreground">{a.brokerage}</p> : null}
                  {a.service_area ? <p className="truncate text-xs text-muted-foreground">{a.service_area}</p> : null}
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{label} incentives available</p>
              <div className="mt-3 flex flex-col gap-2">
                <Button size="sm" onClick={() => setLeadFor(a)}>Get Incentive Details</Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`${profileBasePath}/${a.aac_id || a.id}`}>View Profile</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {leadFor ? (
        <IncentiveLeadDialog
          open={!!leadFor}
          onOpenChange={(o) => !o && setLeadFor(null)}
          agentId={leadFor.id}
          agentName={leadFor.name}
          type={type}
          zip={activeZip}
          listingId={listingId}
        />
      ) : null}
    </div>
  );
}
