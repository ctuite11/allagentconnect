import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Send, Home } from "lucide-react";
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
  const favorites = mockListings.slice(0, 4);
  const threads = mockMessages.slice(0, 2);

  return (
    <PageShell className="bg-secondary/40">
      <PageHeader title={buyer.name} backTo="/success-hub/buyers" />

      {/* ── Header Card ────────────────────────────────── */}
      <Card className="mb-8 border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-xl font-semibold text-foreground tracking-tight">{buyer.name}</h2>
                <Badge variant={statusVariant[buyer.status]} className="text-[10px]">{buyer.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{buyer.email}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{buyer.hotSheets}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hot Sheets</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{buyer.favorites}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Favorites</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{buyer.lastActive}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last Active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue="hotsheets">
        <TabsList className="mb-6 bg-transparent border-b border-border rounded-none p-0 gap-0">
          <TabsTrigger value="hotsheets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm">Hot Sheets</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm">Activity</TabsTrigger>
          <TabsTrigger value="favorites" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm">Favorites</TabsTrigger>
          <TabsTrigger value="conversations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-sm">Conversations</TabsTrigger>
        </TabsList>

        {/* Hot Sheets */}
        <TabsContent value="hotsheets">
          {hotSheets.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6">No hot sheets for this buyer yet.</p>
          ) : (
            <div className="space-y-2">
              {hotSheets.map((hs) => (
                <Card key={hs.id} className="border border-border bg-card">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="font-medium text-sm text-foreground">{hs.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{hs.criteria}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Last sent {hs.lastSent}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toast.info("Coming soon")}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Resend
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
            <p className="text-muted-foreground text-sm py-6">No activity recorded yet.</p>
          ) : (
            <div className="relative pl-5 border-l border-border">
              {activity.map((ev) => (
                <div key={ev.id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[11px] top-1 h-[7px] w-[7px] rounded-full bg-muted-foreground/40" />
                  <p className="text-sm text-foreground">{ev.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ev.date}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites">
          <div className="grid gap-3 sm:grid-cols-2">
            {favorites.map((l) => (
              <Card key={l.listingId} className="border border-border bg-card">
                <CardContent className="flex items-center gap-3 p-5">
                  <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{l.address}</p>
                    <p className="text-xs text-muted-foreground">{l.city}, {l.state} · ${l.price.toLocaleString()}</p>
                  </div>
                  <Heart className="h-4 w-4 text-destructive shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Conversations */}
        <TabsContent value="conversations">
          {threads.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6">No conversations yet.</p>
          ) : (
            <div className="space-y-2">
              {threads.map((t) => (
                <Card key={t.threadId} className="cursor-pointer border border-border bg-card hover:border-muted-foreground/30 transition-colors" onClick={() => toast.info("Coming soon")}>
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground">{t.contactName}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">{t.lastMessage}</p>
                    </div>
                    {t.unread > 0 && (
                      <Badge variant="default" className="text-[10px]">{t.unread}</Badge>
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
