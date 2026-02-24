import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Mail, TrendingUp, Megaphone, Clock } from "lucide-react";
import { mockCommunications, mockMessages, type FeedType } from "./mockData";

const feedIcon: Record<FeedType, React.ReactNode> = {
  buyer_need: <Users className="h-4 w-4 text-primary" />,
  email: <Mail className="h-4 w-4 text-muted-foreground" />,
  market_signal: <TrendingUp className="h-4 w-4 text-neon-green" />,
  agent_post: <Megaphone className="h-4 w-4 text-warning" />,
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunicationsHub() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const activeThread = mockMessages.find((t) => t.threadId === selectedThread);

  return (
    <PageShell>
      <PageHeader title="Communications" backTo="/success-hub" />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left: Feed (60%) ─────────────────────────── */}
        <div className="lg:col-span-3 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Feed</h2>
          {mockCommunications.map((item) => (
            <div
              key={item.feedId}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {feedIcon[item.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(item.timestamp)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Right: Messages (40%) ────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Messages</h2>
          <div className="space-y-2 mb-4">
            {mockMessages.map((t) => (
              <Card
                key={t.threadId}
                className={`cursor-pointer transition-shadow ${selectedThread === t.threadId ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                onClick={() => setSelectedThread(t.threadId)}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{t.contactName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{relativeTime(t.timestamp)}</span>
                    {t.unread > 0 && <Badge variant="default">{t.unread}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversation detail */}
          {activeThread && (
            <>
              <Separator className="mb-4" />
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-semibold text-sm text-foreground mb-2">{activeThread.contactName}</p>
                <div className="space-y-2">
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-sm text-foreground">{activeThread.lastMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1">{relativeTime(activeThread.timestamp)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 ml-8">
                    <p className="text-sm text-foreground">Thanks, I'll follow up on that today.</p>
                    <p className="text-xs text-muted-foreground mt-1">You · just now</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
