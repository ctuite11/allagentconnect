import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Send, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { ConversationThread } from "./ConversationList";

interface Message {
  id: string;
  sender_agent_id: string;
  recipient_agent_id: string;
  subject: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface ThreadViewProps {
  thread: ConversationThread | null;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (body: string) => Promise<void>;
  onBack?: () => void;
  loading?: boolean;
  sending?: boolean;
}

export const ThreadView = ({
  thread,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  loading,
  sending,
}: ThreadViewProps) => {
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    await onSendMessage(replyText.trim());
    setReplyText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a conversation</p>
          <p className="text-xs mt-1">Choose a thread from the list to view messages</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getContextPill = () => {
    if (thread.listing) {
      return (
        <Link 
          to={`/property/${thread.listing.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {thread.listing.address}
          <ExternalLink className="h-3 w-3" />
        </Link>
      );
    }
    if (thread.buyerNeed) {
      const city = thread.buyerNeed.city || "Unknown";
      const price = thread.buyerNeed.max_price 
        ? `$${thread.buyerNeed.max_price.toLocaleString()}` 
        : "";
      return (
        <Badge variant="secondary" className="text-xs">
          Buyer Need – {city} {price}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        General
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarImage src={thread.otherAgent.headshot_url || undefined} />
            <AvatarFallback>
              {thread.otherAgent.first_name?.[0]}
              {thread.otherAgent.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {thread.otherAgent.first_name} {thread.otherAgent.last_name}
              </span>
              <Link 
                to={`/agent/${thread.otherAgent.id}`}
                className="text-xs text-primary hover:underline"
              >
                View Profile
              </Link>
            </div>
            {thread.otherAgent.company && (
              <p className="text-xs text-muted-foreground">{thread.otherAgent.company}</p>
            )}
            <div className="mt-1">{getContextPill()}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender_agent_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {msg.subject && (
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    Re: {msg.subject}
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isMe 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(msg.created_at), "MMM d, h:mm a")}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply Box */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none"
          />
          <Button 
            onClick={handleSend} 
            disabled={!replyText.trim() || sending}
            className="self-end"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
