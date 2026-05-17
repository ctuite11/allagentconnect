import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { findOrCreateConversation } from "@/lib/startConversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HotSheetCommentPreviewSync } from "@/hooks/useConversation";
import { cn } from "@/lib/utils";

/** Bounded chat panel — matches Messages column feel, not full viewport height. */
const LISTING_CHAT_PANEL_CLASS = cn(
  "flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white",
  "h-[min(680px,calc(100dvh-96px))] max-h-[min(680px,calc(100dvh-96px))]",
  "shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
);

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
          // Override shadcn right sheet defaults (inset-y-0 h-full) — float a bounded panel with margins.
          "!inset-y-auto top-6 bottom-6 right-0 flex !h-auto w-full max-w-none flex-col justify-start gap-0 border-0 bg-transparent p-4 shadow-none sm:max-w-[592px]",
          "[&>button]:hidden",
        )}
      >
        <SheetTitle className="sr-only">{threadTitle?.trim() || "Listing discussion"}</SheetTitle>
        {open ? (
          <div className={LISTING_CHAT_PANEL_CLASS}>
            {resolving || !conversationId ? (
              <AacMonogramLoader variant="section" message="Opening discussion…" className="min-h-0 flex-1" />
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
