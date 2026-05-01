import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BuyerStatusBadge, type BuyerStatus } from "@/lib/buyerStatus";
import {
  Loader2, MessageSquare, Plus, Pencil,
  ArrowLeft, Home, Clock, UserMinus, Mail, Heart, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { useBuyerDashboard } from "@/hooks/useBuyerDashboard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditHotsheetCriteriaDialog } from "@/components/EditHotsheetCriteriaDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { RemoveBuyerClientDialog } from "@/components/success-hub/RemoveBuyerClientAction";
import { useAuthRole } from "@/hooks/useAuthRole";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

import { findOrCreateConversation } from "@/lib/startConversation";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { BuyerHotSheetPreviewCard } from "@/components/buyer/BuyerHotSheetPreviewCard";
import { buyerPreviewCardInteractive } from "@/lib/buyerUi";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return "$" + n.toLocaleString();
}

// ── Section nav items ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "hotsheets", label: "Hot Sheets" },
  { id: "saved", label: "Saved" },
  { id: "activity", label: "Activity" },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthRole();
  const { client, hotSheets, favorites, activity, conversations, stats, loading, refresh } =
    useBuyerDashboard(buyerId);
  // Lazy init: if URL signals create-hot-sheet intent, dialog is "open" from first render.
  // It still only renders once `client` is loaded, so it appears in the same paint as the page —
  // no flash of bare state before the popup.
  const [createHsOpen, setCreateHsOpen] = useState(
    () => searchParams.get("createHotSheet") === "1"
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
  const [editingHotSheet, setEditingHotSheet] = useState<{ id: string; criteria: any } | null>(null);
  const [activeSection, setActiveSection] = useState<string>("hotsheets");
  const [messagingBusy, setMessagingBusy] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const buyerOnPlatform = !!client?.agent_user_id;

  // Same source as BuyersList: client_agent_relationships.status
  const [buyerStatus, setBuyerStatus] = useState<BuyerStatus>("pending_invite");
  useEffect(() => {
    if (!user?.id || !buyerId) return;
    let cancelled = false;
    (async () => {
      const { data: rel } = await supabase
        .from("client_agent_relationships")
        .select("status")
        .eq("agent_id", user.id)
        .or(`crm_client_id.eq.${buyerId},client_id.eq.${buyerId}`)
        .maybeSingle();
      if (cancelled) return;
      const s = (rel?.status ?? "").toLowerCase();
      if (s === "active") setBuyerStatus("active");
      else if (s === "pending") setBuyerStatus("pending_invite");
      else setBuyerStatus("pending_invite");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, buyerId]);
  const handleGeneralMessage = async () => {
    if (!user?.id || !client?.agent_user_id) return;
    setMessagingBusy(true);
    try {
      const convoId = await findOrCreateConversation(user.id, client.agent_user_id);
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

  // Open listing-specific buyer conversation
  const handleListingMessage = async (listingId: string) => {
    if (!user?.id || !client?.agent_user_id) return;
    setMessagingBusy(true);
    try {
      const convoId = await findOrCreateConversation(user.id, client.agent_user_id, { listingId });
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

  if (loading) {
    return (
      <AgentAacPage className="flex min-h-[40vh] flex-1 flex-col items-center justify-center pb-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </AgentAacPage>
    );
  }

  if (!client) {
    return (
      <AgentAacPage className="pb-12">
        <AgentPageHeader
          title="Buyer Not Found"
          subtitle="No buyer found with that ID."
          backTo="/success-hub/buyers"
        />
      </AgentAacPage>
    );
  }

  const buyerName =
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || client.email;
  const capitalizedName = buyerName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");


  return (
    <AgentAacPage className="pb-12">
      <AgentPageHeader
        title={capitalizedName}
        subtitle={client.email}
        backTo="/success-hub/buyers"
        className="mb-8"
      />

      {/* ── Buyer Summary Card ──────── */}
      <AgentSectionCard className="mb-8 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <BuyerStatusBadge status={buyerStatus} />
            </div>
            {client.phone && (
              <p className="text-sm text-muted-foreground mt-2">{client.phone}</p>
            )}
            {buyerStatus === "pending_invite" && (
              <p className="text-sm text-zinc-500 mt-2">
                Invite your buyer to unlock favorites, searches, and live activity.
              </p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <StatBlock value={stats.hotSheetCount} label="Hot Sheets" />
            <StatBlock value={stats.favoritesCount} label="Favorites" />
            <StatBlock value={stats.messagesCount} label="Messages" />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Buyer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRemoveOpen(true)}
          >
            <UserMinus className="h-3.5 w-3.5 mr-1.5" /> Remove Buyer
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneralMessage}
                    disabled={!buyerOnPlatform || messagingBusy}
                  >
                    {messagingBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Message Buyer
                  </Button>
                </span>
              </TooltipTrigger>
              {!buyerOnPlatform && (
                <TooltipContent>Available once the buyer accepts their invite</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {!buyerOnPlatform && client.email && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent("A note from your agent")}`}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Email Buyer
              </a>
            </Button>
          )}
        </div>
      </AgentSectionCard>

      {/* ── Section Nav ──────────────────────── */}
      <div className="border-b border-neutral-200 mb-8">
        <nav className="flex items-center gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeSection === s.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Hot Sheets ────────────────────────── */}
      <section ref={(el: HTMLDivElement | null) => { sectionRefs.current.hotsheets = el; }} className="mb-12">
        <AgentSectionCard className="p-6">
          <SectionHeading title="Hot Sheets" count={stats.hotSheetCount} />

          {hotSheets.length === 0 ? (
            <EmptyState
              icon={<Home className="h-5 w-5 text-muted-foreground" />}
              title="No Hot Sheets"
              description="Create a hot sheet to start matching listings for this buyer."
              action={
                <Button size="sm" onClick={() => setCreateHsOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Hot Sheet
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotSheets.map((hs) => {
              const mosaicPhotos: string[] = [];
              for (const listing of hs.topListings) {
                const photos = listing.photos as any[] | null;
                if (photos?.length && mosaicPhotos.length < 3) {
                  const raw = photos[0];
                  const url = typeof raw === "string" ? raw : raw?.url || undefined;
                  if (url) mosaicPhotos.push(url);
                }
              }
              return (
                <div key={hs.id} className="relative">
                  <BuyerHotSheetPreviewCard
                    photoUrls={mosaicPhotos}
                    title={hs.name}
                    subtitle={`${hs.matchCount} listing${hs.matchCount === 1 ? " match" : " matches"}`}
                    onClick={() =>
                      navigate(`/hot-sheets/${hs.id}/review`, {
                        state: { from: `/success-hub/buyers/${buyerId}` },
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/hot-sheets/${hs.id}/review`, {
                          state: { from: `/success-hub/buyers/${buyerId}` },
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Edit hot sheet"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setEditingHotSheet({ id: hs.id, criteria: hs.criteria });
                    }}
                    className="absolute top-2 right-2 z-20 h-8 w-8 rounded-lg border border-neutral-200 bg-white text-foreground shadow-sm flex items-center justify-center hover:bg-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            </div>
          )}
        </AgentSectionCard>
      </section>

      {/* ── Saved listings (hot sheet favorites) ───────────────────────── */}
      <section
        ref={(el: HTMLDivElement | null) => {
          sectionRefs.current.saved = el;
        }}
        className="mb-12"
      >
        <AgentSectionCard className="p-6">
          <SectionHeading title="Saved Listings" count={favorites.length} />

          {favorites.length === 0 ? (
            <EmptyState
              icon={<Heart className="h-5 w-5 text-muted-foreground" />}
              title="No Saved Listings"
              description="Favorites from your buyer’s hot sheets will show here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((listing: any) => {
              const photo =
                listing.photos?.[0] &&
                (typeof listing.photos[0] === "string"
                  ? listing.photos[0]
                  : listing.photos[0]?.url);
              return (
                <div
                  key={listing.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/property/${listing.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(`/property/${listing.id}`);
                  }}
                  className={`relative ${buyerPreviewCardInteractive} flex flex-col h-full`}
                >
                  <div className="aspect-[4/3] relative w-full shrink-0 overflow-hidden bg-white">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 z-10 rounded-full bg-white p-1.5 border border-neutral-200 shadow-sm">
                      <Heart className="h-3.5 w-3.5 text-primary fill-primary" />
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-4 flex flex-col flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {listing.price != null
                        ? formatPrice(Number(listing.price))
                        : "—"}
                    </p>
                    <p className="text-sm text-foreground mt-0.5 line-clamp-2">{listing.address}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[listing.city, listing.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </AgentSectionCard>
      </section>

      {/* ── Activity ──────────────────────────── */}
      <section ref={(el: HTMLDivElement | null) => { sectionRefs.current.activity = el; }} className="mb-12">
        <AgentSectionCard className="p-6">
          <SectionHeading title="Activity" count={activity.length} />

          {activity.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5 text-muted-foreground" />}
              title="No Activity"
              description="Comments and activity will appear here."
            />
          ) : (
            <div className="space-y-2">
            {activity.map((item) => (
              <Card key={item.id} className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-foreground">{item.comment}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {item.listing_id && (
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() => navigate(`/property/${item.listing_id}`)}
                      >
                        {item.listing_label ? `Listing: ${item.listing_label}` : `Listing: ${item.listing_id}`}
                      </button>
                    )}
                    {item.listing_id && item.hot_sheet_id && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {item.hot_sheet_id && (
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium"
                        onClick={() =>
                          navigate(`/hot-sheets/${item.hot_sheet_id}/review`, {
                            state: { from: `/success-hub/buyers/${buyerId}` },
                          })
                        }
                      >
                        {item.hot_sheet_name
                          ? `Hot sheet: ${item.hot_sheet_name}`
                          : `Hot sheet: ${item.hot_sheet_id}`}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.sender_role}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </AgentSectionCard>
      </section>


      {/* ── Edit Buyer Dialog ────────────────────── */}
      <EditBuyerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        buyer={client}
        onSuccess={refresh}
      />

      {/* ── Remove Buyer Client Dialog ───────────── */}
      <RemoveBuyerClientDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        buyerName={capitalizedName}
        agentId={client?.agent_id}
        buyerId={client?.id}
        onRemoved={() => navigate("/success-hub/buyers")}
      />

      {/* ── Create Hot Sheet Dialog ──────────────── */}
      {user?.id && (
        <CreateHotSheetDialog
          open={createHsOpen}
          onOpenChange={setCreateHsOpen}
          userId={user.id}
          clientId={client.id}
          clientName={capitalizedName}
          lockedToClient
          preSelectedClients={[{
            id: client.id,
            first_name: client.first_name,
            last_name: client.last_name,
            email: client.email,
            phone: client.phone,
          }]}
          onSuccess={(hsId) => {
            toast.success("Hot Sheet created");
            setCreateHsOpen(false);
            navigate(`/hot-sheets/${hsId}/review`);
          }}
        />
      )}

      {/* ── Edit Hot Sheet Dialog ────────────────── */}
      {editingHotSheet && (
        <EditHotsheetCriteriaDialog
          open={!!editingHotSheet}
          onOpenChange={(open) => !open && setEditingHotSheet(null)}
          hotSheetId={editingHotSheet.id}
          initialCriteria={editingHotSheet.criteria}
          onUpdate={() => {
            refresh();
            setEditingHotSheet(null);
          }}
        />
      )}
    </AgentAacPage>
  );
}

// ── Stat block ───────────────────────────────────────────────────────────────

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">{title}</h2>
      {count != null && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
      {icon}
      <h3 className="text-sm font-medium text-foreground mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
