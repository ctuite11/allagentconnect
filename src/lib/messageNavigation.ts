export type MessageReturnState = {
  from: string;
  fromLabel?: string;
};

/** Preserve originating route when opening a message thread (e.g. listing detail). */
export function buildMessageReturnState(
  pathname: string,
  search = "",
  fromLabel = "Back to listing",
): MessageReturnState {
  return {
    from: `${pathname}${search}`,
    fromLabel,
  };
}

export function agentMessagesPath(conversationId: string): string {
  return `/agent/messages/${conversationId}`;
}

export function messagesPathForRole(
  conversationId: string,
  role: string | null | undefined,
): string {
  if (role === "agent" || role === "admin") {
    return agentMessagesPath(conversationId);
  }
  return `/messages/${conversationId}`;
}
