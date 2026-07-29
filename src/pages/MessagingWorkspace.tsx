import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useMessageCenterIntro } from "@/hooks/useMessageCenterIntro";
import { useConversationThreads } from "@/hooks/useConversationThreads";
import { archiveConversationsForUser } from "@/lib/archiveConversationsForUser";
import { supabase } from "@/integrations/supabase/client";
import { ConversationPanel } from "@/components/messaging/ConversationPanel";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { MessageCenterIntroOverlay } from "@/components/messaging/MessageCenterIntroOverlay";
import { Seo } from "@/components/Seo";
import { AacBackButton } from "@/components/layout/AacBackLink";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { buyerMessagingPanel } from "@/lib/buyerUi";
import { cn } from "@/lib/utils";

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
  // Keep touch pans inside the inbox/thread panels on mobile.
  useLockBodyScroll(true);

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
      {/*
        Mobile: absolute-fill single-pane swap (list XOR thread) inside a
        bounded flex viewport. Avoid rem-based heights — they overflow AppShell
        and create a nested-scroll trap. Desktop keeps the two-column layout.
      */}
      <div className="flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 pb-3 sm:px-6 sm:pb-6 md:px-8 md:pb-10">
          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
            {!buyerMode ? (
              <AgentPageHeader
                withTopPadding
                backTo={messageReturnPath ?? "/agent-dashboard"}
                title="Messages"
                subtitle="Conversation threads with clients and colleagues — same rhythm as inbox cards on Success Hub."
                className="shrink-0"
                hideTitleAccent
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
                hideTitleAccent
              />
            ) : null}

            <div
              className={
                buyerMode
                  ? "relative min-h-0 w-full flex-1 overflow-hidden lg:flex lg:h-[min(560px,calc(100dvh-10rem))] lg:max-h-[calc(100dvh-10rem)] lg:min-h-[360px] lg:flex-none lg:flex-row lg:gap-5"
                  : "relative min-h-0 w-full flex-1 overflow-hidden md:flex md:h-[min(560px,calc(100dvh-11rem))] md:max-h-[calc(100dvh-11rem)] md:min-h-[400px] md:flex-none md:flex-row md:gap-5"
              }
            >
              {/* Mobile: absolute inset fill so the pane always gets a definite
                  height for overflow-y-auto. Desktop: normal flex column.
                  Agent two-column starts at md; buyer at lg. */}
              <div
                className={cn(
                  "min-h-0 overflow-hidden",
                  buyerMode
                    ? "absolute inset-0 lg:static lg:inset-auto lg:relative lg:h-full lg:w-[320px] lg:flex-none"
                    : "absolute inset-0 md:static md:inset-auto md:relative md:h-full md:w-[320px] md:flex-none",
                  selectedConversationId
                    ? buyerMode
                      ? "z-0 hidden lg:flex"
                      : "z-0 hidden md:flex"
                    : "z-10 flex",
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
                className={cn(
                  "min-h-0 overflow-hidden",
                  buyerMode
                    ? "absolute inset-0 lg:static lg:inset-auto lg:relative lg:h-full lg:w-[560px] lg:max-w-[560px] lg:flex-none"
                    : "absolute inset-0 md:static md:inset-auto md:relative md:h-full md:w-[560px] md:max-w-[560px] md:flex-none",
                  selectedConversationId
                    ? "z-10 flex"
                    : buyerMode
                      ? "z-0 hidden lg:flex"
                      : "z-0 hidden md:flex",
                  panelShellClass,
                )}
              >
                <ConversationPanel
                  conversationId={selectedConversationId}
                  onInboxInvalidate={() => void refetchThreads()}
                  onCloseRequest={() => navigate(messagesRouteBase)}
                  onBackToInbox={
                    selectedConversationId
                      ? () => navigate(messagesRouteBase)
                      : undefined
                  }
                  mobileBackHiddenClassName={buyerMode ? "lg:hidden" : "md:hidden"}
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
