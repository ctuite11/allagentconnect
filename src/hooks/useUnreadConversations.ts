import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";

interface InboxThread {
  conversation_id: string;
  last_message_at: string;
  last_read_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  is_unread: boolean;
}

export function useUnreadConversations() {
  const { user } = useAuthRole();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Get all conversations where user is a participant
      const { data: participants, error: pError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (pError) {
        console.error("Error fetching participants:", pError);
        setLoading(false);
        return;
      }

      if (!participants || participants.length === 0) {
        // Also check legacy agent_a_id/agent_b_id pattern
        const { data: legacyConvos } = await supabase
          .from("conversations")
          .select("id")
          .or(`agent_a_id.eq.${user.id},agent_b_id.eq.${user.id}`);

        if (!legacyConvos || legacyConvos.length === 0) {
          setUnreadCount(0);
          setLoading(false);
          return;
        }

        // For legacy convos, check if there are unread messages
        let count = 0;
        for (const convo of legacyConvos) {
          const { data: latestMsg } = await supabase
            .from("conversation_messages")
            .select("sender_agent_id, created_at, read_at")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMsg && latestMsg.sender_agent_id !== user.id && !latestMsg.read_at) {
            count++;
          }
        }
        setUnreadCount(count);
        setLoading(false);
        return;
      }

      // For each conversation, check if last message is unread
      let count = 0;
      for (const p of participants) {
        const { data: convo } = await supabase
          .from("conversations")
          .select("last_message_at")
          .eq("id", p.conversation_id)
          .maybeSingle();

        if (!convo) continue;

        // Get the latest message to check sender
        const { data: latestMsg } = await supabase
          .from("conversation_messages")
          .select("sender_agent_id, created_at")
          .eq("conversation_id", p.conversation_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestMsg) continue;

        // Is unread if: last_message_at > last_read_at AND sender != current user
        const lastReadAt = p.last_read_at ? new Date(p.last_read_at).getTime() : 0;
        const lastMessageAt = new Date(convo.last_message_at).getTime();

        if (lastMessageAt > lastReadAt && latestMsg.sender_agent_id !== user.id) {
          count++;
        }
      }

      setUnreadCount(count);
    } catch (error) {
      console.error("Error calculating unread count:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Subscribe to realtime message inserts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversation_messages_unread")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        (payload) => {
          // If someone else sent a message, refresh unread count
          if (payload.new && (payload.new as any).sender_agent_id !== user.id) {
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return { unreadCount, loading, refetch: fetchUnreadCount };
}
