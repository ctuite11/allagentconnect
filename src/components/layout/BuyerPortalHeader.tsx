import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUnreadConversations } from "@/hooks/useUnreadConversations";
import AACMonogram from "@/components/ui/AACMonogram";

/**
 * Canonical buyer portal header.
 * White top toolbar — used for ALL buyer-role authenticated routes.
 *
 * Guarantees (do not regress):
 *  - sticky top-0, z-50, 56px (h-14) row
 *  - Messages nav item is position: relative so its absolute unread badge
 *    anchors correctly on desktop AND mobile
 *  - Mobile menu state resets on every route change
 *  - No CSS transform/overflow on parent containers (would break absolute badge)
 */

const BUYER_NAV: { to: string; label: string; key: string }[] = [
  { to: "/client/search", label: "Search", key: "search" },
  { to: "/client/dashboard", label: "Dashboard", key: "dashboard" },
  { to: "/favorites", label: "Favorites", key: "favorites" },
  { to: "/hot-sheets", label: "Hot Sheets", key: "hot-sheets" },
  { to: "/messages", label: "Messages", key: "messages" },
  { to: "/client/account", label: "Account", key: "account" },
];

export function BuyerPortalHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useUnreadConversations();

  // Reset mobile menu on every route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 backdrop-blur border-b border-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="mx-auto max-w-7xl px-5 h-14 flex items-center justify-between gap-6">
        {/* Brand lockup */}
        <Link
          to="/client/dashboard"
          className="flex items-center gap-3 shrink-0"
          aria-label="All Agent Connect — Buyer Portal"
        >
          <span style={{ color: "#16A34A" }} className="inline-flex">
            <AACMonogram size={36} />
          </span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-semibold text-zinc-900 tracking-tight">All Agent Connect</span>
            <span className="text-[11px] font-medium text-zinc-500 tracking-wide uppercase">Buyer Portal</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {BUYER_NAV.map((item) => {
            const isMessages = item.key === "messages";
            return (
              <div key={item.to} className="relative">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "text-[#0E56F5] font-medium"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
                {isMessages && unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} unread messages`}
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center pointer-events-none"
                  >
                    {badgeText}
                  </span>
                )}
              </div>
            );
          })}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="ml-2 text-zinc-600 hover:text-zinc-900"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-zinc-700 relative"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          {!open && unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-600"
            />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-3 flex flex-col gap-1">
            {BUYER_NAV.map((item) => {
              const isMessages = item.key === "messages";
              return (
                <div key={item.to} className="relative">
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-2.5 rounded-md text-sm ${
                        isActive
                          ? "text-[#0E56F5] font-medium bg-zinc-50"
                          : "text-zinc-700 hover:bg-zinc-50"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                  {isMessages && unreadCount > 0 && (
                    <span
                      aria-label={`${unreadCount} unread messages`}
                      className="absolute top-1/2 -translate-y-1/2 right-3 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#0E56F5] text-white text-[11px] font-semibold flex items-center justify-center pointer-events-none"
                    >
                      {badgeText}
                    </span>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-50 text-left"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default BuyerPortalHeader;
