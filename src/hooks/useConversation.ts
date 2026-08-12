import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { resolveDisplayProfiles } from "@/lib/resolveDisplayProfiles";
import { unarchiveConversationForUser } from "@/lib/archiveConversationsForUser";
import { syncHotSheetCommentPreview } from "@/lib/syncHotSheetCommentPreview";
import { parseMessageAttachments, type MessageAttachment } from "@/lib/messageAttachments";

export type HotSheetCommentPreviewSync = {
  hotSheetId: string;
  listingId: string;
  hotSheetAgentUserId: string;
};

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderHeadshotUrl: string | null;
  body: string;
  createdAt: string;
  isOwn: boolean;
  attachments: MessageAttachment[];
}

export interface ConversationDetails {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserHeadshotUrl: string | null;
  otherUserIsAgent: boolean;
  listingId: string | null;
}

function normalizeConversationId(conversationId: string | undefined): string | undefined {
  if (conversationId === undefined || conversationId === null) return undefined;
  const t = String(conversationId).trim();
  return t.length > 0 ? t : undefined;
}

export function useConversation(
  conversationId: string | undefined,
  options?: { hotSheetPreviewSync?: HotSheetCommentPreviewSync | null },
) {
  const { user } = useAuthRole();
  const normalizedId = normalizeConversationId(conversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [loading, setLoading] = useState(!!normalizedId);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const loadSeqRef = useRef(0);

  const fetchConversation = useCallback(async () => {
    if (!normalizedId || !user) return;

    const seq = ++loadSeqRef.current;
    setLoading(true);
    setFetchError(null);
    setNotFound(false);
    setMessages([]);
    setDetails(null);

    try {
      const { data: convo, error: convoError } = await supabase
        .from("conversations")
        .select("id, agent_a_id, agent_b_id, listing_id")
        .eq("id", normalizedId)
        .maybeSingle();

      if (seq !== loadSeqRef.current) return;

      if (convoError || !convo) {
        console.error("Error fetching conversation:", convoError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      await supabase.rpc("ensure_conversation_participants_for_caller", {
        p_conversation_id: normalizedId,
      });
      // NOTE: Do NOT auto-unarchive on open. Opening a deleted thread should
      // not restore it to the inbox. The DB trigger on new messages handles
      // unarchiving when either party actually sends/receives a message.

      const otherUserId = convo.agent_a_id === user.id ? convo.agent_b_id : convo.agent_a_id;

      const minimalProfiles = await resolveDisplayProfiles([otherUserId]);

      if (seq !== loadSeqRef.current) return;

      const otherProfileEarly = minimalProfiles.get(otherUserId);
      setDetails({
        id: convo.id,
        otherUserId,
        otherUserName: otherProfileEarly
          ? `${otherProfileEarly.first_name ?? ""} ${otherProfileEarly.last_name ?? ""}`.trim() || "Unknown User"
          : "Unknown User",
        otherUserHeadshotUrl: otherProfileEarly?.headshot_url ?? null,
        otherUserIsAgent: otherProfileEarly?.isAgent ?? false,
        listingId: convo.listing_id,
      });

      const { data: msgs, error: msgsError } = await supabase
        .from("conversation_messages")
        .select("id, sender_agent_id, body, created_at, attachments")
        .eq("conversation_id", normalizedId)
        .order("created_at", { ascending: true });

      if (seq !== loadSeqRef.current) return;

      if (msgsError) {
        console.error("Error fetching messages:", msgsError);
        setFetchError(msgsError.message || "Could not load messages for this conversation.");
        setLoading(false);
        return;
      }

      const senderIds = [...new Set((msgs || []).map((m) => m.sender_agent_id))];
      const allUserIds = [...new Set([otherUserId, ...senderIds])];
      const profileMap = await resolveDisplayProfiles(allUserIds);

      if (seq !== loadSeqRef.current) return;

      const otherProfile = profileMap.get(otherUserId);
      if (otherProfile) {
        setDetails({
          id: convo.id,
          otherUserId,
          otherUserName:
            `${otherProfile.first_name ?? ""} ${otherProfile.last_name ?? ""}`.trim() || "Unknown User",
          otherUserHeadshotUrl: otherProfile.headshot_url ?? null,
          otherUserIsAgent: otherProfile.isAgent ?? false,
          listingId: convo.listing_id,
        });
      }

      const formattedMessages: Message[] = (msgs || []).map((m) => {
        const profile = profileMap.get(m.sender_agent_id);
        const name = profile
          ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
          : "Unknown User";
        return {
          id: m.id,
          senderId: m.sender_agent_id,
          senderName: name,
          senderHeadshotUrl: profile?.headshot_url ?? null,
          body: m.body,
          createdAt: m.created_at,
          isOwn: m.sender_agent_id === user.id,
          attachments: parseMessageAttachments((m as { attachments?: unknown }).attachments),
        };
      });

      setMessages(formattedMessages);
      setNotFound(false);
      setFetchError(null);

      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", normalizedId)
        .eq("user_id", user.id);
    } catch (error) {
      console.error("Error in useConversation:", error);
      if (seq === loadSeqRef.current) {
        setFetchError(error instanceof Error ? error.message : "Something went wrong loading this thread.");
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [normalizedId, user]);

  useEffect(() => {
    if (!normalizedId) {
      loadSeqRef.current += 1;
      setLoading(false);
      setNotFound(false);
      setFetchError(null);
      setMessages([]);
      setDetails(null);
      return;
    }

    if (!user) {
      setLoading(true);
      setFetchError(null);
      return;
    }

    fetchConversation();
  }, [normalizedId, user, fetchConversation]);

  useEffect(() => {
    if (!normalizedId || !user) return;

    const channel = supabase
      .channel(`conversation_${normalizedId}_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${normalizedId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          const sid = newMsg.sender_agent_id as string;

          const profileMap = await resolveDisplayProfiles([sid]);
          const profile = profileMap.get(sid);
          const name = profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
            : "Unknown User";

          const message: Message = {
            id: newMsg.id as string,
            senderId: sid,
            senderName: name,
            senderHeadshotUrl: profile?.headshot_url ?? null,
            body: newMsg.body as string,
            createdAt: newMsg.created_at as string,
            isOwn: sid === user.id,
            attachments: parseMessageAttachments(newMsg.attachments),
          };

          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));

          if (sid !== user.id) {
            await supabase
              .from("conversation_participants")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", normalizedId)
              .eq("user_id", user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [normalizedId, user]);

  const sendMessage = useCallback(
    async (body: string, attachments: MessageAttachment[] = []) => {
      if (!normalizedId || !user || !details || sending) return false;
      if (!body.trim() && attachments.length === 0) return false;

      setSending(true);
      try {
        // Sending a message intentionally restores the thread for the sender.
        await unarchiveConversationForUser(supabase, normalizedId);

        const { error } = await supabase.from("conversation_messages").insert({
          conversation_id: normalizedId,
          sender_agent_id: user.id,
          recipient_agent_id: details.otherUserId,
          body,
          attachments: attachments as unknown as never,
        });

        if (error) {
          console.error("Error sending message:", error);
          return false;
        }

        const preview = options?.hotSheetPreviewSync;
        if (preview?.hotSheetId && preview.listingId && preview.hotSheetAgentUserId) {
          await syncHotSheetCommentPreview({
            hotSheetId: preview.hotSheetId,
            listingId: preview.listingId,
            comment: body,
            hotSheetAgentUserId: preview.hotSheetAgentUserId,
          });
        }

        supabase.functions.invoke("kick-email-queue").catch(() => {});

        return true;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      } finally {
        setSending(false);
      }
    },
    [normalizedId, user, details, sending, options?.hotSheetPreviewSync]
  );

  return {
    messages,
    details,
    loading,
    notFound,
    fetchError,
    sending,
    sendMessage,
    refetch: fetchConversation,
  };
}
