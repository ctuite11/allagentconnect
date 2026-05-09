import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, TrendingUp, Megaphone } from "lucide-react";
import { mockCommunications, mockMessages, type FeedType } from "./mockData";

const feedIcon: Record<FeedType, React.ReactNode> = {
  buyer_need: <Users className="h-3.5 w-3.5 text-primary" />,
  email: <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
  market_signal: <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />,
  agent_post: <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />,
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
    <PageShell className="pb-10">
      <PageHeader title="Communications" />

      <div className="grid gap-8 lg:grid-cols-5">
        {/* ── Left: Feed ───────────────────────────────── */}
        <div className="lg:col-span-3">
          <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Feed</h2>
          <Card className="border border-zinc-100 bg-white shadow-none">
            <CardContent className="divide-y divide-zinc-100 p-0">
              {mockCommunications.map((item) => (
                <div key={item.feedId} className="flex items-center gap-3 px-5 py-3.5">
                  {feedIcon[item.type]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relativeTime(item.timestamp)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Messages ──────────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Messages</h2>
          <div className="space-y-2 mb-6">
            {mockMessages.map((t) => (
              <Card
                key={t.threadId}
                className={`cursor-pointer border bg-white shadow-none transition-all duration-200 ease-out ${
                  selectedThread === t.threadId
                    ? "border-[#0E56F5]"
                    : "border-neutral-200 hover:-translate-y-[1px] hover:border-neutral-300 hover:shadow-md"
                }`}
                onClick={() => setSelectedThread(t.threadId)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{t.contactName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{t.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{relativeTime(t.timestamp)}</span>
                    {t.unread > 0 && <Badge variant="default" className="text-[10px]">{t.unread}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversation detail */}
          {activeThread && (
            <Card className="border border-zinc-100 bg-white shadow-none">
              <CardContent className="p-5">
                <p className="font-semibold text-sm text-foreground mb-4">{activeThread.contactName}</p>
                <div className="space-y-3">
                  <div className="rounded-xl border border-zinc-100 bg-white p-3.5">
                    <p className="text-sm text-foreground">{activeThread.lastMessage}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{relativeTime(activeThread.timestamp)}</p>
                  </div>
                  <div className="ml-8 rounded-xl border border-zinc-100 bg-white p-3.5">
                    <p className="text-sm text-foreground">Thanks, I'll follow up on that today.</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">You · just now</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
