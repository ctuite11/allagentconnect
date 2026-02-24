import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Heart, Clock, Send, Home } from "lucide-react";
import { toast } from "sonner";
import {
  mockBuyers,
  mockBuyerHotSheets,
  mockBuyerActivity,
  mockListings,
  mockMessages,
} from "./mockData";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  new: "outline",
};

export default function BuyerAccount() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const navigate = useNavigate();
  const buyer = mockBuyers.find((b) => b.buyerId === buyerId);

  if (!buyer) {
    return (
      <PageShell>
        <PageHeader title="Buyer Not Found" backTo="/success-hub/buyers" />
        <p className="text-muted-foreground">No buyer found with that ID.</p>
      </PageShell>
    );
  }

  const hotSheets = mockBuyerHotSheets[buyer.buyerId] ?? [];
  const activity = mockBuyerActivity[buyer.buyerId] ?? [];
  // Mock favorites: first 4 listings
  const favorites = mockListings.slice(0, 4);
  // Mock conversations: first 2 threads
  const threads = mockMessages.slice(0, 2);

  return (
    <PageShell>
      <PageHeader title={buyer.name} backTo="/success-hub/buyers" />

      {/* ── Header Card ────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-foreground">{buyer.name}</h2>
                <Badge variant={statusVariant[buyer.status]}>{buyer.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{buyer.email}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{buyer.hotSheets} hot sheets</span>
              <span>{buyer.favorites} favorites</span>
              <span>Last active: {buyer.lastActive}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue="hotsheets">
        <TabsList className="mb-4">
          <TabsTrigger value="hotsheets">Hot Sheets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
        </TabsList>

        {/* Hot Sheets */}
        <TabsContent value="hotsheets">
          {hotSheets.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No hot sheets for this buyer yet.</p>
          ) : (
            <div className="space-y-3">
              {hotSheets.map((hs) => (
                <Card key={hs.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm text-foreground">{hs.name}</p>
                      <p className="text-xs text-muted-foreground">{hs.criteria}</p>
                      <p className="text-xs text-muted-foreground mt-1">Last sent: {hs.lastSent}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Coming soon")}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Resend
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 py-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-foreground">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites">
          <div className="grid gap-3 sm:grid-cols-2">
            {favorites.map((l) => (
              <Card key={l.listingId}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Home className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{l.address}</p>
                    <p className="text-xs text-muted-foreground">{l.city}, {l.state} · ${l.price.toLocaleString()}</p>
                  </div>
                  <Heart className="h-4 w-4 text-destructive" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Conversations */}
        <TabsContent value="conversations">
          {threads.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No conversations yet.</p>
          ) : (
            <div className="space-y-3">
              {threads.map((t) => (
                <Card key={t.threadId} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => toast.info("Coming soon")}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm text-foreground">{t.contactName}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.lastMessage}</p>
                    </div>
                    {t.unread > 0 && (
                      <Badge variant="default">{t.unread}</Badge>
                    )}
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
