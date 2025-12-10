import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Loader2, ArrowLeft, Inbox, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ThreadView } from "@/components/inbox/ThreadView";
import { useConversations } from "@/hooks/useConversations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const {
    conversations,
    loading,
    selectedConversationId,
    selectedThread,
    selectConversation,
    messages,
    messagesLoading,
    sendMessage,
    sending,
  } = useConversations(user?.id || null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    setAuthLoading(false);
  };

  const handleSendMessage = async (body: string) => {
    try {
      await sendMessage(body);
      toast.success("Message sent");
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleBack = () => {
    selectConversation(null);
  };

  // Calculate unread count
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-16 h-screen flex flex-col">
        {/* Header */}
        <div className="border-b bg-card px-4 py-3">
          <div className="container mx-auto max-w-7xl flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">Communications Center</h1>
                <p className="text-xs text-muted-foreground">
                  {totalUnread > 0 ? `${totalUnread} unread` : "Agent-to-agent messaging"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - 3 Column Layout */}
        <div className="flex-1 container mx-auto max-w-7xl flex overflow-hidden">
          {/* Left Column - Filters (minimal stub for V1) */}
          <div className="hidden lg:block w-48 border-r p-4 bg-muted/30">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Quick Filters
            </h3>
            <div className="space-y-1">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <MessageSquare className="h-3 w-3 mr-2" />
                All Messages
              </Button>
            </div>
            <div className="mt-6">
              <p className="text-[10px] text-muted-foreground">
                More filters coming soon
              </p>
            </div>
          </div>

          {/* Middle Column - Conversation List */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 border-r flex flex-col bg-card",
            selectedConversationId && "hidden md:flex"
          )}>
            <div className="p-3 border-b">
              <h2 className="text-sm font-semibold">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={selectConversation}
                currentUserId={user?.id || ""}
                loading={loading}
              />
            </div>
          </div>

          {/* Right Column - Thread View */}
          <div className={cn(
            "flex-1 flex flex-col bg-background",
            !selectedConversationId && "hidden md:flex"
          )}>
            <ThreadView
              thread={selectedThread}
              messages={messages}
              currentUserId={user?.id || ""}
              onSendMessage={handleSendMessage}
              onBack={handleBack}
              loading={messagesLoading}
              sending={sending}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClientNeedsDashboard;
