import React from "react";
import { DashboardSidebar } from "@/components/agent-dashboard-v2";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useAgentPresence } from "@/hooks/useAgentPresence";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Outer layout shell for authenticated agent/admin pages.
 * Provides dark V2 sidebar navigation + content area.
 * Runs the presence heartbeat globally for all authenticated agent pages.
 */
export function AppShell({ children }: AppShellProps) {
  const { isAdmin } = useAuthRole();
  useAgentPresence();

  return (
    <div className="h-screen flex w-full overflow-hidden">
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
