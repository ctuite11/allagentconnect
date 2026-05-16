import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendListingConversationMessage } from "@/lib/sendListingConversationMessage";
import { syncHotSheetCommentPreview } from "@/lib/syncHotSheetCommentPreview";
import { toast } from "sonner";
import { format } from "date-fns";

export interface ChatMessage {
  id: string;
  hot_sheet_id: string;
  listing_id: string;
  comment: string;
  sender_role: string;
  sender_id: string | null;
  created_at: string;
}

interface ListingChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  listingId: string;
  listingAddress: string;
  messages: ChatMessage[];
  onNewMessage: (msg: ChatMessage) => void;
  viewerPerspective?: "agent" | "client";
  conversationRecipientUserId?: string | null;
  /** `hot_sheets.user_id` — required when mirroring preview rows. */
  hotSheetAgentUserId?: string | null;
}

const ListingChatDrawer = ({
  open,
  onOpenChange,
  hotSheetId,
  listingId,
  listingAddress,
  messages,
  onNewMessage,
  viewerPerspective = "agent",
  conversationRecipientUserId,
  hotSheetAgentUserId,
}: ListingChatDrawerProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`chat-${hotSheetId}-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hot_sheet_comments",
          filter: `hot_sheet_id=eq.${hotSheetId}`,
        },
        (payload) => {
          const newRow = payload.new as ChatMessage;
          if (newRow.listing_id === listingId) {
            onNewMessage(newRow);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, hotSheetId, listingId, onNewMessage]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to send a message");
        return;
      }

      const recipient =
        typeof conversationRecipientUserId === "string" ? conversationRecipientUserId.trim() : "";

      if (recipient && recipient !== user.id) {
        const sent = await sendListingConversationMessage({
          listingId,
          body: text,
          recipientUserId: recipient,
        });
        if (!sent.ok) {
          toast.error(sent.message || "Failed to send message");
          return;
        }

        const sheetAgentId = (
          hotSheetAgentUserId?.trim() ||
          (viewerPerspective === "agent" ? user.id : recipient)
        ).trim();

        const preview = await syncHotSheetCommentPreview({
          hotSheetId,
          listingId,
          comment: text,
          hotSheetAgentUserId: sheetAgentId,
        });

        if (preview.ok) {
          onNewMessage(preview.row as ChatMessage);
        }

        setNewMessage("");
        return;
      }

      const insertRow =
        viewerPerspective === "agent"
          ? {
              hot_sheet_id: hotSheetId,
              listing_id: listingId,
              comment: text,
              sender_role: "agent",
              sender_id: user.id,
            }
          : {
              hot_sheet_id: hotSheetId,
              listing_id: listingId,
              comment: text,
              sender_id: user.id,
            };

      const { data, error } = await supabase.from("hot_sheet_comments").insert(insertRow).select().single();

      if (error) {
        console.error("hot_sheet_comments insert:", error.message, error);
        toast.error(error.message || "Failed to save comment");
        return;
      }

      onNewMessage(data as ChatMessage);
      setNewMessage("");

      if (viewerPerspective === "agent") {
        toast.warning(
          "Comment saved on this hot sheet. Link an onboarded buyer to your sheet for inbox and email alerts.",
          { duration: 6000 },
        );
      } else {
        toast.warning(
          "Comment saved here, but Messages could not be synced — this sheet has no tied agent.",
          { duration: 6000 },
        );
      }
    } catch (err: unknown) {
      console.error("Error sending message:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base">Chat — {listingAddress}</SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Start the conversation!
            </p>
          )}
          {sorted.map((msg) => {
            const isMine =
              viewerPerspective === "agent"
                ? msg.sender_role === "agent"
                : msg.sender_role !== "agent";
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="leading-snug">{msg.comment}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t px-4 py-3 flex items-end gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={viewerPerspective === "client" ? "Message your agent..." : "Type a reply..."}
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ListingChatDrawer;
