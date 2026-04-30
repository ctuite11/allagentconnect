import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { buyerMessagingPanel } from "@/lib/buyerUi";

interface MessagingWorkspaceProps {
  isPublicMode?: boolean;
  isAgentMode?: boolean;
  isBuyerMode?: boolean;
}

type BoundaryState = { error: Error | null };

/** Prevents runtime errors below from producing a blank /messages shell. */
class MessagingWorkspaceErrorBoundary extends React.Component<
  React.PropsWithChildren,
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MessagingWorkspace]", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col gap-5 bg-white p-6">
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-zinc-700">{this.state.error.message}</p>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MessagingWorkspaceContent({
  isAgentMode = false,
  isBuyerMode = false,
}: MessagingWorkspaceProps) {
  const { id: routeConversationId } = useParams<{ id: string }>();
  const selectedConversationId =
    typeof routeConversationId === "string"
      ? routeConversationId.trim() || undefined
      : undefined;
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const {
    threads,
    loading: threadsLoading,
    refetch: refetchThreads,
    inboxFetchError,
  } = useConversationThreads();

  useAgentPresence();

  const buyerMode = isBuyerMode;
  const agentMode = isAgentMode || !buyerMode;

  const safeThreads = Array.isArray(threads) ? threads : [];

  return (
    <>
      <Seo title={buyerMode ? "Messages" : "Messaging"} />
      <div
        className={
          buyerMode
            ? "flex min-h-0 flex-col gap-3 bg-white px-4 pb-6 pt-4 sm:px-6"
            : "flex min-h-screen flex-col gap-5 bg-white p-6"
        }
      >
        {buyerMode && (
          <div className="shrink-0 px-1">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 gap-2 text-muted-foreground hover:text-foreground"
              type="button"
              onClick={() => navigate("/client/dashboard")}
            >
              ← Back to Dashboard
            </Button>
            <h1 className="text-2xl font-semibold text-zinc-900">Messages</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Stay in touch with your agent and keep everything about your home search in one place.
            </p>
          </div>
        )}
        <div
          className={
            buyerMode
              ? "flex h-[calc(100dvh-3.5rem-8.25rem)] min-h-[420px] flex-1 gap-4 sm:gap-5"
              : "flex gap-5 h-[calc(100vh-2rem)]"
          }
        >
          <div className={`h-full min-h-0 w-[380px] shrink-0 ${buyerMessagingPanel}`}>
            <ConversationsList
              threads={safeThreads}
              threadsLoading={Boolean(threadsLoading)}
              inboxFetchError={inboxFetchError}
              onRetryInbox={() => void refetchThreads()}
              selectedId={selectedConversationId}
              onNewMessage={() => setNewMessageOpen(true)}
              showNewMessageButton
              routeBase={agentMode ? "/agent/messages" : "/messages"}
              heading={buyerMode ? "Messages" : "Recent chats"}
              searchPlaceholder={
                buyerMode ? "Search messages" : "Search name, message, or address"
              }
              emptyStateLabel={buyerMode ? "No messages yet" : "No conversations yet"}
            />
          </div>

          <div className={`flex-[1.3] min-h-0 min-w-0 h-full ${buyerMessagingPanel}`}>
            <ConversationPanel
              conversationId={selectedConversationId}
              onInboxInvalidate={() => void refetchThreads()}
            />
          </div>
        </div>

        <NewConversationDialog
          open={newMessageOpen}
          onOpenChange={setNewMessageOpen}
          messagesRouteBase={agentMode ? "/agent/messages" : "/messages"}
          composeVariant={buyerMode ? "buyer" : "agent"}
          onConversationCreated={() => void refetchThreads()}
        />
      </div>
    </>
  );
}

export default function MessagingWorkspace(props: MessagingWorkspaceProps) {
  return (
    <MessagingWorkspaceErrorBoundary>
      <MessagingWorkspaceContent {...props} />
    </MessagingWorkspaceErrorBoundary>
  );
}
