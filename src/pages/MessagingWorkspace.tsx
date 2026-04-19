import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Seo } from "@/components/Seo";

interface MessagingWorkspaceProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

export default function MessagingWorkspace({
  isPublicMode = false,
  isAgentMode = false,
  isBuyerMode = false,
}: MessagingWorkspaceProps) {
  const { id } = useParams<{ id: string }>();
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  useAgentPresence();

  const buyerMode = isBuyerMode;
  const agentMode = isAgentMode || !buyerMode;

  return (
    <>
      <Seo title={buyerMode ? "Messages" : "Messaging"} />
      <div className={`min-h-screen p-6 flex flex-col gap-5 bg-zinc-50 ${buyerMode ? "pt-20" : ""}`}>
      {buyerMode && (
        <div className="px-1">
          <h1 className="text-2xl font-semibold text-zinc-900">Messages</h1>
          <p className="mt-1 text-sm text-zinc-500">Stay in touch with your agent and keep everything about your home search in one place.</p>
        </div>
      )}
      <div className={buyerMode ? "flex gap-5 min-h-[calc(100vh-14rem)]" : "flex gap-5 h-[calc(100vh-2rem)]"}>
      {/* Left — Conversations List */}
      <div className="w-[380px] flex-shrink-0 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <ConversationsList
          selectedId={id}
          onNewMessage={() => setNewMessageOpen(true)}
          showNewMessageButton={agentMode}
          routeBase={agentMode ? "/agent/messages" : "/messages"}
          heading={buyerMode ? "Messages" : "Recent chats"}
          searchPlaceholder={buyerMode ? "Search messages" : "Search name, message, or address"}
          emptyStateLabel={buyerMode ? "No messages yet" : "No conversations yet"}
        />
      </div>

      {/* Right — Active Conversation */}
      <div className="flex-[1.3] min-w-0 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <ConversationPanel conversationId={id} />
      </div>

      {agentMode && (
        <NewConversationDialog
          open={newMessageOpen}
          onOpenChange={setNewMessageOpen}
        />
      )}
      </div>
    </div>
    </>
  );
}
