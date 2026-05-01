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
    <div className="h-screen flex w-full overflow-hidden bg-[#FFFFFF]">
      {/* Page title is controlled by mounted route components, not by layout */}
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-zinc-100 bg-[#FFFFFF]">
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#FFFFFF]">
          {children}
        </div>
      </div>
    </div>
  );
}
