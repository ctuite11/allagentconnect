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
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  { label: "Buyers", icon: Users, route: "/my-clients" },
  { label: "Contacts", icon: Contact, route: "/my-clients" },
  { label: "Listings", icon: List, route: "/agent/listings" },
  { label: "HotSheets", icon: Flame, route: "/hot-sheets" },
  { label: "Messages", icon: MessageSquare, route: "/communications" },
  { label: "Communication center", icon: Radio, route: "/communications" },
  { label: "Profile", icon: UserCircle, route: "/profile" },
];

const adminItem: SidebarItem = { label: "Admin", icon: ShieldCheck, route: "/admin" };

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
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
}) {
  const button = (
    <button
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-sm px-4 h-9 text-[13px] transition-colors cursor-default outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0",
        collapsed && "justify-center px-0",
        active
          ? "bg-zinc-800/40 text-zinc-100 font-medium"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
      )}
    >
      <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-[hsl(221,92%,51%)]")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="bg-white text-zinc-900 text-[12px] font-medium border border-zinc-200 rounded px-2 py-1 shadow-sm">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function DashboardSidebar({
  activeItem = "Success Hub",
  isAdmin,
  className,
}: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
            "flex items-center h-8 text-zinc-400 hover:text-zinc-200 transition-colors mx-2 rounded-md hover:bg-zinc-800/30",
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
              active={item.label === activeItem}
              collapsed={collapsed}
            />
          ))}

          {/* Admin — only when isAdmin is truthy */}
          {isAdmin && (
            <SidebarRow
              item={adminItem}
              active={activeItem === "Admin"}
              collapsed={collapsed}
            />
          )}

          <div className="mt-4">
            <SectionLabel collapsed={collapsed}>Other Tools</SectionLabel>
            {otherTools.map((item) => (
              <SidebarRow
                key={item.label}
                item={item}
                active={item.label === activeItem}
                collapsed={collapsed}
              />
            ))}
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
