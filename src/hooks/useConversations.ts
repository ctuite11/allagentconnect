import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConversationThread } from "@/components/inbox/ConversationList";

interface Message {
  id: string;
  conversation_id: string;
  sender_agent_id: string;
  recipient_agent_id: string;
  subject: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

export const useConversations = (userId: string | null) => {
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      
      // Fetch all conversations where user is a participant
      const { data: convos, error: convosError } = await supabase
        .from("conversations")
        .select(`
          id,
          agent_a_id,
          agent_b_id,
          listing_id,
          buyer_need_id,
          updated_at,
          created_at
        `)
        .or(`agent_a_id.eq.${userId},agent_b_id.eq.${userId}`)
        .order("updated_at", { ascending: false });

      if (convosError) throw convosError;
      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get all unique agent IDs (the other party)
      const otherAgentIds = convos.map(c => 
        c.agent_a_id === userId ? c.agent_b_id : c.agent_a_id
      );
      const uniqueAgentIds = [...new Set(otherAgentIds)];

      // Fetch agent profiles
      const { data: agents, error: agentsError } = await supabase
        .from("agent_profiles")
        .select("id, first_name, last_name, headshot_url, company")
        .in("id", uniqueAgentIds);

      if (agentsError) throw agentsError;

      const agentMap = new Map(agents?.map(a => [a.id, a]) || []);

      // Fetch listing details for conversations with listings
      const listingIds = convos.filter(c => c.listing_id).map(c => c.listing_id);
      let listingMap = new Map();
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from("listings")
          .select("id, address, status")
          .in("id", listingIds);
        listingMap = new Map(listings?.map(l => [l.id, l]) || []);
      }

      // Fetch buyer need details
      const buyerNeedIds = convos.filter(c => c.buyer_need_id).map(c => c.buyer_need_id);
      let buyerNeedMap = new Map();
      if (buyerNeedIds.length > 0) {
        const { data: buyerNeeds } = await supabase
          .from("client_needs")
          .select("id, city, max_price")
          .in("id", buyerNeedIds);
        buyerNeedMap = new Map(buyerNeeds?.map(b => [b.id, b]) || []);
      }

      // Fetch last message and unread count for each conversation
      const threadsWithMessages = await Promise.all(
        convos.map(async (convo) => {
          const otherAgentId = convo.agent_a_id === userId ? convo.agent_b_id : convo.agent_a_id;
          const otherAgent = agentMap.get(otherAgentId);

          // Get last message
          const { data: lastMsgData } = await supabase
            .from("conversation_messages")
            .select("body, created_at, sender_agent_id")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count (messages from other agent that haven't been read)
          const { count: unreadCount } = await supabase
            .from("conversation_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convo.id)
            .eq("sender_agent_id", otherAgentId)
            .is("read_at", null);

          if (!otherAgent || !lastMsgData) return null;

          return {
            id: convo.id,
            otherAgent: {
              id: otherAgentId,
              first_name: otherAgent.first_name,
              last_name: otherAgent.last_name,
              headshot_url: otherAgent.headshot_url,
              company: otherAgent.company,
            },
            listing: convo.listing_id ? listingMap.get(convo.listing_id) || null : null,
            buyerNeed: convo.buyer_need_id ? buyerNeedMap.get(convo.buyer_need_id) || null : null,
            lastMessage: lastMsgData,
            unreadCount: unreadCount || 0,
            updated_at: convo.updated_at,
          } as ConversationThread;
        })
      );

      setConversations(threadsWithMessages.filter(Boolean) as ConversationThread[]);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!userId) return;

    try {
      setMessagesLoading(true);
      
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      const unreadMessages = data?.filter(
        m => m.recipient_agent_id === userId && !m.read_at
      );
      
      if (unreadMessages && unreadMessages.length > 0) {
        await supabase
          .from("conversation_messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadMessages.map(m => m.id));
        
        // Refresh conversations to update unread counts
        fetchConversations();
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  }, [userId, fetchConversations]);

  const sendMessage = useCallback(async (body: string) => {
    if (!userId || !selectedConversationId) return;

    const selectedThread = conversations.find(c => c.id === selectedConversationId);
    if (!selectedThread) return;

    try {
      setSending(true);

      const { data, error } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversationId,
          sender_agent_id: userId,
          recipient_agent_id: selectedThread.otherAgent.id,
          body,
        })
        .select()
        .single();

      if (error) throw error;

      // Add message to local state immediately
      setMessages(prev => [...prev, data]);
      
      // Refresh conversations to update order
      fetchConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    } finally {
      setSending(false);
    }
  }, [userId, selectedConversationId, conversations, fetchConversations]);

  // Select a conversation and fetch its messages
  const selectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
    if (id) {
      fetchMessages(id);
    } else {
      setMessages([]);
    }
  }, [fetchMessages]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchConversations();
    }
  }, [userId, fetchConversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("conversation-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // If this message is in the currently selected conversation, add it
          if (newMessage.conversation_id === selectedConversationId) {
            setMessages(prev => [...prev, newMessage]);
          }
          // Refresh conversations to update order and unread counts
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedConversationId, fetchConversations]);

  const selectedThread = conversations.find(c => c.id === selectedConversationId) || null;

  return {
    conversations,
    loading,
    selectedConversationId,
    selectedThread,
    selectConversation,
    messages,
    messagesLoading,
    sendMessage,
    sending,
    refetch: fetchConversations,
  };
};
