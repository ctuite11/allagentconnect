import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogOut, Search, LayoutDashboard, Heart, Flame, MessageSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import { MessagesUnreadBadge } from "@/components/messaging/MessagesUnreadBadge";
import AACMonogram from "@/components/ui/AACMonogram";

const NAV_ITEMS = [
  { to: "/client/search", label: "Search", icon: Search },
  { to: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/hot-sheets", label: "Hot Sheets", icon: Flame },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/client/account", label: "Account", icon: User },
];

export function BuyerPortalHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useUnreadConversations();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full overflow-visible bg-white/96 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center overflow-visible px-4 pr-6 sm:px-6">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden mr-2 p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <button
          onClick={() => navigate("/client/dashboard")}
          className="flex min-w-0 flex-shrink-0 items-center gap-2.5 text-left"
          aria-label="Dashboard"
        >
          <AACMonogram className="h-9 w-9 flex-shrink-0 text-[#16A34A]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="truncate text-[15px] font-bold tracking-tight text-zinc-900">
                All Agent Connect
              </span>
            </div>
            <div className="mt-1 hidden items-center sm:flex text-[11px] leading-none">
              <span className="font-medium tracking-[0.02em] text-zinc-500">
                Buyer Portal
              </span>
            </div>
          </div>
        </button>

        <nav className="ml-auto hidden items-center gap-1 overflow-visible sm:flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
                  isActive
                    ? "text-zinc-900 font-semibold"
                    : "text-zinc-600 font-medium hover:text-zinc-900 hover:bg-zinc-50"
                }`
              }
            >
              {({ isActive }) =>
                to === "/messages" ? (
                  <>
                    <span className="relative inline-flex shrink-0">
                      <Icon
                        className={`h-4 w-4 flex-shrink-0 ${
                          isActive ? "text-[#0E56F5]" : "text-zinc-500"
                        }`}
                      />
                      <MessagesUnreadBadge count={unreadCount} />
                    </span>
                    {label}
                  </>
                ) : (
                  <>
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${
                        isActive ? "text-[#0E56F5]" : "text-zinc-500"
                      }`}
                    />
                    {label}
                  </>
                )
              }
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="hidden sm:inline-flex ml-3 items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden ml-auto p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "text-zinc-900 font-semibold bg-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-[#0E56F5]" : "text-zinc-500"
                    }`}
                  />
                  {label}
                  {to === "/messages" ? (
                    <MessagesUnreadBadge count={unreadCount} variant="inline" className="ml-auto" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}

export default BuyerPortalHeader;
