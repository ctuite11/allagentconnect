import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface ConversationThread {
  id: string;
  otherAgent: {
    id: string;
    first_name: string;
    last_name: string;
    headshot_url: string | null;
    company: string | null;
  };
  listing?: {
    id: string;
    address: string;
    status: string;
  } | null;
  buyerNeed?: {
    id: string;
    city: string | null;
    max_price: number;
  } | null;
  lastMessage: {
    body: string;
    created_at: string;
    sender_agent_id: string;
  };
  unreadCount: number;
  updated_at: string;
}

interface ConversationListProps {
  conversations: ConversationThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
  loading?: boolean;
}

const getContextBadge = (thread: ConversationThread) => {
  if (thread.listing) {
    const status = thread.listing.status?.toLowerCase();
    if (status === "off_market") return { label: "OFF-MARKET", variant: "secondary" as const };
    if (status === "coming_soon") return { label: "COMING SOON", variant: "outline" as const };
    return { label: "LISTING", variant: "default" as const };
  }
  if (thread.buyerNeed) return { label: "BUYER NEED", variant: "default" as const };
  return { label: "GENERAL", variant: "outline" as const };
};

const getContextLabel = (thread: ConversationThread) => {
  if (thread.listing) {
    return thread.listing.address;
  }
  if (thread.buyerNeed) {
    const city = thread.buyerNeed.city || "Unknown";
    const price = thread.buyerNeed.max_price 
      ? `$${(thread.buyerNeed.max_price / 1000).toFixed(0)}K` 
      : "";
    return `Buyer Need – ${city} ${price}`.trim();
  }
  return "General Conversation";
};

export const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  currentUserId,
  loading,
}: ConversationListProps) => {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Messages from other agents will appear here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((thread) => {
        const badge = getContextBadge(thread);
        const contextLabel = getContextLabel(thread);
        const isFromOther = thread.lastMessage.sender_agent_id !== currentUserId;
        const hasUnread = thread.unreadCount > 0;

        return (
          <button
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            className={cn(
              "w-full text-left p-4 hover:bg-muted/50 transition-colors",
              selectedId === thread.id && "bg-muted",
              hasUnread && "bg-primary/5"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={thread.otherAgent.headshot_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {thread.otherAgent.first_name?.[0]}
                    {thread.otherAgent.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn(
                    "font-medium text-sm truncate",
                    hasUnread && "font-semibold"
                  )}>
                    {thread.otherAgent.first_name} {thread.otherAgent.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                  </span>
                </div>
                
                {thread.otherAgent.company && (
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {thread.otherAgent.company}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
                    {badge.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {contextLabel}
                  </span>
                </div>
                
                <p className={cn(
                  "text-xs text-muted-foreground truncate",
                  hasUnread && "text-foreground font-medium"
                )}>
                  {isFromOther ? "" : "You: "}
                  {thread.lastMessage.body.slice(0, 80)}
                  {thread.lastMessage.body.length > 80 ? "..." : ""}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
