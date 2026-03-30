import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Send, Heart, MessageSquare, Plus, Pencil,
  MapPin, Bed, Bath, Home, Clock
} from "lucide-react";
import { toast } from "sonner";
import { useBuyerDashboard } from "@/hooks/useBuyerDashboard";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { format } from "date-fns";

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

// ── Mini listing card for dashboard ──────────────────────────────────────────

function MiniListingCard({ listing, onClick }: { listing: any; onClick?: () => void }) {
  const photo = getFirstPhoto(listing.photos);

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg shadow-sm"
      onClick={onClick}
    >
      <div className="aspect-square bg-muted relative">
        {photo ? (
          <img src={photo} alt={listing.address} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-medium">
          {formatPrice(listing.price || 0)}
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium text-foreground truncate">{listing.address}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[listing.city, listing.state].filter(Boolean).join(", ")} {listing.zip_code}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthRole();
  const { client, hotSheets, favorites, activity, stats, loading } = useBuyerDashboard(buyerId);

  const [createHsOpen, setCreateHsOpen] = useState(false);

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
    <PageShell className="bg-secondary/40">
      <PageHeader title={capitalizedName} backTo="/success-hub/buyers" />

      {/* ── Header Card ────────────────────────────────────────────────────── */}
      <Card className="mb-8 border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* Info */}
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                {capitalizedName}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{client.email}</p>
              {client.phone && (
                <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.hotSheetCount}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hot Sheets</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.favoritesCount}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Favorites</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{stats.messagesCount}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Messages</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/messages")}
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
        </CardContent>
      </Card>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="hotsheets">
        <TabsList className="mb-6 bg-transparent border-b border-border rounded-none p-0 gap-0">
          <TabsTrigger
            value="hotsheets"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm"
          >
            Hot Sheets
          </TabsTrigger>
          <TabsTrigger
            value="favorites"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm"
          >
            Favorites
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm"
          >
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm"
          >
            Messages
          </TabsTrigger>
        </TabsList>

        {/* ── Hot Sheets ──────────────────────────────────────────────────── */}
        <TabsContent value="hotsheets">
          {hotSheets.length === 0 ? (
            <EmptyState
              icon={<Home className="h-8 w-8 text-muted-foreground/50" />}
              title="No Hot Sheets"
              description="Create a hot sheet to start matching listings for this buyer."
              action={
                <Button size="sm" onClick={() => setCreateHsOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Hot Sheet
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {hotSheets.map((hs) => {
                const pills = criteriaPills(hs.criteria);
                return (
                  <div key={hs.id}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{hs.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {hs.matchCount} listing{hs.matchCount !== 1 ? "s" : ""} match
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hot-sheets/${hs.id}/review`)}
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
                            className="text-xs font-normal"
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
        </TabsContent>

        {/* ── Favorites ──────────────────────────────────────────────────── */}
        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <EmptyState
              icon={<Heart className="h-8 w-8 text-muted-foreground/50" />}
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
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────────── */}
        <TabsContent value="activity">
          {activity.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-8 w-8 text-muted-foreground/50" />}
              title="No Activity"
              description="Comments and activity will appear here."
            />
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <Card key={item.id} className="border border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{item.comment}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-[10px] font-normal capitalize">
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
        </TabsContent>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <TabsContent value="messages">
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-muted-foreground/50" />}
            title="Messages"
            description="Open the messaging workspace to communicate with this buyer."
            action={
              <Button size="sm" onClick={() => navigate("/messages")}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Open Messages
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      {/* ── Create Hot Sheet Dialog ────────────────────────────────────────── */}
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <h3 className="text-sm font-semibold text-foreground mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
