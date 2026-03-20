import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { resolveDisplayProfiles } from "@/lib/resolveDisplayProfiles";

export interface ConversationThread {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  otherUserHeadshotUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  lastMessageSenderId: string | null;
  isUnread: boolean;
  unreadCount: number;
  listingId: string | null;
  buyerNeedId: string | null;
}

export function useConversationThreads() {
  const { user } = useAuthRole();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!user) return;

    try {
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

      const otherUserIds = inboxData.map((row: any) => row.other_user_id);
      const profileMap = await resolveDisplayProfiles(otherUserIds);

      const formattedThreads: ConversationThread[] = inboxData.map((row: any) => {
        const profile = profileMap.get(row.other_user_id);
        return {
          id: row.conversation_id,
          otherUserId: row.other_user_id,
          otherUserName: profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
            : "Unknown User",
          otherUserEmail: profile?.email || "",
          otherUserHeadshotUrl: profile?.headshot_url ?? null,
          lastMessagePreview: row.last_message_preview?.substring(0, 100) || null,
          lastMessageAt: row.last_message_at,
          lastMessageSenderId: row.last_message_sender_id,
          isUnread: row.is_unread,
          unreadCount: row.unread_count ?? (row.is_unread ? 1 : 0),
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
