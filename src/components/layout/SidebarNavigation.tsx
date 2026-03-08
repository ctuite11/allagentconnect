import {
  LayoutDashboard,
  List,
  FileText,
  Search,
  Bell,
  UserCircle,
  ClipboardList,
  MessageSquare,
  UserCog,
  BarChart3,
  Users,
  Plus,
  Building2,
  Heart,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import { Logo } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const dashboardItems: NavItem[] = [
  { title: "Success Hub", url: "/agent-dashboard", icon: LayoutDashboard },
];

const listingItems: NavItem[] = [
  { title: "My Listings", url: "/agent/listings", icon: List },
  { title: "Drafts", url: "/agent/listings/drafts", icon: FileText },
  { title: "Listing Search", url: "/listing-search", icon: Search },
  { title: "Add For Sale", url: "/agent/listings/new", icon: Plus },
  { title: "Add Rental", url: "/add-rental-listing", icon: Building2 },
];

const clientItems: NavItem[] = [
  { title: "My Contacts", url: "/my-clients", icon: UserCircle },
  { title: "Hot Sheets", url: "/hot-sheets", icon: Bell },
  { title: "Showing Requests", url: "/showing-requests", icon: ClipboardList },
  { title: "Favorites", url: "/favorites", icon: Heart },
];

const insightItems: NavItem[] = [
  { title: "Market Insights", url: "/market-insights", icon: BarChart3 },
  { title: "Find an Agent", url: "/find-agent", icon: Users },
  { title: "Referrals", url: "/our-members", icon: Users },
  { title: "Agent Search", url: "/agent-search", icon: Search },
];

const settingsItems: NavItem[] = [
  { title: "Profile & Branding", url: "/agent-profile-editor", icon: UserCog },
];

interface SidebarGroupSectionProps {
  label: string;
  items: NavItem[];
  currentPath: string;
  collapsed: boolean;
  onNavigate: (url: string) => void;
  unreadCount?: number;
}

function SidebarGroupSection({ label, items, currentPath, collapsed, onNavigate, unreadCount }: SidebarGroupSectionProps) {
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = currentPath === item.url || currentPath.startsWith(item.url + "/");
            const badge = item.title === "Messages" ? unreadCount : item.badge;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  onClick={() => onNavigate(item.url)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.title}</span>
                      {badge != null && badge > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarNavigation() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { unreadCount } = useUnreadConversations();

  // Messages injected into client group
  const clientItemsWithMessages: NavItem[] = [
    ...clientItems,
    { title: "Messages", url: "/messages", icon: MessageSquare },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-background">
      <SidebarContent className="pt-2">
        <SidebarGroupSection label="Dashboard" items={dashboardItems} currentPath={currentPath} collapsed={collapsed} onNavigate={navigate} />
        <SidebarGroupSection label="Listings" items={listingItems} currentPath={currentPath} collapsed={collapsed} onNavigate={navigate} />
        <SidebarGroupSection label="Clients" items={clientItemsWithMessages} currentPath={currentPath} collapsed={collapsed} onNavigate={navigate} unreadCount={unreadCount} />
        <SidebarGroupSection label="Insights" items={insightItems} currentPath={currentPath} collapsed={collapsed} onNavigate={navigate} />
        <SidebarGroupSection label="Settings" items={settingsItems} currentPath={currentPath} collapsed={collapsed} onNavigate={navigate} />
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="flex items-center justify-center opacity-40">
            <Logo size="sm" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
