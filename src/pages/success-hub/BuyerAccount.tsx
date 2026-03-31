import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MessageSquare, Plus, Pencil,
  ArrowLeft, Home, Clock, Eye
} from "lucide-react";
import { toast } from "sonner";
import { useBuyerDashboard } from "@/hooks/useBuyerDashboard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { useAuthRole } from "@/hooks/useAuthRole";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

import { findOrCreateConversation } from "@/lib/startConversation";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return "$" + n.toLocaleString();
}

function criteriaPills(criteria: any): string[] {
  if (!criteria) return [];
  const pills: string[] = [];
  if (criteria.cities?.length) pills.push(criteria.cities.join(", "));
  if (criteria.state) pills.push(criteria.state);
  if (criteria.minPrice || criteria.maxPrice) {
    const min = criteria.minPrice ? formatPrice(criteria.minPrice) : "";
    const max = criteria.maxPrice ? formatPrice(criteria.maxPrice) : "";
    if (min && max) pills.push(`${min} – ${max}`);
    else if (min) pills.push(`${min}+`);
    else if (max) pills.push(`Up to ${max}`);
  }
  if (criteria.bedrooms) pills.push(`${criteria.bedrooms}+ Beds`);
  if (criteria.bathrooms) pills.push(`${criteria.bathrooms}+ Baths`);
  if (criteria.propertyTypes?.length) pills.push(criteria.propertyTypes.join(", "));
  return pills;
}

// ── Section nav items ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "hotsheets", label: "Hot Sheets" },
  { id: "activity", label: "Activity" },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthRole();
  const { client, hotSheets, favorites, activity, conversations, stats, loading, refresh } =
    useBuyerDashboard(buyerId);
  const [createHsOpen, setCreateHsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hotsheets");
  const [messagingBusy, setMessagingBusy] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const buyerOnPlatform = !!client?.agent_user_id;

  // Open general buyer conversation
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
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/success-hub/buyers")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Buyer Not Found</h1>
        </div>
        <p className="text-sm text-muted-foreground">No buyer found with that ID.</p>
      </PageShell>
    );
  }

  const buyerName =
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || client.email;
  const capitalizedName = buyerName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const generalConversations = conversations.filter((c) => !c.listing_id);
  const listingConversations = conversations.filter((c) => c.listing_id);

  return (
    <PageShell>
      {/* ── Back row ─────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/success-hub/buyers")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground">Back to Buyers</span>
      </div>

      {/* ── Buyer Summary Card ──────── */}
      <div className="mb-8 rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{capitalizedName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{client.email}</p>
            {client.phone && (
              <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <StatBlock value={stats.hotSheetCount} label="Hot Sheets" />
            <StatBlock value={stats.favoritesCount} label="Favorites" />
            <StatBlock value={stats.messagesCount} label="Messages" />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <Button size="sm" onClick={() => setCreateHsOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Hot Sheet
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Buyer
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
                <TooltipContent>In-app messaging unavailable until buyer has an account</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Section Nav ──────────────────────── */}
      <div className="border-b border-border mb-8">
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
              const pills = criteriaPills(hs.criteria);
              // Extract up to 4 photos for the mosaic
              const mosaicPhotos: (string | undefined)[] = [];
              for (const listing of hs.topListings) {
                const photos = listing.photos as any[] | null;
                if (photos?.length && mosaicPhotos.length < 4) {
                  const raw = photos[0];
                  const url = typeof raw === "string" ? raw : raw?.url || undefined;
                  if (url) mosaicPhotos.push(url);
                }
              }
              while (mosaicPhotos.length < 4) mosaicPhotos.push(undefined);

              return (
                <div
                  key={hs.id}
                  onClick={() =>
                    navigate(`/hot-sheets/${hs.id}/review`, {
                      state: { from: `/success-hub/buyers/${buyerId}` },
                    })
                  }
                  className="bg-card rounded-2xl border border-border shadow-sm cursor-pointer will-change-transform transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] focus-within:shadow-lg overflow-hidden"
                >
                  {/* 2x2 Photo Mosaic */}
                  <div className="aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px bg-muted">
                    {mosaicPhotos.map((src, i) => (
                      <div key={i} className="relative w-full h-full overflow-hidden">
                        {src ? (
                          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Home className="h-5 w-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Card Body */}
                  <div className="px-4 pt-3 pb-4">
                    <h3 className="text-base font-semibold text-foreground truncate">{hs.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {hs.matchCount} listing{hs.matchCount === 1 ? " match" : " matches"}
                    </p>

                    {pills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {pills.map((pill, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs font-normal text-muted-foreground border-border rounded-md"
                          >
                            {pill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-3">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/hot-sheets/${hs.id}/review`, {
                            state: { from: `/success-hub/buyers/${buyerId}` },
                          });
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View Hot Sheet
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* ── Activity ──────────────────────────── */}
      <section ref={(el: HTMLDivElement | null) => { sectionRefs.current.activity = el; }} className="mb-12">
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
      </section>


      {/* ── Edit Buyer Dialog ────────────────────── */}
      <EditBuyerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        buyer={client}
        onSuccess={refresh}
      />

      {/* ── Create Hot Sheet Dialog ──────────────── */}
      {user?.id && (
        <CreateHotSheetDialog
          open={createHsOpen}
          onOpenChange={setCreateHsOpen}
          userId={user.id}
          clientId={client.id}
          clientName={capitalizedName}
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
    </PageShell>
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
