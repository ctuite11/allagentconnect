import React from "react";
import { DashboardSidebar } from "@/components/agent-dashboard-v2";
import { useAuthRole } from "@/hooks/useAuthRole";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Outer layout shell for authenticated agent/admin pages.
 * Provides dark V2 sidebar navigation + content area.
 */
export function AppShell({ children }: AppShellProps) {
  const { isAdmin } = useAuthRole();

  return (
    <div className="min-h-screen flex w-full">
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
