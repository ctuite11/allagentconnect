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
  const navigate = useNavigate();
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

  const panelShellClass = buyerMode
    ? buyerMessagingPanel
    : "flex flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-none";

  const safeThreads = Array.isArray(threads) ? threads : [];

  return (
    <>
      <Seo title={buyerMode ? "Messages" : "Messaging"} />
      <div
        className={
          buyerMode
            ? "flex min-h-0 flex-1 flex-col bg-white"
            : "flex min-h-0 flex-1 flex-col bg-[#FFFFFF]"
        }
      >
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-6 pb-10 pt-6 md:px-8">
          <div className="mx-auto flex min-h-0 w-fit max-w-full flex-1 flex-col">
            {buyerMode && (
              <div className="mb-5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-5 gap-2 text-muted-foreground hover:text-foreground"
                  type="button"
                  onClick={() => navigate("/client/dashboard")}
                >
                  ← Back to Dashboard
                </Button>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold text-zinc-900">Messages</h1>
                  <p className="text-sm text-zinc-500">
                    Stay in touch with your agent and keep everything about your home search in one place.
                  </p>
                </div>
              </div>
            )}

            <div
              className={
                buyerMode
                  ? "mx-auto flex h-[calc(100dvh-3.5rem-9rem)] min-h-[420px] w-fit flex-1 gap-5"
                  : "mx-auto flex min-h-0 h-[calc(100vh-2rem)] w-fit flex-1 gap-5"
              }
            >
              <div className={`h-full min-h-0 w-[320px] flex-none ${buyerMessagingPanel}`}>
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

              <div
                className={`h-full min-h-0 w-[560px] max-w-[560px] flex-none ${panelShellClass}`}
              >
                <ConversationPanel
                  conversationId={selectedConversationId}
                  onInboxInvalidate={() => void refetchThreads()}
                />
              </div>
            </div>
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
