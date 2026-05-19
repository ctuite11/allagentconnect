import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Send, User, Building2 } from "lucide-react";
import { aacBackIconButtonClass } from "@/components/layout/AacBackLink";
import { useConversation } from "@/hooks/useConversation";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const fromLabel = (location.state as any)?.fromLabel as string | undefined;
  const {
    messages,
    details,
    loading,
    notFound,
    fetchError,
    sending,
    sendMessage,
    refetch,
  } = useConversation(id);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [listingAddress, setListingAddress] = useState<string | null>(null);

  // Hydrate listing address
  useEffect(() => {
    if (!details?.listingId) {
      setListingAddress(null);
      return;
    }
    supabase
      .from("listings")
      .select("address, city, state")
      .eq("id", details.listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setListingAddress([data.address, data.city, data.state].filter(Boolean).join(", "));
        } else {
          setListingAddress("Listing conversation");
        }
      });
  }, [details?.listingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const success = await sendMessage(newMessage.trim());
    if (success) setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-10 h-10" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
                <Skeleton className="h-16 w-64 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  if (notFound) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-8 px-4 text-center">
          <p className="text-zinc-500">Conversation not found</p>
          <Button variant="outline" className="mt-4" onClick={() => from ? navigate(from) : navigate("/messages")}>
            {fromLabel ?? "Back to Messages"}
          </Button>
        </div>
      </PageShell>
    );
  }

  if (fetchError) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-8 px-4 text-center space-y-4">
          <p className="text-zinc-600 text-sm">{fetchError}</p>
          <div className="flex gap-3 justify-center">
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
            <Button type="button" variant="outline" onClick={() => (from ? navigate(from) : navigate("/messages"))}>
              {fromLabel ?? "Back to Messages"}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="py-4 px-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => from ? navigate(from) : navigate("/messages")}
              className={cn(aacBackIconButtonClass, "rounded-lg p-2")}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2} />
            </button>
            <div
              className={cn(
                "flex items-center gap-3",
                details?.otherUserIsAgent && "cursor-pointer hover:opacity-80"
              )}
              onClick={() => details?.otherUserIsAgent && navigate(`/agent/${details.otherUserId}`)}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="font-medium text-zinc-900">{details?.otherUserName}</span>
            </div>
          </div>
          {/* Listing context line */}
          {details?.listingId && (
            <div className="flex items-center gap-1.5 ml-[52px] mt-1">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-400">
                About: {listingAddress || "Listing conversation"}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-zinc-400 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.isOwn ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5",
                    msg.isOwn
                      ? "bg-emerald-600 text-white rounded-br-md"
                      : "bg-zinc-100 text-zinc-900 rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.isOwn ? "text-emerald-100" : "text-zinc-400"
                    )}
                  >
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-zinc-200 bg-white">
          <div className="flex items-end gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
