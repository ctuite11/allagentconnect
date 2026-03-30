import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Send, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ClientDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
}

interface HotSheetRow {
  id: string;
  name: string;
  criteria: any;
  updated_at: string;
}

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [hotSheets, setHotSheets] = useState<HotSheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buyerId) return;

    const load = async () => {
      setLoading(true);
      try {
        // Fetch client record
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id,first_name,last_name,email,phone,client_type")
          .eq("id", buyerId)
          .maybeSingle();

        if (clientErr) throw clientErr;
        setClient(clientData);

        // Fetch linked hot sheets
        const { data: hscData } = await supabase
          .from("hot_sheet_clients")
          .select("hot_sheet_id")
          .eq("client_id", buyerId);

        const hsIds = (hscData ?? []).map((r: any) => r.hot_sheet_id);

        if (hsIds.length > 0) {
          const { data: hsData } = await supabase
            .from("hot_sheets")
            .select("id,name,criteria,updated_at")
            .in("id", hsIds)
            .order("updated_at", { ascending: false });

          setHotSheets(hsData ?? []);
        }
      } catch (err) {
        console.error("Error loading buyer detail:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [buyerId]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <PageHeader title="Buyer Not Found" backTo="/success-hub/buyers" />
        <p className="text-muted-foreground">No buyer found with that ID.</p>
      </PageShell>
    );
  }

  const buyerName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || client.email;

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader title={buyerName} backTo="/success-hub/buyers" />

      {/* Header Card */}
      <Card className="mb-8 border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">{buyerName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{client.email}</p>
              {client.phone && (
                <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
              )}
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{hotSheets.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hot Sheets</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="hotsheets">
        <TabsList className="mb-6 bg-transparent border-b border-border rounded-none p-0 gap-0">
          <TabsTrigger value="hotsheets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm">Hot Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="hotsheets">
          {hotSheets.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6">No hot sheets for this buyer yet.</p>
          ) : (
            <div className="space-y-2">
              {hotSheets.map((hs) => (
                <Card key={hs.id} className="border border-border bg-card">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="font-medium text-sm text-foreground">{hs.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last updated {new Date(hs.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toast.info("Coming soon")}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Resend
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
