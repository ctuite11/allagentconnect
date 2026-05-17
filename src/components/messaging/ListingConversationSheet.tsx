import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { findOrCreateConversation } from "@/lib/startConversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HotSheetCommentPreviewSync } from "@/hooks/useConversation";
import { cn } from "@/lib/utils";

interface ListingConversationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string | null;
  otherUserId: string | null | undefined;
  threadTitle?: string | null;
  onInboxInvalidate?: () => void;
  /** When set, mirror sends to `hot_sheet_comments` with email suppressed (card previews). */
  hotSheetId?: string | null;
  hotSheetAgentUserId?: string | null;
}

/**
 * Listing-scoped DM sheet — same `conversation_messages` thread as /messages.
 */
export function ListingConversationSheet({
  open,
  onOpenChange,
  listingId,
  otherUserId,
  threadTitle,
  onInboxInvalidate,
  hotSheetId,
  hotSheetAgentUserId,
}: ListingConversationSheetProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!open) {
      setConversationId(null);
      setResolving(false);
      return;
    }

    const lid = listingId?.trim();
    const other = typeof otherUserId === "string" ? otherUserId.trim() : "";

    if (!lid || !other) {
      setConversationId(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setConversationId(null);

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setResolving(false);
        return;
      }

      const convId = await findOrCreateConversation(user.id, other, { listingId: lid });
      if (cancelled) return;

      if (!convId) {
        toast.error("Could not open this conversation.");
        setResolving(false);
        onOpenChange(false);
        return;
      }

      setConversationId(convId);
      setResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, listingId, otherUserId, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const hotSheetPreviewSync: HotSheetCommentPreviewSync | null = (() => {
    const hsId = hotSheetId?.trim();
    const lid = listingId?.trim();
    const agentId = hotSheetAgentUserId?.trim();
    if (!hsId || !lid || !agentId) return null;
    return { hotSheetId: hsId, listingId: lid, hotSheetAgentUserId: agentId };
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col gap-0 overflow-hidden border-l border-neutral-200 bg-white p-0 sm:max-w-[560px]",
          "[&>button]:hidden",
        )}
      >
        <SheetTitle className="sr-only">{threadTitle?.trim() || "Listing discussion"}</SheetTitle>
        {open ? (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
            {resolving || !conversationId ? (
              <AacMonogramLoader variant="section" message="Opening discussion…" className="flex-1" />
            ) : (
              <ConversationPanel
                conversationId={conversationId}
                threadTitle={threadTitle}
                onCloseRequest={handleClose}
                onInboxInvalidate={onInboxInvalidate}
                layoutVariant="embedded"
                hotSheetPreviewSync={hotSheetPreviewSync}
              />
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
