import { useState, useEffect, useCallback, useRef } from "react";
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
  // Conversation IDs the caller just deleted/archived locally. We hide these
  // from any refetch/realtime response for a short grace window so a racing
  // server response can't make them flash back into the inbox before the
  // archive UPDATE round-trips.
  const archivedIdsRef = useRef<Map<string, number>>(new Map());

  const isLocallyArchived = useCallback((id: string) => {
    const expires = archivedIdsRef.current.get(id);
    if (!expires) return false;
    if (Date.now() > expires) {
      archivedIdsRef.current.delete(id);
      return false;
    }
    return true;
  }, []);

  const markArchivedLocally = useCallback((ids: string[]) => {
    const expiry = Date.now() + 10_000;
    ids.forEach((id) => {
      if (id) archivedIdsRef.current.set(id, expiry);
    });
    setThreads((prev) => prev.filter((t) => !ids.includes(t.id)));
  }, []);

  const clearLocalArchive = useCallback((ids: string[]) => {
    ids.forEach((id) => archivedIdsRef.current.delete(id));
  }, []);

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

      const filteredInbox = (inboxData ?? []).filter(
        (row: any) => !isLocallyArchived(row.conversation_id)
      );

      // Newly created conversations with no messages are missing from
      // conversation_inbox, so a fresh thread (e.g. "Message" from an agent
      // profile) would be invisible to both participants until the first
      // message. Merge them in with created_at as the activity timestamp.
      const inboxIds = new Set(filteredInbox.map((row: any) => row.conversation_id));
      let missingConvos: Array<{
        id: string;
        agent_a_id: string;
        agent_b_id: string;
        created_at: string;
        listing_id: string | null;
        buyer_need_id: string | null;
      }> = [];
      try {
        const { data: convRows, error: convError } = await supabase
          .from("conversations")
          .select("id, agent_a_id, agent_b_id, created_at, listing_id, buyer_need_id")
          .or(`agent_a_id.eq.${user.id},agent_b_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(100);
        if (convError) {
          console.error("Error fetching empty conversations:", convError);
        } else {
          const candidates = (convRows ?? []).filter(
            (c) => !inboxIds.has(c.id) && !isLocallyArchived(c.id)
          );
          if (candidates.length > 0) {
            // Respect per-user archive: a conversation the user deleted from
            // their inbox must not reappear via this merge.
            const { data: cpRows } = await supabase
              .from("conversation_participants")
              .select("conversation_id, is_archived")
              .in("conversation_id", candidates.map((c) => c.id))
              .eq("user_id", user.id);
            const archivedIds = new Set(
              (cpRows ?? [])
                .filter((cp) => cp.is_archived === true)
                .map((cp) => cp.conversation_id)
            );
            missingConvos = candidates.filter((c) => !archivedIds.has(c.id));
          }
        }
      } catch (mergeError) {
        // Merge is best-effort — never break the main inbox on failure.
        console.error("Error merging empty conversations:", mergeError);
      }

      if (filteredInbox.length === 0 && missingConvos.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const otherUserIds = [
        ...filteredInbox.map((row: any) => row.other_user_id),
        ...missingConvos.map((c) => (c.agent_a_id === user.id ? c.agent_b_id : c.agent_a_id)),
      ];
      const profileMap = await resolveDisplayProfiles(otherUserIds);

      const toDisplayName = (otherUserId: string) => {
        const profile = profileMap.get(otherUserId);
        return {
          otherUserName: profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
            : "Unknown User",
          otherUserEmail: profile?.email || "",
          otherUserHeadshotUrl: profile?.headshot_url ?? null,
          otherUserIsAgent: profile?.isAgent ?? false,
        };
      };

      const formattedThreads: ConversationThread[] = filteredInbox.map((row: any) => ({
        id: row.conversation_id,
        otherUserId: row.other_user_id,
        ...toDisplayName(row.other_user_id),
        lastMessagePreview: row.last_message_preview?.substring(0, 100) || null,
        lastMessageAt: row.last_message_at,
        lastMessageSenderId: row.last_message_sender_id,
        isUnread: row.is_unread,
        unreadCount: typeof row.unread_count === 'number' ? row.unread_count : (row.is_unread ? 1 : 0),
        listingId: row.listing_id,
        buyerNeedId: row.buyer_need_id,
      }));

      const emptyThreads: ConversationThread[] = missingConvos.map((c) => {
        const otherUserId = c.agent_a_id === user.id ? c.agent_b_id : c.agent_a_id;
        return {
          id: c.id,
          otherUserId,
          ...toDisplayName(otherUserId),
          lastMessagePreview: null,
          lastMessageAt: c.created_at,
          lastMessageSenderId: null,
          isUnread: false,
          unreadCount: 0,
          listingId: c.listing_id,
          buyerNeedId: c.buyer_need_id,
        };
      });

      const merged = [...formattedThreads, ...emptyThreads].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setThreads(merged);
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

  return {
    threads,
    loading,
    refetch: fetchThreads,
    inboxFetchError,
    markArchivedLocally,
    clearLocalArchive,
  };
}
