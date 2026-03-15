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
} from "lucide-react";
import { cn } from "@/lib/utils";
import AACMonogram from "@/components/ui/AACMonogram";

interface SidebarItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainMenu: SidebarItem[] = [
  { label: "Success Hub", icon: LayoutDashboard },
  { label: "Buyers", icon: Users },
  { label: "Contacts", icon: Contact },
  { label: "Listings", icon: List },
  { label: "HotSheets", icon: Flame },
  { label: "Messages", icon: MessageSquare },
  { label: "Communication center", icon: Radio },
  { label: "Profile", icon: UserCircle },
];

const otherTools: SidebarItem[] = [
  { label: "Calendar", icon: Calendar },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

interface DashboardSidebarProps {
  activeItem?: string;
  className?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-4 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
      {children}
    </span>
  );
}

function SidebarRow({
  item,
  active,
}: {
  item: SidebarItem;
  active: boolean;
}) {
  return (
    <button
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-md px-4 h-9 text-[13px] transition-colors cursor-default",
        active
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r bg-emerald-500" />
      )}
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function DashboardSidebar({
  activeItem = "Success Hub",
  className,
}: DashboardSidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-[212px] shrink-0 flex-col bg-zinc-900 min-h-screen",
        className
      )}
    >
      {/* Logo area */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
        <span className="text-[14px] font-semibold text-white tracking-tight">
          All Agent Connect
        </span>
      </div>

      {/* Main menu */}
      <nav className="flex-1 space-y-0.5 px-2">
        <SectionLabel>Main Menu</SectionLabel>
        {mainMenu.map((item) => (
          <SidebarRow
            key={item.label}
            item={item}
            active={item.label === activeItem}
          />
        ))}

        <SectionLabel>Other Tools</SectionLabel>
        {otherTools.map((item) => (
          <SidebarRow
            key={item.label}
            item={item}
            active={item.label === activeItem}
          />
        ))}
      </nav>
    </aside>
  );
}
