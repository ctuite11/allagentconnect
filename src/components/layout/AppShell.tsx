import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Outer layout shell for authenticated agent/admin pages.
 * Provides sidebar navigation + content area.
 *
 * Rules:
 * - Does NOT touch inner page structure
 * - Pages keep their own PageShell / padding
 * - Only provides the sidebar frame
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarNavigation />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky trigger bar — always visible */}
          <div className="h-10 flex items-center border-b border-border bg-background px-2 sticky top-0 z-30">
            <SidebarTrigger className="h-8 w-8" />
          </div>
          {/* Page content — inner pages keep their own spacing */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
