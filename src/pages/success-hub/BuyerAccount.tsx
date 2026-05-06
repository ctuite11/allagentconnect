import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { RemoveBuyerClientDialog } from "@/components/success-hub/RemoveBuyerClientAction";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useBuyerWorkspaceMirror } from "@/hooks/useBuyerWorkspaceMirror";
import { ClientDashboardView } from "@/components/buyer/ClientDashboardView";
import { buyerPageShell } from "@/lib/buyerUi";
import { findOrCreateConversation } from "@/lib/startConversation";
import { toast } from "sonner";

/** Same US display helper as `ClientDashboard` — keeps hero agent phone formatting aligned. */
function formatUsPhoneForDisplay(raw: string | null | undefined): { display: string; telHref: string } | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  const core =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : null;
  if (!core || core.length !== 10) return null;
  return {
    display: `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6)}`,
    telHref: `tel:+1${core}`,
  };
}

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthRole();

  const mirror = useBuyerWorkspaceMirror(buyerId, user?.id);

  const [createHsOpen, setCreateHsOpen] = useState(
    () => searchParams.get("createHotSheet") === "1",
  );
  useEffect(() => {
    if (searchParams.get("createHotSheet") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("createHotSheet");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [messagingBusy, setMessagingBusy] = useState(false);

  const handleGeneralMessage = async () => {
    if (!user?.id || !mirror.client?.agent_user_id) return;
    setMessagingBusy(true);
    try {
      const convoId = await findOrCreateConversation(user.id, mirror.client.agent_user_id);
      if (convoId) {
        navigate(`/messages/${convoId}`);
      } else {
        toast.error("Could not open conversation.");
      }
    } catch {
      toast.error("Could not open conversation.");
    } finally {
      setMessagingBusy(false);
    }
  };

  const agentPhoneFmt = mirror.agent ? formatUsPhoneForDisplay(mirror.agent.phone) : null;

  const buyerDisplayName =
    mirror.client &&
    ([mirror.client.first_name, mirror.client.last_name].filter(Boolean).join(" ").trim() ||
      mirror.client.email);
  const capitalizedName = buyerDisplayName
    ? buyerDisplayName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "";

  if (!user?.id || mirror.loading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${buyerPageShell}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!mirror.client) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 px-4 ${buyerPageShell}`}>
        <p className="text-center text-sm text-muted-foreground">Buyer not found or you do not have access.</p>
        <Button variant="outline" asChild>
          <Link to="/success-hub/buyers">Back to buyers</Link>
        </Button>
      </div>
    );
  }

  const client = mirror.client;
  const buyerPhoneFmt = formatUsPhoneForDisplay(client.phone);

  // Temporary: verify mirror favorites match `/success-hub/buyers/:id/favorites` data path.
  console.log("Buyer mirror favorites summary count", mirror.favorites?.length, mirror.favorites);

  return (
    <>
      <ClientDashboardView
        variant="agent"
        navigate={navigate}
        crmBuyerId={buyerId ?? null}
        buyerDisplayName={capitalizedName}
        buyerEmail={client.email}
        buyerPhoneFmt={buyerPhoneFmt}
        agent={mirror.agent}
        agentPresenceOnline={mirror.agentPresenceOnline}
        agentPhoneFmt={agentPhoneFmt}
        unreadCount={mirror.unreadCount}
        stats={mirror.stats}
        hotSheets={mirror.hotSheets}
        hotSheetPreviewPhotosById={mirror.hotSheetPreviewPhotosById}
        hotSheetPreviewMatchCountsById={mirror.hotSheetPreviewMatchCountsById}
        favorites={mirror.favorites}
        latestListingsPreview={mirror.latestListingsPreview}
        getHotSheetCardPath={(sheetId) => `/hot-sheets/${sheetId}/review`}
        showBuyerSelfServiceChrome={false}
        buyerPresenceOnline={mirror.buyerPresenceOnline}
        mirrorManagementActions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-none transition-colors hover:bg-zinc-50"
              onClick={() => setEditOpen(true)}
            >
              Edit buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-none transition-colors hover:bg-zinc-50"
              onClick={() => setRemoveOpen(true)}
            >
              Remove buyer
            </Button>
          </>
        }
        onMessagesPrimary={handleGeneralMessage}
        onMessagesIcon={handleGeneralMessage}
        onStatTileNavigate={(label) => {
          if (!buyerId) return;
          if (label === "Favorites") navigate(`/success-hub/buyers/${buyerId}/favorites`);
          if (label === "New Matches") navigate("/search");
          if (label === "Unread Messages") navigate("/agent/messages");
          if (label === "Hot Sheets") navigate("/agent/hot-sheets");
        }}
        dashboardPaths={{
          hotSheetsViewAll: "/agent/hot-sheets",
          favoritesViewAll: `/success-hub/buyers/${buyerId}/favorites`,
          marketSearch: "/search",
          favoritesEmptySearch: "/search",
        }}
        topBanner={
          <div className="border-b border-gray-200 bg-white px-4 py-3 md:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="-ml-2 text-gray-600">
                <Link to="/success-hub/buyers">← Back to buyers</Link>
              </Button>
            </div>
          </div>
        }
      />

      <EditBuyerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        buyer={client}
        onSuccess={mirror.refresh}
      />

      <RemoveBuyerClientDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        buyerName={capitalizedName}
        agentId={client.agent_id}
        buyerId={client.id}
        onRemoved={() => navigate("/success-hub/buyers")}
      />

      {user?.id && (
        <CreateHotSheetDialog
          open={createHsOpen}
          onOpenChange={setCreateHsOpen}
          userId={user.id}
          clientId={client.id}
          clientName={capitalizedName}
          lockedToClient
          preSelectedClients={[
            {
              id: client.id,
              first_name: client.first_name,
              last_name: client.last_name,
              email: client.email,
              phone: client.phone,
            },
          ]}
          onSuccess={(hsId) => {
            toast.success("Hot Sheet created");
            setCreateHsOpen(false);
            mirror.refresh();
            navigate(`/hot-sheets/${hsId}/review`);
          }}
        />
      )}
    </>
  );
}
