import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MessageSquare, Plus, Pencil,
  Bed, Bath, Home, Heart, Clock
} from "lucide-react";
import { toast } from "sonner";
import { useBuyerDashboard } from "@/hooks/useBuyerDashboard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { useAuthRole } from "@/hooks/useAuthRole";
import { format } from "date-fns";
import AACMonogram from "@/components/ui/AACMonogram";
import { Card, CardContent } from "@/components/ui/card";

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolvePhoto(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (raw?.url && typeof raw.url === "string") return raw.url;
  return null;
}

function getFirstPhoto(photos: any): string | null {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
  return resolvePhoto(photos[0]);
}

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

// ── Mini listing card ────────────────────────────────────────────────────────

function MiniListingCard({ listing, onClick }: { listing: any; onClick?: () => void }) {
  const photo = getFirstPhoto(listing.photos);

  return (
    <div
      className="overflow-hidden cursor-pointer rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg"
      onClick={onClick}
    >
      <div className="aspect-square bg-muted relative overflow-hidden rounded-t-2xl">
        {photo ? (
          <img src={photo} alt={listing.address} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-foreground/75 backdrop-blur-sm text-primary-foreground text-xs px-2.5 py-1 rounded-lg font-semibold tracking-tight">
          {formatPrice(listing.price || 0)}
        </div>
      </div>
      <div className="p-3.5">
        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{listing.address}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {[listing.city, listing.state].filter(Boolean).join(", ")} {listing.zip_code}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-0.5"><Bed className="h-3 w-3" />{listing.bedrooms}</span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{listing.bathrooms}</span>
          )}
          {listing.square_feet != null && (
            <span>{listing.square_feet.toLocaleString()} sf</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ id, icon, title, count }: { id: string; icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div id={id} className="flex items-center gap-2.5 mb-5 scroll-mt-32">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
      {count != null && (
        <Badge variant="secondary" className="ml-1 text-[11px] font-medium bg-accent text-accent-foreground">
          {count}
        </Badge>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthRole();
  const { client, hotSheets, favorites, activity, stats, loading } = useBuyerDashboard(buyerId);
  const [createHsOpen, setCreateHsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hotsheets");

  // Refs for scroll-to
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <PageHeader title="Buyer Not Found" backTo="/success-hub/buyers" />
        <p className="text-muted-foreground">No buyer found with that ID.</p>
      </PageShell>
    );
  }

  const buyerName =
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || client.email;
  const capitalizedName = buyerName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return (
    <PageShell className="bg-background">
      <PageHeader title={capitalizedName} backTo="/success-hub/buyers" />

      {/* ── Buyer Header ──────────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* Identity */}
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 mt-0.5">
                <AACMonogram className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground tracking-tight">
                  {capitalizedName}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{client.email}</p>
                {client.phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <StatBlock value={stats.hotSheetCount} label="Hot Sheets" />
              <StatBlock value={stats.favoritesCount} label="Favorites" />
              <StatBlock value={stats.messagesCount} label="Messages" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-5">
            <Button
              size="sm"
              onClick={() => navigate("/messages")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateHsOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Hot Sheet
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Edit buyer — coming soon")}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Buyer
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section Nav ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border mb-8 -mx-6 px-6">
        <nav className="flex items-center gap-1 py-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeSection === s.id
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Hot Sheets ────────────────────────────────────────────────── */}
      <section ref={(el) => { sectionRefs.current.hotsheets = el; }} className="mb-12">
        <SectionHeading id="hotsheets-heading" icon={<Home className="h-4 w-4" />} title="Hot Sheets" count={stats.hotSheetCount} />

        {hotSheets.length === 0 ? (
          <EmptyState
            icon={<Home className="h-8 w-8 text-muted-foreground/40" />}
            title="No Hot Sheets"
            description="Create a hot sheet to start matching listings for this buyer."
            action={
              <Button size="sm" onClick={() => setCreateHsOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
                  {/* Hot sheet meta */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Hot Sheet Name:</span>{" "}
                        <span className="text-primary font-semibold">{hs.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hs.matchCount} listing{hs.matchCount !== 1 ? "s" : ""} match
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
                      className="text-primary border-primary/30 hover:bg-primary/5"
                    >
                      View All
                    </Button>
                  </div>

                  {pills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {pills.map((pill, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs font-normal bg-accent text-accent-foreground"
                        >
                          {pill}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {hs.topListings.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {hs.topListings.map((listing: any) => (
                        <MiniListingCard
                          key={listing.id}
                          listing={listing}
                          onClick={() => navigate(`/listing/${listing.id}`)}
                        />
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

      {/* ── Favorites ─────────────────────────────────────────────────── */}
      <section ref={(el) => { sectionRefs.current.favorites = el; }} className="mb-12">
        <SectionHeading id="favorites-heading" icon={<Heart className="h-4 w-4" />} title="Favorites" count={stats.favoritesCount} />

        {favorites.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-8 w-8 text-muted-foreground/40" />}
            title="No Favorites"
            description="This buyer hasn't favorited any listings yet."
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {favorites.map((listing: any) => (
              <MiniListingCard
                key={listing.id}
                listing={listing}
                onClick={() => navigate(`/listing/${listing.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Activity ──────────────────────────────────────────────────── */}
      <section ref={(el) => { sectionRefs.current.activity = el; }} className="mb-12">
        <SectionHeading id="activity-heading" icon={<Clock className="h-4 w-4" />} title="Activity" count={activity.length} />

        {activity.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8 text-muted-foreground/40" />}
            title="No Activity"
            description="Comments and activity will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activity.map((item) => (
              <Card key={item.id} className="border-border bg-card shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.comment}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-[10px] font-normal capitalize bg-accent text-accent-foreground">
                          {item.sender_role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Messages ──────────────────────────────────────────────────── */}
      <section ref={(el) => { sectionRefs.current.messages = el; }} className="mb-12">
        <SectionHeading id="messages-heading" icon={<MessageSquare className="h-4 w-4" />} title="Messages" count={stats.messagesCount} />

        <EmptyState
          icon={<MessageSquare className="h-8 w-8 text-muted-foreground/40" />}
          title="Messages"
          description="Open the messaging workspace to communicate with this buyer."
          action={
            <Button size="sm" onClick={() => navigate("/messages")} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Open Messages
            </Button>
          }
        />
      </section>

      {/* ── Create Hot Sheet Dialog ────────────────────────────────────── */}
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

// ── Shared empty state ───────────────────────────────────────────────────────

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
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border bg-muted/30">
      {icon}
      <h3 className="text-sm font-semibold text-foreground mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
