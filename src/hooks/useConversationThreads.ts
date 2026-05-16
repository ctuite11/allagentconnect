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
  otherUserIsAgent: boolean;
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
  const [inboxFetchError, setInboxFetchError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!user) {
      setThreads([]);
      setInboxFetchError(null);
      setLoading(false);
      return;
    }

    try {
      setInboxFetchError(null);

      const { data: inboxData, error } = await supabase
        .from("conversation_inbox")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching inbox:", error);
        setThreads([]);
        setInboxFetchError(error.message ?? "Could not load conversation list.");
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
          otherUserIsAgent: profile?.isAgent ?? false,
          lastMessagePreview: row.last_message_preview?.substring(0, 100) || null,
          lastMessageAt: row.last_message_at,
          lastMessageSenderId: row.last_message_sender_id,
          isUnread: row.is_unread,
          unreadCount: typeof row.unread_count === 'number' ? row.unread_count : (row.is_unread ? 1 : 0),
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
      .channel(`conversation_threads_${user.id}`)
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `sender_agent_id=eq.${user.id}`,
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

  return { threads, loading, refetch: fetchThreads, inboxFetchError };
}
