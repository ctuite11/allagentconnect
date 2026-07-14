import { useState, useEffect, useRef } from "react";
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
import { isAgentHotSheetsNavActive } from "@/lib/sidebarNavActive";
import { getSidebarRouteContext } from "@/lib/workspaceSidebarRoutes";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import { formatMessagesUnreadCount, hasUnreadMessages } from "@/components/messaging/MessagesUnreadBadge";
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
  route: string | null;
  badge?: number;
}

const baseMainMenu: Omit<SidebarItem, "badge">[] = [
  { label: "Success Hub", icon: LayoutDashboard, route: "/agent-dashboard" },
  { label: "Search", icon: Search, route: "/listing-search" },
  { label: "Communications Center", icon: Radio, route: "/communications" },
  { label: "Messages", icon: MessageSquare, route: "/agent/messages" },
  { label: "Buyers", icon: Users, route: "/agent/buyers" },
  { label: "Agent Network", icon: Users, route: "/our-members" },
  { label: "Contacts", icon: Contact, route: "/my-clients" },
  { label: "Listings", icon: List, route: "/agent/listings" },
  { label: "Hot Sheets", icon: Flame, route: "/agent/hot-sheets" },
  { label: "Profile", icon: UserCircle, route: "/agent-profile-editor" },
];

const adminItem: SidebarItem = { label: "Admin", icon: ShieldCheck, route: "/admin/approvals" };

const otherTools: SidebarItem[] = [
  { label: "Calendar", icon: Calendar, route: null },
  { label: "Analytics", icon: BarChart3, route: "/market-insights" },
  { label: "Settings", icon: Settings, route: "/settings" },
];

interface DashboardSidebarProps {
  activeItem?: string;
  isAdmin?: boolean;
  className?: string;
  /** Mobile drawer open state (controlled by AppShell on <lg screens) */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
  const hasBadge = hasUnreadMessages(item.badge);
  const badgeText = hasBadge ? formatMessagesUnreadCount(item.badge!) : null;

  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-sm px-4 h-9 text-[13px] tracking-tight text-zinc-300 font-normal transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0",
        collapsed && "justify-center px-0",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "cursor-default hover:text-white hover:bg-zinc-800/50"
      )}
    >
      <span className="relative shrink-0">
        <item.icon
          className={cn("h-[18px] w-[18px]", active ? "text-[#0E56F5]" : "text-zinc-400")}
        />
        {collapsed && hasBadge && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white leading-none">
            {badgeText}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {hasBadge && (
            <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-white leading-none">
              {badgeText}
            </span>
          )}
        </>
      )}
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
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useUnreadConversations();
  const routeContext = getSidebarRouteContext(location.pathname);
  const prevRouteContextRef = useRef(routeContext);
  const [collapsed, setCollapsed] = useState(() => routeContext === "workspace");

  // `collapsed` only governs the desktop (lg+) rail width. On mobile the off-canvas
  // drawer is always full-width and must always show labels.
  const showCollapsed = collapsed && !mobileOpen;

  // Collapse on map/workspace routes; expand on dashboard routes. Manual toggles persist
  // until the user navigates between workspace ↔ standard (not on every in-category route).
  useEffect(() => {
    if (routeContext === prevRouteContextRef.current) return;
    setCollapsed(routeContext === "workspace");
    prevRouteContextRef.current = routeContext;
  }, [routeContext]);

  const mainMenu: SidebarItem[] = baseMainMenu.map((item) =>
    item.label === "Messages" ? { ...item, badge: unreadCount } : item
  );

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const resolvedActive = activeItem ?? (() => {
    const path = location.pathname;
    const allItems = [...mainMenu, ...(isAdmin ? [adminItem] : []), ...otherTools];
    const exact = allItems.find((item) => item.route && item.route === path);
    if (exact) return exact.label;
    const prefix = allItems.find((item) => item.route && item.route !== "/" && path.startsWith(item.route));
    if (prefix) return prefix.label;

    // Search-related routes that should always highlight "Search"
    const searchPrefixes = ["/listing-results", "/listing-search", "/agent-search", "/property/"];
    if (searchPrefixes.some((p) => path.startsWith(p))) return "Search";

    // Hot sheet list, review, and buyer-detail routes (not under /agent/hot-sheets prefix)
    if (isAgentHotSheetsNavActive(path)) return "Hot Sheets";

    return "Success Hub";
  })();

  const handleNav = (item: SidebarItem) => {
    if (item.route) {
      navigate(item.route);
      onMobileClose?.();
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Mobile backdrop */}
      <div
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "flex flex-col bg-zinc-900 transition-all duration-200",
          // Desktop: in-flow, fixed width
          "lg:relative lg:h-full lg:shrink-0 lg:translate-x-0",
          showCollapsed ? "lg:w-[72px]" : "lg:w-[212px]",
          // Mobile: off-canvas drawer
          "fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] h-full shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          className
        )}
      >
        {/* Logo area */}
        <div className={cn("flex items-center px-4 pt-6 pb-8", showCollapsed ? "justify-center" : "gap-2")}>
          <AACMonogram className={cn("shrink-0 text-emerald-500", showCollapsed ? "h-[22px] w-[22px]" : "h-6 w-6")} />
          {!showCollapsed && (
            <span className="text-[14px] font-semibold text-white tracking-tight">
              All Agent Connect
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center h-8 text-zinc-400 hover:text-zinc-200 transition-colors duration-150 mx-2 mb-1 rounded-md hover:bg-zinc-800/50",
            showCollapsed ? "justify-center px-0" : "px-3 gap-2"
          )}
          aria-label={showCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {showCollapsed ? (
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
          <SectionLabel collapsed={showCollapsed}>Main Menu</SectionLabel>
          {mainMenu.map((item) => (
            <SidebarRow
              key={item.label}
              item={item}
              active={item.label === resolvedActive}
              collapsed={showCollapsed}
              onClick={() => handleNav(item)}
            />
          ))}

          {isAdmin && (
            <SidebarRow
              item={adminItem}
              active={resolvedActive === "Admin"}
              collapsed={showCollapsed}
              onClick={() => handleNav(adminItem)}
            />
          )}

          <div className="mt-4">
            <SectionLabel collapsed={showCollapsed}>Other Tools</SectionLabel>
            {otherTools.map((item) => (
              <SidebarRow
                key={item.label}
                item={item}
                active={item.label === resolvedActive}
                collapsed={showCollapsed}
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
                  "flex w-full items-center gap-2.5 rounded-sm px-4 h-9 text-[13px] tracking-tight text-zinc-300 font-normal hover:text-white hover:bg-zinc-800/50 transition-colors duration-150",
                  showCollapsed && "justify-center px-0"
                )}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0 text-zinc-300" />
                {!showCollapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {showCollapsed && (
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
