import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";

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
      const { data, error } = await supabase
        .from("conversation_inbox")
        .select("unread_count");

      if (error) {
        console.error("Error fetching unread count:", error);
        setUnreadCount(0);
      } else {
        const total = (data ?? []).reduce((sum, row) => {
          const n = typeof row.unread_count === "number" ? row.unread_count : 0;
          return sum + Math.max(0, n);
        }, 0);
        setUnreadCount(total);
      }
    } catch (error) {
      console.error("Error calculating unread count:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Subscribe to realtime message inserts - only for messages where recipient is current user
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
          filter: `recipient_agent_id=eq.${user.id}`,
        },
        () => {
          // Only refetch when we receive a message (not when we send)
          fetchUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // last_read_at or is_archived changed → recompute badge.
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return { unreadCount, loading, refetch: fetchUnreadCount };
}
