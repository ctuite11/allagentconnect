import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useMessageCenterIntro } from "@/hooks/useMessageCenterIntro";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { archiveConversationsForUser } from "@/lib/archiveConversationsForUser";
import { supabase } from "@/integrations/supabase/client";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { MessageCenterIntroOverlay } from "@/components/messaging/MessageCenterIntroOverlay";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
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
  const location = useLocation();
  const { user } = useAuthRole();
  const { visible: showMessageCenterIntro, handleLater, handleStartMessaging } =
    useMessageCenterIntro(user);
  const { id: routeConversationId } = useParams<{ id: string }>();
  const messageReturnPath = (location.state as { from?: string } | null)?.from;
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
    markArchivedLocally,
    clearLocalArchive,
  } = useConversationThreads();

  useAgentPresence();

  useEffect(() => {
    if (selectedConversationId) {
      void refetchThreads();
    }
  }, [selectedConversationId, refetchThreads]);

  const buyerMode = isBuyerMode;
  const agentMode = isAgentMode || !buyerMode;

  /** Aligned with buyer messaging + dashboard preview cards: white tile, subtle border/shadow */
  const panelShellClass = buyerMessagingPanel;

  const safeThreads = Array.isArray(threads) ? threads : [];
  const messagesRouteBase = agentMode ? "/agent/messages" : "/messages";

  const handleArchiveThreads = useCallback(
    async (conversationIds: string[]): Promise<boolean> => {
      // Optimistically hide from the inbox so a racing refetch or realtime
      // event can't make the row flash back in.
      markArchivedLocally(conversationIds);
      if (selectedConversationId && conversationIds.includes(selectedConversationId)) {
        navigate(messagesRouteBase);
      }
      const { error } = await archiveConversationsForUser(supabase, conversationIds);
      if (error) {
        // Roll back the local guard so the row reappears if the server failed.
        clearLocalArchive(conversationIds);
        await refetchThreads();
        toast.error("Could not delete conversation", { description: error });
        return false;
      }
      await refetchThreads();
      return true;
    },
    [
      clearLocalArchive,
      markArchivedLocally,
      messagesRouteBase,
      navigate,
      refetchThreads,
      selectedConversationId,
    ],
  );

  return (
    <>
      <MessageCenterIntroOverlay
        open={showMessageCenterIntro}
        variant={buyerMode ? "buyer" : "agent"}
        onLater={handleLater}
        onStartMessaging={handleStartMessaging}
      />
      <Seo title={buyerMode ? "Messages" : "Messaging"} />
      <div
        className={
          buyerMode
            ? "flex min-h-0 flex-1 flex-col bg-white"
            : "flex min-h-0 flex-1 flex-col bg-[#FFFFFF]"
        }
      >
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-10 sm:px-6 md:px-8">
          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
            {!buyerMode ? (
              <AgentPageHeader
                withTopPadding
                backTo={messageReturnPath ?? "/agent-dashboard"}
                title="Messages"
                subtitle="Conversation threads with clients and colleagues — same rhythm as inbox cards on Success Hub."
                className="shrink-0"
              />
            ) : null}
            {buyerMode ? (
              <AacPageIntro
                withTopPadding
                className="shrink-0"
                back={
                  <AacBackButton type="button" onClick={() => navigate("/client/dashboard")} />
                }
                title="Messages"
                subtitle="Stay in touch with your agent and keep everything about your home search in one place."
              />
            ) : null}

            <div
              className={
                buyerMode
                  ? "flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden lg:h-[min(560px,calc(100dvh-10rem))] lg:max-h-[calc(100dvh-10rem)] lg:min-h-[360px] lg:flex-row lg:gap-5"
                  : "flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden md:h-[min(560px,calc(100dvh-11rem))] md:max-h-[calc(100dvh-11rem)] md:min-h-[400px] md:flex-row md:gap-5"
              }
            >
              <div
                className={cn(
                  "w-full shrink-0 flex-none md:flex md:h-full md:min-h-0 md:w-[320px]",
                  selectedConversationId ? "hidden" : "flex h-[min(38dvh,320px)] min-h-[220px]",
                  buyerMessagingPanel,
                )}
              >
                <ConversationsList
                  threads={safeThreads}
                  threadsLoading={Boolean(threadsLoading)}
                  inboxFetchError={inboxFetchError}
                  onRetryInbox={() => void refetchThreads()}
                  selectedId={selectedConversationId}
                  onNewMessage={() => setNewMessageOpen(true)}
                  showNewMessageButton
                  routeBase={messagesRouteBase}
                  onArchiveThreads={handleArchiveThreads}
                  heading={buyerMode ? "Messages" : "Recent chats"}
                  searchPlaceholder={
                    buyerMode ? "Search messages" : "Search name, message, or address"
                  }
                  emptyStateLabel={buyerMode ? "No messages yet" : "No conversations yet"}
                />
              </div>

              <div
                className={`flex w-full flex-1 flex-col overflow-hidden md:h-full md:min-h-0 md:w-[560px] md:max-w-[560px] md:flex-none ${panelShellClass}`}
              >
                <ConversationPanel
                  conversationId={selectedConversationId}
                  onInboxInvalidate={() => void refetchThreads()}
                  onCloseRequest={() => navigate(messagesRouteBase)}
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
