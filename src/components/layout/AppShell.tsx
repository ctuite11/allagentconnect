import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { DashboardSidebar } from "@/components/agent-dashboard-v2";
import AACMonogram from "@/components/ui/AACMonogram";
import { AgentContentInsetProvider } from "@/components/layout/AgentContentInsetContext";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useAgentPresence } from "@/hooks/useAgentPresence";
import { DelegateContextBanner } from "@/components/DelegateContextBanner";
import { agentPageShellTopClass } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-screen flex w-full overflow-hidden bg-[#FFFFFF]">
      {/* Page title is controlled by mounted route components, not by layout */}
      <DashboardSidebar
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-zinc-100 bg-[#FFFFFF]">
        <DelegateContextBanner />
        {/* Mobile top bar with hamburger */}
        <header className="flex items-center gap-3 border-b border-zinc-100 bg-white px-4 h-14 shrink-0 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex items-center justify-center h-9 w-9 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <AACMonogram className="h-5 w-5 text-emerald-500" />
            <span className="text-[14px] font-semibold tracking-tight text-zinc-900">
              All Agent Connect
            </span>
          </div>
        </header>
        <AgentContentInsetProvider value>
          <div
            data-app-scroll-root
            className={cn(
              "flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#FFFFFF]",
              agentPageShellTopClass,
            )}
          >
            {children}
          </div>
        </AgentContentInsetProvider>
      </div>
    </div>
  );
}
