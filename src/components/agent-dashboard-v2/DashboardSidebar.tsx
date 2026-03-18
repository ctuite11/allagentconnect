import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Contact,
  List,
  Flame,
  MessageSquare,
  Radio,
  UserCircle,
  Calendar,
  BarChart3,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import AACMonogram from "@/components/ui/AACMonogram";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string | null; // null = not yet wired
}

const mainMenu: SidebarItem[] = [
  { label: "Success Hub", icon: LayoutDashboard, route: "/agent-dashboard-v2" },
  { label: "Search", icon: Search, route: "/listing-search" },
  { label: "Comms", icon: Radio, route: "/communications" },
  { label: "Buyers", icon: Users, route: "/success-hub/buyers" },
  { label: "Contacts", icon: Contact, route: "/my-clients" },
  { label: "Listings", icon: List, route: "/agent/listings" },
  { label: "HotSheets", icon: Flame, route: "/hot-sheets" },
  { label: "Agent Network", icon: Users, route: "/agent-search" },
  { label: "Profile", icon: UserCircle, route: "/agent-profile-editor" },
];

const adminItem: SidebarItem = { label: "Admin", icon: ShieldCheck, route: "/admin/approvals" };

const otherTools: SidebarItem[] = [
  { label: "Calendar", icon: Calendar, route: null }, // TODO: no V2 calendar yet
  { label: "Analytics", icon: BarChart3, route: "/market-insights" },
  { label: "Settings", icon: Settings, route: null }, // TODO: no V2 settings yet
];

interface DashboardSidebarProps {
  activeItem?: string;
  isAdmin?: boolean;
  className?: string;
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <span className="block px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
      {children}
    </span>
  );
}

function SidebarRow({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const disabled = !item.route;
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-sm px-4 h-9 text-[13px] tracking-tight transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0",
        collapsed && "justify-center px-0",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "cursor-default",
        active
          ? "bg-zinc-800/40 text-white font-medium"
          : "text-zinc-300 font-normal hover:text-white hover:bg-zinc-800/30"
      )}
    >
      <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-zinc-300")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="bg-white text-zinc-900 text-[12px] font-medium border border-zinc-200 rounded px-2 py-1 shadow-sm z-50">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function DashboardSidebar({
  activeItem,
  isAdmin,
  className,
}: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Determine active item from current route if not explicitly set
  const resolvedActive = activeItem ?? (() => {
    const path = location.pathname;
    const allItems = [...mainMenu, ...(isAdmin ? [adminItem] : []), ...otherTools];
    // Exact match first, then prefix match (but skip "/" to avoid false positives)
    const exact = allItems.find((item) => item.route && item.route === path);
    if (exact) return exact.label;
    const prefix = allItems.find((item) => item.route && item.route !== "/" && path.startsWith(item.route));
    return prefix?.label ?? "Success Hub";
  })();

  const handleNav = (item: SidebarItem) => {
    if (item.route) {
      navigate(item.route);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex shrink-0 flex-col bg-zinc-900 min-h-screen transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[212px]",
          className
        )}
      >
        {/* Logo area */}
        <div className={cn("flex items-center px-4 py-3", collapsed ? "justify-center" : "gap-2")}>
          <AACMonogram className={cn("shrink-0 text-zinc-100", collapsed ? "h-[22px] w-[22px]" : "h-6 w-6")} />
          {!collapsed && (
            <span className="text-[14px] font-semibold text-white tracking-tight">
              All Agent Connect
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center h-8 text-zinc-400 hover:text-zinc-200 transition-colors duration-150 mx-2 rounded-md hover:bg-zinc-800/30",
            collapsed ? "justify-center px-0" : "px-3 gap-2"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-[16px] w-[16px]" />
          ) : (
            <>
              <PanelLeftClose className="h-[16px] w-[16px]" />
              <span className="text-[12px]">Collapse</span>
            </>
          )}
        </button>

        {/* Main menu */}
        <nav className="flex-1 space-y-0.5 px-2">
          <SectionLabel collapsed={collapsed}>Main Menu</SectionLabel>
          {mainMenu.map((item) => (
            <SidebarRow
              key={item.label}
              item={item}
              active={item.label === resolvedActive}
              collapsed={collapsed}
              onClick={() => handleNav(item)}
            />
          ))}

          {/* Admin — only when isAdmin is truthy */}
          {isAdmin && (
            <SidebarRow
              item={adminItem}
              active={resolvedActive === "Admin"}
              collapsed={collapsed}
              onClick={() => handleNav(adminItem)}
            />
          )}

          <div className="mt-4">
            <SectionLabel collapsed={collapsed}>Other Tools</SectionLabel>
            {otherTools.map((item) => (
              <SidebarRow
                key={item.label}
                item={item}
                active={item.label === resolvedActive}
                collapsed={collapsed}
                onClick={() => handleNav(item)}
              />
            ))}
          </div>
        </nav>

        {/* Sign Out */}
        <div className="mt-auto border-t border-zinc-800 px-2 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-4 h-9 text-[13px] tracking-tight text-zinc-400 font-normal hover:text-white hover:bg-zinc-800/30 transition-colors duration-150",
                  collapsed && "justify-center px-0"
                )}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-white text-zinc-900 text-[12px] font-medium border border-zinc-200 rounded px-2 py-1 shadow-sm">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
