import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateBuyerDialog } from "@/components/CreateBuyerDialog";

interface BuyerRow {
  clientId: string;
  name: string;
  email: string;
  status: string;
  hotSheetCount: number;
}

export default function BuyersList() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadBuyers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get active relationships for this agent
      const { data: relationships, error: relErr } = await supabase
        .from("client_agent_relationships")
        .select("client_id,crm_client_id,status,created_at")
        .eq("agent_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (relErr) {
        console.error("Error loading buyer relationships:", relErr);
        return;
      }

      if (!relationships || relationships.length === 0) {
        setBuyers([]);
        return;
      }

      // Collect both client_id (auth user) and crm_client_id (CRM contact) for lookups
      const authClientIds = relationships.map((r) => r.client_id).filter(Boolean);
      const crmClientIds = (relationships as any[])
        .map((r) => r.crm_client_id)
        .filter(Boolean) as string[];
      const allCrmIds = [...new Set([...authClientIds, ...crmClientIds])];

      // Fetch client details + hot sheet counts in parallel
      const [clientsRes, hscRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id,first_name,last_name,email")
          .in("id", allCrmIds),
        supabase
          .from("hot_sheet_clients")
          .select("client_id,hot_sheet_id")
          .in("client_id", allCrmIds),
      ]);

      const clientMap = new Map<string, any>();
      for (const c of (clientsRes.data ?? [])) {
        clientMap.set(c.id, c);
      }

      const hsCountMap = new Map<string, number>();
      for (const row of (hscRes.data ?? []) as any[]) {
        const cid = String(row.client_id);
        hsCountMap.set(cid, (hsCountMap.get(cid) ?? 0) + 1);
      }

      // Build rows: prefer crm_client_id for client lookup, fall back to client_id
      const rows: BuyerRow[] = relationships.map((r: any) => {
        const crmId = r.crm_client_id || r.client_id;
        const c = clientMap.get(crmId) || clientMap.get(r.client_id);
        if (!c) return null;
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;
        return {
          clientId: c.id,
          name,
          email: c?.email ?? "",
          status: "active",
          hotSheetCount: hsCountMap.get(c.id) ?? 0,
        };
      }).filter(Boolean) as BuyerRow[];

      setBuyers(rows);
    } catch (err) {
      console.error("Error loading buyers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuyers();
  }, []);

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader
        title="Your Buyers"
        subtitle="Select a buyer to manage their hot sheets, favorites, and activity."
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            New Buyer
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : buyers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No buyers yet.</p>
      ) : (
        <div className="space-y-2">
          {buyers.map((b) => (
            <Card
              key={b.clientId}
              className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors"
              onClick={() => navigate(`/success-hub/buyers/${b.clientId}`)}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{b.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-emerald-600 text-sm font-medium">Active</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {b.hotSheetCount} hot sheet{b.hotSheetCount !== 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateBuyerDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={loadBuyers}
      />
    </PageShell>
  );
}
