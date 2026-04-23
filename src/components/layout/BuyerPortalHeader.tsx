import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Canonical buyer portal header.
 * White top toolbar — used for ALL buyer-role authenticated routes.
 * This is the only buyer header path. The legacy global Navigation is removed.
 */

const BUYER_NAV = [
  { to: "/browse", label: "Search" },
  { to: "/client/dashboard", label: "Dashboard" },
  { to: "/favorites", label: "Favorites" },
  { to: "/hot-sheets", label: "Hot Sheets" },
  { to: "/messages", label: "Messages" },
  { to: "/client/account", label: "Account" },
];

export function BuyerPortalHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  return (
    <header className="w-full bg-white border-b border-zinc-200">
      <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between gap-6">
        {/* Brand lockup */}
        <Link
          to="/client/dashboard"
          className="flex items-center gap-3 shrink-0"
          aria-label="All Agent Connect — Buyer Portal"
        >
          <Logo variant="primary" size="md" />
          <span className="hidden sm:inline-block text-xs font-medium text-zinc-500 tracking-wide uppercase border-l border-zinc-200 pl-3">
            Buyer Portal
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {BUYER_NAV.map((item) => (
            <NavLink
              key={item.to}
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
          ))}
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
          className="md:hidden p-2 -mr-2 text-zinc-700"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-3 flex flex-col gap-1">
            {BUYER_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-md text-sm ${
                    isActive
                      ? "text-[#0E56F5] font-medium bg-zinc-50"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
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
