import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";
import { Logo } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Outer layout shell for authenticated agent/admin pages.
 * Provides sidebar navigation + header bar + content area.
 *
 * Rules:
 * - Does NOT touch inner page structure
 * - Pages keep their own PageShell / padding
 * - Only provides the sidebar frame
 */
export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarNavigation />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar with sidebar trigger, logo, and user actions */}
          <header className="h-12 flex items-center justify-between border-b border-border bg-background px-3 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8" />
              <div onClick={() => navigate("/")} className="cursor-pointer">
                <Logo size="sm" />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </header>
          {/* Page content — inner pages keep their own spacing */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
