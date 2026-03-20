import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";

export default function MessagingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  return (
    <div className="h-[calc(100vh-2rem)] p-6 flex gap-5 bg-zinc-50">
      {/* Left — Conversations List */}
      <div className="w-[380px] flex-shrink-0 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <ConversationsList
          selectedId={id}
          onNewMessage={() => setNewMessageOpen(true)}
        />
      </div>

      {/* Right — Active Conversation */}
      <div className="flex-[1.3] min-w-0 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <ConversationPanel conversationId={id} />
      </div>

      <NewConversationDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
      />
    </div>
  );
}
