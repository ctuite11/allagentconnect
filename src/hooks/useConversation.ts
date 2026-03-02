import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { resolveDisplayProfiles } from "@/lib/resolveDisplayProfiles";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
}

interface ConversationDetails {
  id: string;
  otherUserId: string;
  otherUserName: string;
  listingId: string | null;
}

export function useConversation(conversationId: string | undefined) {
  const { user } = useAuthRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset notFound when conversationId changes
  useEffect(() => {
    setNotFound(false);
    setLoading(true);
    setDetails(null);
    setMessages([]);
  }, [conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId || !user) {
      // Don't set loading=false here — keep skeleton until auth resolves
      return;
    }

    try {
      const { data: convo, error: convoError } = await supabase
        .from("conversations")
        .select("id, agent_a_id, agent_b_id, listing_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (convoError || !convo) {
        console.error("Error fetching conversation:", convoError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const otherUserId = convo.agent_a_id === user.id ? convo.agent_b_id : convo.agent_a_id;

      const { data: msgs, error: msgsError } = await supabase
        .from("conversation_messages")
        .select("id, sender_agent_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (msgsError) {
        console.error("Error fetching messages:", msgsError);
        setLoading(false);
        return;
      }

      const senderIds = [...new Set((msgs || []).map((m) => m.sender_agent_id))];
      const allUserIds = [...new Set([otherUserId, ...senderIds])];
      const profileMap = await resolveDisplayProfiles(allUserIds);

      const otherProfile = profileMap.get(otherUserId);
      setDetails({
        id: convo.id,
        otherUserId,
        otherUserName: otherProfile
          ? `${otherProfile.first_name ?? ""} ${otherProfile.last_name ?? ""}`.trim() || "Unknown User"
          : "Unknown User",
        listingId: convo.listing_id,
      });

      const formattedMessages: Message[] = (msgs || []).map((m) => {
        const profile = profileMap.get(m.sender_agent_id);
        const name = profile
          ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
          : "Unknown User";
        return {
          id: m.id,
          senderId: m.sender_agent_id,
          senderName: name,
          body: m.body,
          createdAt: m.created_at,
          isOwn: m.sender_agent_id === user.id,
        };
      });

      setMessages(formattedMessages);
      setNotFound(false);

      // Mark as read
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    } catch (error) {
      console.error("Error in useConversation:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Subscribe to new messages in this conversation
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`conversation_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;

          const profileMap = await resolveDisplayProfiles([newMsg.sender_agent_id]);
          const profile = profileMap.get(newMsg.sender_agent_id);
          const name = profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown User"
            : "Unknown User";

          const message: Message = {
            id: newMsg.id,
            senderId: newMsg.sender_agent_id,
            senderName: name,
            body: newMsg.body,
            createdAt: newMsg.created_at,
            isOwn: newMsg.sender_agent_id === user.id,
          };

          setMessages((prev) => [...prev, message]);

          if (newMsg.sender_agent_id !== user.id) {
            await supabase
              .from("conversation_participants")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", conversationId)
              .eq("user_id", user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId || !user || !details || sending) return false;

      setSending(true);
      try {
        const { error } = await supabase.from("conversation_messages").insert({
          conversation_id: conversationId,
          sender_agent_id: user.id,
          recipient_agent_id: details.otherUserId,
          body,
        });

        if (error) {
          console.error("Error sending message:", error);
          return false;
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
    [conversationId, user, details, sending]
  );

  return { messages, details, loading, notFound, sending, sendMessage, refetch: fetchConversation };
}
