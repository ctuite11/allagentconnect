import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";

interface BuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface LinkedHotSheet {
  id: string;
  name: string;
}

type InviteStatus = "accepted" | "pending" | "not_invited";

const HotSheetBuyerDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [hotSheets, setHotSheets] = useState<LinkedHotSheet[]>([]);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("not_invited");

  useEffect(() => {
    if (clientId) fetchBuyerData();
  }, [clientId]);

  const fetchBuyerData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch client info, linked hot sheets, and tokens in parallel
      const [clientRes, hscRes, tokensRes] = await Promise.all([
        supabase
          .from("clients")
          .select("first_name, last_name, email")
          .eq("id", clientId!)
          .maybeSingle(),
        supabase
          .from("hot_sheet_clients")
          .select("hot_sheet_id")
          .eq("client_id", clientId!),
        supabase
          .from("share_tokens")
          .select("payload, accepted_at")
          .eq("agent_id", user.id),
      ]);

      // Buyer info
      if (clientRes.data) {
        setBuyer({
          firstName: clientRes.data.first_name || "",
          lastName: clientRes.data.last_name || "",
          email: clientRes.data.email || "",
        });
      }

      // Hot sheets
      if (hscRes.data?.length) {
        const hsIds = hscRes.data.map((r: any) => r.hot_sheet_id);
        const { data: hsData } = await supabase
          .from("hot_sheets")
          .select("id, name")
          .in("id", hsIds);
        setHotSheets(hsData || []);
      }

      // Invite status (JS-side payload filtering per arch spec)
      if (tokensRes.data) {
        const clientTokens = tokensRes.data.filter(
          (t: any) =>
            t.payload?.type === "client_hotsheet_invite" &&
            t.payload?.client_id === clientId
        );
        if (clientTokens.length === 0) {
          setInviteStatus("not_invited");
        } else if (clientTokens.some((t: any) => t.accepted_at)) {
          setInviteStatus("accepted");
        } else {
          setInviteStatus("pending");
        }
      }
    } catch (e) {
      console.error("Error fetching buyer data:", e);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<InviteStatus, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" }> = {
    accepted: { label: "Accepted", icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" },
    pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
    not_invited: { label: "Not Invited", icon: <AlertCircle className="h-3 w-3" />, variant: "outline" },
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col gap-3 mt-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  const displayName = buyer
    ? `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email || "Unknown Buyer"
    : "Unknown Buyer";

  const status = statusConfig[inviteStatus];

  return (
    <PageShell>
      <PageHeader
        title="Buyer Detail"
        backTo="/hot-sheets"
        className="mb-8"
      />

      {/* Buyer Header Card */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between py-4 px-5">
          <div>
            <h2 className="text-lg font-semibold">{displayName}</h2>
            {buyer?.email && (
              <p className="text-sm text-muted-foreground">{buyer.email}</p>
            )}
          </div>
          <Badge variant={status.variant} className="flex items-center gap-1.5">
            {status.icon}
            {status.label}
          </Badge>
        </CardContent>
      </Card>

      {/* Linked Hot Sheets */}
      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Hot Sheets
      </h3>
      {hotSheets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hot sheets linked to this buyer.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {hotSheets.map((hs) => (
            <Card
              key={hs.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
            >
              <CardContent className="py-3 px-4">
                <p className="font-medium text-sm">{hs.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default HotSheetBuyerDetail;
