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
      // Query the conversation_inbox view directly - no N+1!
      const { data: inboxData, error } = await supabase
        .from("conversation_inbox")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching inbox:", error);
        setLoading(false);
        return;
      }

      if (!inboxData || inboxData.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // Get profiles for all other users in one query
      const otherUserIds = inboxData.map((row: any) => row.other_user_id);
      const { data: profiles } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, email")
        .in("id", otherUserIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      // Map to thread format
      const formattedThreads: ConversationThread[] = inboxData.map((row: any) => {
        const profile = profileMap.get(row.other_user_id);
        return {
          id: row.conversation_id,
          otherUserId: row.other_user_id,
          otherUserName: profile
            ? `${profile.first_name} ${profile.last_name}`
            : "Unknown Agent",
          otherUserEmail: profile?.email || "",
          lastMessagePreview: row.last_message_preview?.substring(0, 100) || null,
          lastMessageAt: row.last_message_at,
          lastMessageSenderId: row.last_message_sender_id,
          isUnread: row.is_unread,
          listingId: row.listing_id,
          buyerNeedId: row.buyer_need_id,
        };
      });

      setThreads(formattedThreads);
    } catch (error) {
      console.error("Error building thread list:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Subscribe to realtime changes - only for messages where recipient is current user
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
          filter: `recipient_agent_id=eq.${user.id}`,
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
