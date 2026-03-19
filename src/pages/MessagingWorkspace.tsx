import { useState } from "react";
import { useParams } from "react-router-dom";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";

export default function MessagingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  return (
    <div className="h-[calc(100vh-2rem)] p-6 flex gap-5">
      {/* Left — Active Conversation */}
      <div className="flex-[1.3] min-w-0 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <ConversationPanel conversationId={id} />
      </div>

      {/* Right — Conversations List */}
      <div className="w-[380px] flex-shrink-0 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <ConversationsList
          selectedId={id}
          onNewMessage={() => setNewMessageOpen(true)}
        />
      </div>

      <NewConversationDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
      />
    </div>
  );
}
