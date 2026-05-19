import { createContext, useContext } from "react";

/**
 * When true, the agent AppShell (or equivalent column) already applied
 * {@link agentPageShellTopClass} — intro blocks should not add top padding again.
 */
const AgentContentInsetContext = createContext(false);

export function AgentContentInsetProvider({
  children,
  value = true,
}: {
  children: React.ReactNode;
  value?: boolean;
}) {
  return (
    <AgentContentInsetContext.Provider value={value}>{children}</AgentContentInsetContext.Provider>
  );
}

export function useAgentContentShellInset(): boolean {
  return useContext(AgentContentInsetContext);
}
