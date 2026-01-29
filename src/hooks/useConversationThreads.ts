import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";

interface ConversationThread {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  lastMessageSenderId: string | null;
  isUnread: boolean;
  listingId: string | null;
  buyerNeedId: string | null;
}

export function useConversationThreads() {
  const { user } = useAuthRole();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }

    try {
      // Get conversations where user is participant (via new table or legacy fields)
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("id, agent_a_id, agent_b_id, listing_id, buyer_need_id, last_message_at, created_at")
        .or(`agent_a_id.eq.${user.id},agent_b_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching conversations:", error);
        setLoading(false);
        return;
      }

      if (!convos || convos.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // Get participant read cursors for current user
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      const participantMap = new Map(
        (participants || []).map((p) => [p.conversation_id, p.last_read_at])
      );

      // Build thread list
      const threadPromises = convos.map(async (convo) => {
        const otherUserId = convo.agent_a_id === user.id ? convo.agent_b_id : convo.agent_a_id;

        // Get other user's profile
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("first_name, last_name, email")
          .eq("id", otherUserId)
          .maybeSingle();

        // Get latest message
        const { data: latestMsg } = await supabase
          .from("conversation_messages")
          .select("body, sender_agent_id, created_at")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastReadAt = participantMap.get(convo.id);
        const lastMessageAt = latestMsg?.created_at || convo.last_message_at || convo.created_at;

        // Determine unread status
        const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
        const lastMsgTime = new Date(lastMessageAt).getTime();
        const isUnread =
          lastMsgTime > lastReadTime &&
          latestMsg?.sender_agent_id !== user.id;

        return {
          id: convo.id,
          otherUserId,
          otherUserName: profile
            ? `${profile.first_name} ${profile.last_name}`
            : "Unknown Agent",
          otherUserEmail: profile?.email || "",
          lastMessagePreview: latestMsg?.body?.substring(0, 100) || null,
          lastMessageAt,
          lastMessageSenderId: latestMsg?.sender_agent_id || null,
          isUnread,
          listingId: convo.listing_id,
          buyerNeedId: convo.buyer_need_id,
        };
      });

      const results = await Promise.all(threadPromises);
      setThreads(results);
    } catch (error) {
      console.error("Error building thread list:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversation_threads")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchThreads]);

  return { threads, loading, refetch: fetchThreads };
}
