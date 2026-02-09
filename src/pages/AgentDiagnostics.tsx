import React, { useEffect, useState, useCallback } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface DiagResult {
  projectRef: string;
  supabaseUrl: string;
  serverTime: string;
  listingsTotal: number;
  listingsByStatus: Record<string, number>;
  callerId: string | null;
  callerIsAdmin: boolean;
  agentCheck: {
    agentId: string;
    listingsCount: number;
    listingsByStatus: Record<string, number>;
    sampleListingIds: string[];
  } | null;
}

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const StatusDot = ({ ok }: { ok: boolean }) => (
  ok
    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
    : <XCircle className="h-4 w-4 text-destructive shrink-0" />
);

const InfoRow = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
  <div className="flex items-center gap-2 text-sm py-1">
    {ok !== undefined && <StatusDot ok={ok} />}
    <span className="text-muted-foreground min-w-[140px]">{label}</span>
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono break-all">{value}</code>
  </div>
);

const SQL_ALL = `select status, listing_type, count(*) as ct
from public.listings
group by status, listing_type
order by status, listing_type;`;

const SQL_AGENT = `select agent_id, status, listing_type, count(*) as ct
from public.listings
where agent_id = '<PASTE_UUID>'
group by agent_id, status, listing_type
order by status, listing_type;`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AgentDiagnostics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [diagData, setDiagData] = useState<DiagResult | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sqlOpen, setSqlOpen] = useState(false);

  // Client-side env values
  const clientUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const clientAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const clientProjectRef = clientUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? "unknown";
  const anonFingerprint =
    clientAnonKey.length > 16
      ? `${clientAnonKey.slice(0, 8)}…${clientAnonKey.slice(-8)}`
      : clientAnonKey;

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get auth user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      setAuthUserId(userId);

      // Get agent profile
      if (userId) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("id, first_name, last_name, email")
          .eq("id", userId)
          .maybeSingle();
        setAgentProfile(profile as AgentProfile | null);
      }

      // Call edge function
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const fnUrl = `${clientUrl}/functions/v1/diag-listings${userId ? `?agent_id=${userId}` : ""}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(fnUrl, { headers });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Edge function returned ${res.status}: ${body}`);
      }
      const json: DiagResult = await res.json();
      setDiagData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error("Diagnostics failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [clientUrl]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const copyDiagnostics = () => {
    const payload = {
      client: {
        origin: window.location.origin,
        supabaseUrl: clientUrl,
        projectRef: clientProjectRef,
        anonKeyFingerprint: anonFingerprint,
        authUserId,
        agentProfile,
      },
      server: diagData,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Diagnostics JSON copied to clipboard");
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const identityMatch = authUserId && agentProfile ? authUserId === agentProfile.id : null;

  return (
    <PageShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Diagnostics</h1>
          <p className="text-sm text-muted-foreground mt-1">Verify your environment, identity, and listing data.</p>
        </div>

        {/* Card 1 — Environment */}
        <SectionCard title="Environment">
          <div className="space-y-1">
            <InfoRow label="Browser Origin" value={window.location.origin} ok />
            <InfoRow
              label="Backend URL"
              value={clientUrl || "(not set)"}
              ok={!!clientUrl}
            />
            <InfoRow
              label="Project Ref (client)"
              value={clientProjectRef}
              ok={clientProjectRef !== "unknown"}
            />
            {diagData && (
              <InfoRow
                label="Project Ref (server)"
                value={diagData.projectRef}
                ok={diagData.projectRef === clientProjectRef}
              />
            )}
            <InfoRow label="Anon Key Fingerprint" value={anonFingerprint} />
            {diagData && (
              <InfoRow label="Server Time" value={diagData.serverTime} />
            )}
          </div>
          {diagData && diagData.projectRef !== clientProjectRef && (
            <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              ⚠️ Project ref mismatch between client and server. This indicates an environment drift issue.
            </div>
          )}
        </SectionCard>

        {/* Card 2 — Identity Mapping */}
        <SectionCard title="Identity Mapping">
          <div className="space-y-1">
            <InfoRow
              label="auth.user.id"
              value={authUserId ?? "(no session)"}
              ok={!!authUserId}
            />
            <InfoRow
              label="agent_profiles.id"
              value={agentProfile?.id ?? "(not found)"}
              ok={!!agentProfile}
            />
            {identityMatch !== null && (
              <InfoRow
                label="IDs Match"
                value={identityMatch ? "✓ Yes" : "✗ No"}
                ok={identityMatch}
              />
            )}
            {agentProfile && (
              <>
                <InfoRow label="Agent Name" value={`${agentProfile.first_name} ${agentProfile.last_name}`} />
                <InfoRow label="Agent Email" value={agentProfile.email} />
              </>
            )}
          </div>
          {identityMatch === false && (
            <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              ⚠️ Listing agent_id differs from current auth user id. Listings created under a
              different agent_id will not appear as yours.
            </div>
          )}
        </SectionCard>

        {/* Card 3 — Listing Counts */}
        <SectionCard title="Listing Counts (Server Truth)">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : diagData ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">
                  Total Listings in Database:{" "}
                  <span className="font-bold">{diagData.listingsTotal}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(diagData.listingsByStatus).map(([status, count]) => (
                    <Badge key={status} variant="secondary" className="text-xs">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </div>

              {diagData.agentCheck && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">
                    Your Listings:{" "}
                    <span className="font-bold">{diagData.agentCheck.listingsCount}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(diagData.agentCheck.listingsByStatus).map(([status, count]) => (
                      <Badge key={status} variant="outline" className="text-xs">
                        {status}: {count}
                      </Badge>
                    ))}
                  </div>
                  {diagData.agentCheck.sampleListingIds.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">Sample Listing IDs:</p>
                      {diagData.agentCheck.sampleListingIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => copyText(id)}
                          className="block text-xs font-mono text-primary hover:underline cursor-pointer"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </SectionCard>

        {/* Card 4 — Quick Actions */}
        <SectionCard title="Quick Actions">
          <div className="flex flex-wrap gap-3 mb-4">
            <Button size="sm" variant="outline" onClick={runDiagnostics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Re-run Checks
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={copyDiagnostics}
              disabled={loading || !diagData}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy Diagnostics JSON
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/auth/diagnostics")}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Auth Diagnostics
            </Button>
          </div>

          <Collapsible open={sqlOpen} onOpenChange={setSqlOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {sqlOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              SQL Verification Queries
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">All listings by status</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyText(SQL_ALL)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {SQL_ALL}
                </pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">Listings for a specific agent</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyText(
                    authUserId ? SQL_AGENT.replace("<PASTE_UUID>", authUserId) : SQL_AGENT
                  )}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {authUserId ? SQL_AGENT.replace("<PASTE_UUID>", authUserId) : SQL_AGENT}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SectionCard>
      </div>
    </PageShell>
  );
}
