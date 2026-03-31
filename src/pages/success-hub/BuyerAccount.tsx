import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MessageSquare, Plus, Pencil,
  ArrowLeft, Home, Heart, Clock, Eye
} from "lucide-react";
import { toast } from "sonner";
import { useBuyerDashboard } from "@/hooks/useBuyerDashboard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { EditBuyerDialog } from "@/components/success-hub/EditBuyerDialog";
import { useAuthRole } from "@/hooks/useAuthRole";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import ListingCard from "@/components/ListingCard";
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
  { id: "favorites", label: "Favorites" },
  { id: "activity", label: "Activity" },
  { id: "messages", label: "Messages" },
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
          <div className="space-y-10">
            {hotSheets.map((hs) => {
              const pills = criteriaPills(hs.criteria);
              return (
                <div key={hs.id}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{hs.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hs.matchCount} listing {hs.matchCount === 1 ? "match" : "matches"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/hot-sheets/${hs.id}/review`, {
                          state: { from: `/success-hub/buyers/${buyerId}` },
                        })
                      }
                    >
                      View All
                    </Button>
                  </div>

                  {pills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
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

                  {hs.topListings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {hs.topListings.map((listing: any) => (
                        <div key={listing.id} className="relative group">
                          <ListingCard
                            listing={listing}
                            viewMode="compact"
                            showActions={false}
                          />
                          {buyerOnPlatform && (
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleListingMessage(listing.id);
                              }}
                              disabled={messagingBusy}
                              className="absolute top-2 right-2 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card shadow-sm"
                              title="Message about this listing"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-foreground hover:text-primary transition-colors" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">
                      No matching listings yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Favorites ─────────────────────────── */}
      <section ref={(el: HTMLDivElement | null) => { sectionRefs.current.favorites = el; }} className="mb-12">
        <SectionHeading title="Favorites" count={stats.favoritesCount} />

        {favorites.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-5 w-5 text-muted-foreground" />}
            title="No Favorites"
            description="This buyer hasn't favorited any listings yet."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((listing: any) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                viewMode="compact"
                showActions={false}
              />
            ))}
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

      {/* ── Messages ──────────────────────────── */}
      <section ref={(el: HTMLDivElement | null) => { sectionRefs.current.messages = el; }} className="mb-12">
        <SectionHeading title="Messages" count={stats.messagesCount} />

        {!buyerOnPlatform ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
            title="Messaging Unavailable"
            description="In-app messaging is available once this buyer creates an account."
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />}
            title="No Messages Yet"
            description="Start a conversation with this buyer."
            action={
              <Button size="sm" onClick={handleGeneralMessage} disabled={messagingBusy}>
                {messagingBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                )}
                Start Conversation
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {/* General conversations */}
            {generalConversations.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">General</p>
                {generalConversations.map((c) => (
                  <Card
                    key={c.id}
                    className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/messages/${c.id}`)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">General Conversation</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.last_message_at), "MMM d, yyyy")}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Listing-specific conversations */}
            {listingConversations.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">By Listing</p>
                <div className="space-y-2">
                  {listingConversations.map((c) => (
                    <Card
                      key={c.id}
                      className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/messages/${c.id}`)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {c.listing_address || "Listing"}{c.listing_city ? `, ${c.listing_city}` : ""}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.last_message_at), "MMM d, yyyy")}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* CTA to start general if none exists */}
            {generalConversations.length === 0 && (
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={handleGeneralMessage} disabled={messagingBusy}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Start General Conversation
                </Button>
              </div>
            )}
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
