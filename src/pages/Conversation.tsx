import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Send, User } from "lucide-react";
import { useConversation } from "@/hooks/useConversation";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messages, details, loading, sending, sendMessage } = useConversation(id);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const success = await sendMessage(newMessage.trim());
    if (success) {
      setNewMessage("");
    }
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

  if (!details) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-8 px-4 text-center">
          <p className="text-slate-500">Conversation not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/messages")}>
            Back to Messages
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 py-4 px-4 border-b border-slate-200">
          <button
            onClick={() => navigate("/messages")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80"
            onClick={() => navigate(`/agent/${details.otherUserId}`)}
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-400" />
            </div>
            <span className="font-medium text-slate-900">{details.otherUserName}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
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
                      : "bg-slate-100 text-slate-900 rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.isOwn ? "text-emerald-100" : "text-slate-400"
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
        <div className="p-4 border-t border-slate-200 bg-white">
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
