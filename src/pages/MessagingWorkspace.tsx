import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
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
              className="text-sm font-medium text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
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

  /** Aligned with buyer messaging + dashboard preview cards: white tile, subtle border/shadow */
  const panelShellClass = buyerMessagingPanel;

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
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pt-6">
          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
            {!buyerMode ? (
              <AgentPageHeader
                title="Messages"
                subtitle="Conversation threads with clients and colleagues — same rhythm as inbox cards on Success Hub."
                className="mb-4 shrink-0 md:mb-5"
              />
            ) : null}
            {buyerMode ? (
              <div className="mb-4 shrink-0 md:mb-5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4 gap-2 text-zinc-500 hover:bg-zinc-100/90 hover:text-zinc-900"
                  type="button"
                  onClick={() => navigate("/client/dashboard")}
                >
                  ← Back to Dashboard
                </Button>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">Messages</h1>
                  <p className="text-[13px] leading-snug text-zinc-500">
                    Stay in touch with your agent and keep everything about your home search in one place.
                  </p>
                </div>
              </div>
            ) : null}

            <div
              className={
                buyerMode
                  ? "flex min-h-0 w-full flex-1 flex-col gap-4 lg:h-[calc(100dvh-3.5rem-12rem)] lg:min-h-[420px] lg:flex-row lg:gap-5"
                  : "flex min-h-0 w-full flex-1 flex-col gap-4 md:min-h-[min(560px,calc(100vh-11rem))] md:flex-row md:gap-5"
              }
            >
              <div className={`flex h-[min(42dvh,360px)] min-h-[240px] w-full shrink-0 flex-none md:h-full md:min-h-0 md:w-[320px] ${buyerMessagingPanel}`}>
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
                className={`flex min-h-[min(52dvh,420px)] w-full flex-1 flex-col md:h-full md:min-h-0 md:w-[560px] md:max-w-[560px] md:flex-none ${panelShellClass}`}
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
