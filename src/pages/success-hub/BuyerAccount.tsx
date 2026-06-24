import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { AacBackLink } from "@/components/layout/AacBackLink";
import { AacPageIntro } from "@/components/layout/AacPageIntro";

const BUYERS_LIST_PATH = "/success-hub/buyers";
import { Button } from "@/components/ui/button";
import { SingleClientEmailDialog } from "@/components/SingleClientEmailDialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { RemoveBuyerClientDialog } from "@/components/success-hub/RemoveBuyerClientAction";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useBuyerWorkspaceMirror } from "@/hooks/useBuyerWorkspaceMirror";
import { ClientDashboardView } from "@/components/buyer/ClientDashboardView";
import { findOrCreateConversation } from "@/lib/startConversation";
import { toast } from "sonner";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Seo } from "@/components/Seo";

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

function BuyerWorkspaceSkeleton() {
  return (
    <AgentAacPage className="pb-12">
      <span className="sr-only">Loading buyer workspace…</span>
      <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <Skeleton className="h-8 w-48 max-w-full rounded-md bg-neutral-100" />
          <Skeleton className="mt-3 h-4 w-full max-w-md rounded-md bg-neutral-100" />
          <div className="mt-5 flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-lg bg-neutral-100" />
            <Skeleton className="h-9 w-28 rounded-lg bg-neutral-100" />
            <Skeleton className="h-9 w-28 rounded-lg bg-neutral-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <Skeleton className="h-4 w-4 rounded bg-neutral-100" />
              <Skeleton className="mt-3 h-8 w-12 rounded-md bg-neutral-100" />
              <Skeleton className="mt-2 h-3 w-20 rounded-md bg-neutral-100" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-4 w-28 rounded-md bg-neutral-100" />
            <Skeleton className="mt-6 h-40 w-full rounded-lg bg-neutral-100" />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-4 w-24 rounded-md bg-neutral-100" />
            <Skeleton className="mt-6 h-40 w-full rounded-lg bg-neutral-100" />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
          <Skeleton className="mt-4 h-32 w-full rounded-lg bg-neutral-100" />
        </div>
      </div>
    </AgentAacPage>
  );
}

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthRole();

  const mirror = useBuyerWorkspaceMirror(buyerId, user?.id);

  const [createHsOpen, setCreateHsOpen] = useState(
    () => searchParams.get("createHotSheet") === "1",
  );
  // Wizard continuity: when the Hot Sheet step was opened as part of the
  // "Add Buyer → Send Invite with Hot Sheet" flow, backing out of the dialog
  // should return to the buyers list and re-open the "Buyer Added" next-step
  // dialog (so the agent can choose "Invite Client Now") instead of dropping
  // them on a workspace they didn't ask for.
  const wizardOriginRef = useRef<{ fromBuyerCreate: boolean; createdBuyer: any } | null>(
    (() => {
      const s = (location.state ?? null) as { fromBuyerCreate?: boolean; createdBuyer?: any } | null;
      return s?.fromBuyerCreate ? { fromBuyerCreate: true, createdBuyer: s.createdBuyer ?? null } : null;
    })(),
  );
  const hotSheetCreatedRef = useRef(false);
  useEffect(() => {
    if (searchParams.get("createHotSheet") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("createHotSheet");
      setSearchParams(next, { replace: true });
    }
    // Strip wizard origin from history state so a later refresh/back doesn't reuse it.
    if (location.state) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);

  const handleGeneralMessage = async () => {
    if (!user?.id || !mirror.client?.agent_user_id) return;
    try {
      const convoId = await findOrCreateConversation(user.id, mirror.client.agent_user_id);
      if (convoId) {
        navigate(`/agent/messages/${convoId}`);
      } else {
        toast.error("Could not open conversation.");
      }
    } catch {
      toast.error("Could not open conversation.");
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
      <>
        <Seo
          title="Buyer workspace | All Agent Connect"
          description="View buyer activity, hot sheets, and favorites in All Agent Connect."
          canonical={
            buyerId ? `https://allagentconnect.com/agent/buyers/${buyerId}` : undefined
          }
          noindex
        />
        <BuyerWorkspaceSkeleton />
      </>
    );
  }

  if (!mirror.client) {
    return (
      <>
        <Seo
          title="Buyer workspace | All Agent Connect"
          description="View buyer activity, hot sheets, and favorites in All Agent Connect."
          noindex
        />
        <AgentAacPage className="pb-12">
          <AgentSectionCard className="border-neutral-200 p-8 text-center shadow-sm hover:border-neutral-200 hover:shadow-sm">
            <p className="text-sm font-medium text-neutral-900">
              Buyer not found or you don&apos;t have access.
            </p>
            <Button variant="outline" size="sm" className="mt-5 border-neutral-200 shadow-sm" asChild>
              <AacBackLink to={BUYERS_LIST_PATH} />
            </Button>
          </AgentSectionCard>
        </AgentAacPage>
      </>
    );
  }

  const client = mirror.client;
  const buyerPhoneFmt = formatUsPhoneForDisplay(client.phone);

  const mirrorActionBtn =
    "h-9 rounded-lg border-neutral-200 px-3 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-zinc-400/40";

  return (
    <>
      <Seo
        title={`${capitalizedName || "Buyer"} | All Agent Connect`}
        description="Agent view of buyer activity, hot sheets, favorites, and market previews."
        canonical={`https://allagentconnect.com/agent/buyers/${buyerId ?? ""}`}
        noindex
      />
      <ClientDashboardView
        variant="agent"
        navigate={navigate}
        crmBuyerId={buyerId ?? null}
        buyerDisplayName={capitalizedName}
        buyerFirstName={client.first_name}
        buyerLastName={client.last_name}
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
              className={mirrorActionBtn}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
              Edit buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={mirrorActionBtn}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden strokeWidth={2} />
              Remove Buyer
            </Button>
          </>
        }
        onMessagesPrimary={handleGeneralMessage}
        onMessagesIcon={handleGeneralMessage}
        onEmailPrimary={() => setEmailComposeOpen(true)}
        onStatTileNavigate={(label) => {
          if (!buyerId) return;
          if (label === "Favorites") navigate(`/agent/buyers/${buyerId}/favorites`);
          if (label === "New Matches") navigate(`/agent/buyers/${buyerId}/new-matches`);
          if (label === "Unread Messages") navigate("/agent/messages");
          if (label === "Hot Sheets") {
            navigate(`/hot-sheets/buyer/${buyerId}`, { state: { from: `/agent/buyers/${buyerId}` } });
          }
        }}
        dashboardPaths={{
          hotSheetsViewAll: `/hot-sheets/buyer/${buyerId}`,
          favoritesViewAll: `/agent/buyers/${buyerId}/favorites`,
          marketSearch: "/search",
          favoritesEmptySearch: "/search",
        }}
        onCreateHotSheet={() => setCreateHsOpen(true)}
        topBanner={
          <div className="bg-white px-6 md:px-8">
            <div className="mx-auto max-w-7xl">
              <AacPageIntro
                withTopPadding
                back={<AacBackLink to={BUYERS_LIST_PATH} title="Return to buyers list" />}
              />
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
        buyerId={client.id}
        onRemoved={() => navigate("/agent/buyers")}
      />

      {user?.id && (
        <CreateHotSheetDialog
          open={createHsOpen}
          onOpenChange={(open) => {
            setCreateHsOpen(open);
            if (!open && !hotSheetCreatedRef.current && wizardOriginRef.current?.fromBuyerCreate) {
              const origin = wizardOriginRef.current;
              wizardOriginRef.current = null;
              const reopen =
                origin.createdBuyer && origin.createdBuyer.id
                  ? origin.createdBuyer
                  : {
                      id: client.id,
                      firstName: client.first_name ?? "",
                      lastName: client.last_name ?? "",
                      email: client.email ?? "",
                    };
              navigate("/success-hub/buyers", {
                replace: true,
                state: { reopenCreatedBuyer: reopen },
              });
            }
          }}
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
            hotSheetCreatedRef.current = true;
            wizardOriginRef.current = null;
            setCreateHsOpen(false);
            mirror.refresh();
            navigate(`/hot-sheets/${hsId}/review`);
          }}
        />
      )}

      {client.email?.trim() ? (
        <SingleClientEmailDialog
          open={emailComposeOpen}
          onOpenChange={setEmailComposeOpen}
          clientId={client.id}
          recipientEmail={client.email.trim()}
          recipientName={capitalizedName.trim() || undefined}
        />
      ) : null}
    </>
  );
}
