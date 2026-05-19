import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Plus, Search, RefreshCw } from "lucide-react";
import { aacBackIconButtonClass } from "@/components/layout/AacBackLink";
import { cn } from "@/lib/utils";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { toast } from "sonner";
import {
  buyerCollectionCardRoot,
  buyerImageMosaicGrid,
  buyerSectionCard,
} from "@/lib/buyerUi";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import {
  EMPTY_BUYER_ACTIVITY_METRICS,
  fetchBuyerActivityMetrics,
  type BuyerActivityMetrics,
} from "@/lib/fetchBuyerActivityMetrics";
import { AgentBuyerActivityHeaderCard } from "@/components/agent/AgentBuyerActivityHeaderCard";
import { formatCriteriaDisplayLabel, formatCriteriaDisplayLabels } from "@/lib/formatCriteriaDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

interface LinkedHotSheet {
  id: string;
  name: string;
  criteria: any;
  photos: string[];
  matchCount: number;
  createdAt: string | null;
  invitePending: boolean;
  /** Pending-only: safe to offer agent delete (RPC re-validates). */
  canDeletePending: boolean;
}

/** Matches agent main Hot Sheets card grid (`HotSheets.tsx` buyer/personal sections). */
const BUYER_HOT_SHEET_DETAIL_GRID = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";

function CriteriaPills({ criteria }: { criteria: any }) {
  if (!criteria) return null;

  const pills: string[] = [];

  const locations = criteria.cities || criteria.towns || [];
  if (locations.length > 0) {
    pills.push(locations.slice(0, 2).join(", ") + (locations.length > 2 ? ` +${locations.length - 2}` : ""));
  } else if (criteria.state) {
    pills.push(criteria.state);
  }

  if (criteria.priceMin || criteria.priceMax) {
    const min = criteria.priceMin ? `$${(criteria.priceMin / 1000).toFixed(0)}k` : "Any";
    const max = criteria.priceMax ? `$${(criteria.priceMax / 1000).toFixed(0)}k` : "No max";
    pills.push(`${min} – ${max}`);
  }

  if (criteria.bedroomsMin) pills.push(`${criteria.bedroomsMin}+ beds`);

  if (criteria.bathroomsMin) pills.push(`${criteria.bathroomsMin}+ baths`);

  if (criteria.propertyTypes?.length) {
    const types = criteria.propertyTypes as string[];
    const label = types.length === 1 ? formatCriteriaDisplayLabel(types[0]) : `${types.length} types`;
    pills.push(label);
  }

  if (criteria.statuses?.length) {
    pills.push(formatCriteriaDisplayLabels(criteria.statuses as string[]));
  }

  if (criteria.sqftMin) pills.push(`${criteria.sqftMin.toLocaleString()}+ sqft`);

  if (pills.length === 0) return <span className="text-xs text-neutral-400">All properties</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((pill, i) => (
        <span
          key={i}
          className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

function RelationshipStatusPill({ status }: { status: "active" | "pending" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#0E56F5]/20 bg-[rgba(14,86,245,0.07)] px-2.5 py-0.5 text-[11px] font-medium text-[#0E56F5]">
        <Search className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        Searching
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
      <Clock className="h-3 w-3 shrink-0 text-neutral-500" strokeWidth={2} aria-hidden />
      Pending Invite
    </span>
  );
}

const HotSheetBuyerDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from || "/agent/hot-sheets";
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<"active" | "pending" | null>(null);
  const [hotSheets, setHotSheets] = useState<LinkedHotSheet[]>([]);
  const [editingHotSheet, setEditingHotSheet] = useState<{ id: string; criteria: any } | null>(null);
  const [createHotSheetOpen, setCreateHotSheetOpen] = useState(false);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [buyerActivityMetrics, setBuyerActivityMetrics] = useState<BuyerActivityMetrics | null>(null);
  const [pendingDeleteSheet, setPendingDeleteSheet] = useState<LinkedHotSheet | null>(null);
  const [deletingHotSheet, setDeletingHotSheet] = useState(false);
  const [resendingHotSheetId, setResendingHotSheetId] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) fetchBuyerData();
  }, [clientId]);

  const handleResendInvite = async (hs: LinkedHotSheet) => {
    if (!buyer?.email || !clientId) {
      toast.error("Buyer email missing — cannot resend invite.");
      return;
    }
    setResendingHotSheetId(hs.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find or create a pending share_token for this buyer + hot sheet.
      const { data: tokenRows } = await supabase
        .from("share_tokens")
        .select("id, token, payload, accepted_at")
        .eq("agent_id", user.id);

      let tokenId: string | null = null;
      let token: string | null = null;
      for (const t of tokenRows ?? []) {
        const p = (t as any).payload as Record<string, unknown> | null;
        if (!p || String(p.type ?? "") !== "client_hotsheet_invite") continue;
        if (String(p.hot_sheet_id ?? "") !== String(hs.id)) continue;
        const cid = p.client_id != null ? String(p.client_id) : "";
        const cem = p.client_email != null ? String(p.client_email).trim().toLowerCase() : "";
        const matches =
          cid === clientId ||
          (!!buyer.email && cem === buyer.email.trim().toLowerCase());
        if (!matches) continue;
        if ((t as any).accepted_at) continue;
        tokenId = String((t as any).id);
        token = String((t as any).token ?? "");
        break;
      }

      let mode: "initial" | "resend" = "resend";
      if (!tokenId || !token) {
        const newToken = crypto.randomUUID();
        const { data: inserted, error: insertErr } = await supabase
          .from("share_tokens")
          .insert({
            token: newToken,
            agent_id: user.id,
            payload: {
              type: "client_hotsheet_invite",
              client_id: clientId,
              client_email: buyer.email,
              hot_sheet_id: hs.id,
              suppress_initial_matches: true,
            },
          })
          .select("id, token")
          .single();
        if (insertErr || !inserted) {
          console.error("[ResendInvite] token insert failed", insertErr);
          toast.error("Could not prepare invite. Try again.");
          return;
        }
        tokenId = String(inserted.id);
        token = String(inserted.token ?? newToken);
        mode = "initial";
        // Fire-and-forget audit log.
        supabase.from("invite_events").insert({
          token_id: tokenId,
          hot_sheet_id: hs.id,
          client_id: clientId,
          client_email: buyer.email,
          event_type: "token_created",
          actor_user_id: user.id,
        }).then(() => {});
      }

      // Pull agent display name.
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();
      const agentName = agentProfile
        ? `${agentProfile.first_name ?? ""} ${agentProfile.last_name ?? ""}`.trim() || "Your agent"
        : "Your agent";

      const hotSheetLink =
        `${window.location.origin}/client-invite` +
        `?invitation_token=${encodeURIComponent(token)}` +
        `&email=${encodeURIComponent(buyer.email)}` +
        `&agent_id=${encodeURIComponent(user.id)}` +
        `&client_id=${encodeURIComponent(clientId)}`;

      const { error: invokeErr } = await supabase.functions.invoke("send-hot-sheet-invite", {
        body: {
          invitedEmail: buyer.email,
          inviterName: agentName,
          hotSheetName: hs.name,
          hotSheetLink,
          hotSheetId: hs.id,
          tokenId,
          clientId,
          mode,
        },
      });

      if (invokeErr) {
        console.error("[ResendInvite] invoke failed", invokeErr);
        toast.error("Resend failed. Try again.");
        return;
      }

      // Audit
      supabase.from("invite_events").insert({
        token_id: tokenId,
        hot_sheet_id: hs.id,
        client_id: clientId,
        client_email: buyer.email,
        event_type: "invite_resent",
        actor_user_id: user.id,
      }).then(() => {});

      toast.success(`Invite resent to ${buyer.email}.`);
    } catch (e: any) {
      console.error("[ResendInvite] error", e);
      toast.error(e?.message ?? "Resend failed.");
    } finally {
      setResendingHotSheetId(null);
    }
  };

  const fetchBuyerData = async () => {
    try {
      setLoading(true);
      setBuyerActivityMetrics(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAgentUserId(user.id);

      const { data: rel } = await supabase
        .from("client_agent_relationships")
        .select("status, client_id")
        .eq("agent_id", user.id)
        .or(`crm_client_id.eq.${clientId},client_id.eq.${clientId}`)
        .in("status", ["active", "pending"])
        .maybeSingle();

      if (!rel) {
        toast.error("This buyer was removed.");
        navigate(backTo, { replace: true });
        return;
      }

      setRelationshipStatus(rel.status === "pending" ? "pending" : "active");
      const buyerWorkspaceLinked =
        rel.status === "active" && rel.client_id != null;

      const [clientRes, hscRes] = await Promise.all([
        supabase.from("clients").select("first_name, last_name, email, phone").eq("id", clientId!).maybeSingle(),
        supabase.from("hot_sheet_clients").select("hot_sheet_id").eq("client_id", clientId!),
      ]);

      if (clientRes.data) {
        setBuyer({
          firstName: clientRes.data.first_name || "",
          lastName: clientRes.data.last_name || "",
          email: clientRes.data.email || "",
          phone: clientRes.data.phone ?? null,
        });
      }

      if (hscRes.data?.length) {
        const hsIds = hscRes.data.map((r: any) => r.hot_sheet_id);
        const { data: hsData } = await supabase
          .from("hot_sheets")
          .select("id, name, criteria, created_at")
          .in("id", hsIds);

        const acceptedHotSheetIdsForClient = new Set<string>();
        if (!buyerWorkspaceLinked) {
          const emailLower = clientRes.data?.email
            ? String(clientRes.data.email).trim().toLowerCase()
            : "";
          const { data: tokenRows, error: tokenErr } = await supabase
            .from("share_tokens")
            .select("payload, accepted_at")
            .eq("agent_id", user.id);
          if (!tokenErr && tokenRows?.length) {
            for (const row of tokenRows) {
              const p = row.payload as Record<string, unknown> | null;
              if (!p || String(p.type ?? "") !== "client_hotsheet_invite" || !row.accepted_at) continue;
              const hsId = p.hot_sheet_id != null ? String(p.hot_sheet_id) : "";
              if (!hsId) continue;
              const cid = p.client_id != null ? String(p.client_id) : "";
              const cem = p.client_email != null ? String(p.client_email).trim().toLowerCase() : "";
              const matchesCrmBuyer =
                cid === clientId || (!!emailLower && cem === emailLower);
              if (matchesCrmBuyer) acceptedHotSheetIdsForClient.add(hsId);
            }
          }
        }

        const result: LinkedHotSheet[] = [];
        for (const hs of hsData || []) {
          let photos: string[] = [];
          const matchCount = { value: 0 };
          try {
            const criteria = hs.criteria as any;
            if (criteria) {
              const { data: matchedListings } = await buildListingsQuery(supabase, criteria).limit(200);
              for (const l of matchedListings || []) {
                const lPhotos = l.photos as any[] | null;
                if (lPhotos?.length && photos.length < 4) {
                  const raw = lPhotos[0];
                  const url = typeof raw === "string" ? raw : raw?.url || null;
                  if (url) photos.push(url);
                }
              }
              matchCount.value = matchedListings?.length || 0;
            }
          } catch (e) {
            console.error("Error fetching matches for", hs.id, e);
          }
          const canDeletePending =
            !buyerWorkspaceLinked && !acceptedHotSheetIdsForClient.has(String(hs.id));
          const invitePending =
            !buyerWorkspaceLinked && !acceptedHotSheetIdsForClient.has(String(hs.id));
          result.push({
            id: hs.id,
            name: hs.name,
            criteria: hs.criteria,
            photos,
            matchCount: matchCount.value,
            createdAt: (hs as any).created_at ?? null,
            invitePending,
            canDeletePending,
          });
        }

        setHotSheets(result);
      } else {
        setHotSheets([]);
      }

      const activity = await fetchBuyerActivityMetrics(supabase, clientId!);
      setBuyerActivityMetrics(activity);
    } catch (e) {
      console.error("Error fetching buyer data:", e);
      setBuyerActivityMetrics(EMPTY_BUYER_ACTIVITY_METRICS);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeletePendingHotSheet = async () => {
    if (!pendingDeleteSheet || !clientId) return;
    setDeletingHotSheet(true);
    try {
      const { error } = await supabase.rpc("delete_pending_buyer_hot_sheet", {
        p_hot_sheet_id: pendingDeleteSheet.id,
        p_crm_client_id: clientId,
      });
      if (error) throw error;
      toast.success("Hot sheet invite deleted.");
      setPendingDeleteSheet(null);
      await fetchBuyerData();
    } catch (e: unknown) {
      console.error(e);
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "";
      toast.error(msg || "Could not remove this invite.");
    } finally {
      setDeletingHotSheet(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white pt-4 px-6 pb-6">
        <div className="mx-auto w-full max-w-[88rem] min-w-0">
          <div className="mb-2 flex animate-pulse items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-neutral-100" />
            <div className="h-4 w-28 rounded bg-neutral-100" />
          </div>
          <div className="mb-3 space-y-2">
            <div className="h-[4.5rem] rounded-xl border border-neutral-200 bg-neutral-50/80" />
            <div className="h-8 w-40 animate-pulse rounded-md bg-neutral-100" />
          </div>
          <div className={BUYER_HOT_SHEET_DETAIL_GRID}>
            {[1, 2].map((i) => (
              <article
                key={i}
                className={`${buyerCollectionCardRoot} flex min-h-[19rem] animate-pulse flex-col overflow-hidden md:min-h-[20rem]`}
              >
                <div className={`${buyerImageMosaicGrid} bg-neutral-100`} />
                <div className="space-y-2 px-4 py-3">
                  <div className="h-4 w-2/3 rounded bg-neutral-200" />
                  <div className="h-3 w-1/2 rounded bg-neutral-100" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayName = buyer
    ? `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email || "Unknown Buyer"
    : "Unknown Buyer";
  return (
    <div className="bg-white pt-4 px-6 pb-6">
      <div className="mx-auto w-full max-w-[88rem] min-w-0">
        {/* Header — back + title only (matches mockup) */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className={cn(aacBackIconButtonClass, "-ml-1.5 rounded-md p-1.5")}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="truncate text-sm font-semibold tracking-tight text-neutral-900">Hot sheets</h1>
        </div>

        {/* Buyer card + New Hot Sheet (grouped — CTA directly under card, left-aligned) */}
        {buyer && relationshipStatus && (
          <div className="mb-2 w-full space-y-4">
            {(() => {
              const latestPendingHs =
                relationshipStatus === "pending"
                  ? [...hotSheets]
                      .filter((h) => h.invitePending)
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                      )[0]
                  : null;
              return (
                <AgentBuyerActivityHeaderCard
                  displayName={displayName}
                  email={buyer.email}
                  phone={buyer.phone ?? null}
                  crmClientId={clientId!}
                  metrics={buyerActivityMetrics}
                  metricsLoading={buyerActivityMetrics === null}
                  trailing={
                    <div className="flex items-center gap-2">
                      <RelationshipStatusPill status={relationshipStatus} />
                      {latestPendingHs ? (
                        <button
                          type="button"
                          disabled={resendingHotSheetId === latestPendingHs.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResendInvite(latestPendingHs);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[#0E56F5]/20 bg-[rgba(14,86,245,0.06)] px-2 py-0.5 text-[11px] font-medium text-[#0E56F5] transition-colors hover:bg-[rgba(14,86,245,0.12)] disabled:opacity-60"
                        >
                          <RefreshCw
                            className={`h-3 w-3 shrink-0 ${resendingHotSheetId === latestPendingHs.id ? "animate-spin" : ""}`}
                            strokeWidth={2}
                            aria-hidden
                          />
                          {resendingHotSheetId === latestPendingHs.id ? "Resending…" : "Resend invite"}
                        </button>
                      ) : null}
                    </div>
                  }
                  className="border-neutral-200 shadow-sm"
                  metricsToolbarTintIcons
                  hotSheetMetricUseFlame
                />
              );
            })()}
            <div className="flex w-full justify-start">
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium"
                onClick={() => setCreateHotSheetOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                New Hot Sheet
              </Button>
            </div>
          </div>
        )}

        {hotSheets.length === 0 ? (
          <div className={`${buyerSectionCard} mt-8 rounded-xl border-neutral-200 p-8 text-center shadow-sm`}>
            <p className="text-sm text-neutral-500">No hot sheets linked to this buyer.</p>
          </div>
        ) : (
          <div className={`mt-8 ${BUYER_HOT_SHEET_DETAIL_GRID} [&>*]:min-w-0`}>
            {hotSheets.map((hs) => (
              <BuyerHotSheetPreviewCard
                key={hs.id}
                variant="agentDetail"
                photoUrls={hs.photos}
                title={hs.name}
                subtitle={`${hs.matchCount} ${hs.matchCount === 1 ? "match" : "matches"}`}
                preferWideTitle
                createdAt={hs.createdAt}
                invitePending={hs.invitePending}
                resendInviteLoading={resendingHotSheetId === hs.id}
                onResendInvite={() => handleResendInvite(hs)}
                onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  navigate(`/hot-sheets/${hs.id}/review`);
                }}
                onFavoritesClick={() => {
                  if (clientId) navigate(`/agent/buyers/${clientId}/favorites`);
                }}
                onDeleteClick={
                  hs.canDeletePending ? () => setPendingDeleteSheet(hs) : undefined
                }
                onEditClick={() =>
                  setEditingHotSheet({ id: hs.id, criteria: hs.criteria })
                }
              />
            ))}
          </div>
        )}

        {editingHotSheet && (
          <EditHotsheetCriteriaDialog
            open={!!editingHotSheet}
            onOpenChange={(open) => !open && setEditingHotSheet(null)}
            hotSheetId={editingHotSheet.id}
            initialCriteria={editingHotSheet.criteria}
            onUpdate={() => {
              fetchBuyerData();
              setEditingHotSheet(null);
            }}
          />
        )}

        {agentUserId && clientId && buyer && (
          <CreateHotSheetDialog
            open={createHotSheetOpen}
            onOpenChange={setCreateHotSheetOpen}
            userId={agentUserId}
            clientId={clientId}
            clientName={displayName}
            lockedToClient
            preSelectedClients={[
              {
                id: clientId,
                first_name: buyer.firstName,
                last_name: buyer.lastName,
                email: buyer.email,
                phone: buyer.phone ?? null,
              },
            ]}
            onSuccess={(hotSheetId) => {
              setCreateHotSheetOpen(false);
              fetchBuyerData();
              navigate(`/hot-sheets/${hotSheetId}/review`);
            }}
          />
        )}

        <AlertDialog
          open={!!pendingDeleteSheet}
          onOpenChange={(open) => {
            if (!open && deletingHotSheet) return;
            if (!open) setPendingDeleteSheet(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete hot sheet invite?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the{" "}
                <strong className="font-medium text-foreground">pending</strong> invite and link for{" "}
                <strong className="font-medium text-foreground">{pendingDeleteSheet?.name ?? "this saved search"}</strong>.
                Use this before the buyer accepts or joins the sheet in workspace — it does not delete an accepted shared hot sheet group.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingHotSheet}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingHotSheet}
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDeletePendingHotSheet();
                }}
              >
                {deletingHotSheet ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default HotSheetBuyerDetail;
