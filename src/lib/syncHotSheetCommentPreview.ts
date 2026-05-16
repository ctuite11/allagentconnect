import { supabase } from "@/integrations/supabase/client";

export type SyncHotSheetCommentPreviewInput = {
  hotSheetId: string;
  listingId: string;
  comment: string;
  /** Hot sheet owner (`hot_sheets.user_id`) — used to set sender_role. */
  hotSheetAgentUserId: string;
};

/**
 * Mirror a conversation message into `hot_sheet_comments` for card previews / realtime only.
 * `suppress_email_notification` prevents duplicate hot-sheet email alerts.
 */
export async function syncHotSheetCommentPreview(
  input: SyncHotSheetCommentPreviewInput,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; message: string }> {
  const comment = input.comment.trim();
  if (!comment) return { ok: false, message: "Comment is empty." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const senderRole = user.id === input.hotSheetAgentUserId.trim() ? "agent" : "client";
  const insertRow =
    senderRole === "agent"
      ? {
          hot_sheet_id: input.hotSheetId,
          listing_id: input.listingId,
          comment,
          sender_role: "agent" as const,
          sender_id: user.id,
          suppress_email_notification: true,
        }
      : {
          hot_sheet_id: input.hotSheetId,
          listing_id: input.listingId,
          comment,
          sender_id: user.id,
          suppress_email_notification: true,
        };

  const { data, error } = await supabase.from("hot_sheet_comments").insert(insertRow).select().single();
  if (error) {
    return { ok: false, message: error.message ?? "Could not sync hot sheet preview." };
  }

  return { ok: true, row: data };
}
