import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Outer layout shell for authenticated agent/admin pages.
 * Provides sidebar navigation + content area.
 * The header bar is removed — Sign Out lives in the sidebar footer.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarNavigation />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Page content — inner pages keep their own spacing */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
