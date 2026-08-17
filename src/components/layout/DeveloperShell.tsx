import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, LogOut, Menu, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AACMonogram from "@/components/ui/AACMonogram";
import { useAuthRole } from "@/hooks/useAuthRole";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/developer", label: "Developments", icon: Building2, end: true },
  { to: "/developer/developments/new", label: "Create Development", icon: Plus, end: false },
] as const;

/**
 * Dedicated product shell for developer accounts — no agent navigation.
 */
export function DeveloperShell() {
  const navigate = useNavigate();
  const { developerAccounts, primaryDeveloperAccountId } = useAuthRole();
  const [mobileOpen, setMobileOpen] = useState(false);

  const companyName =
    developerAccounts.find((a) => a.account_id === primaryDeveloperAccountId)?.name ??
    developerAccounts[0]?.name ??
    null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/developer-login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/developer")}
            className="flex min-w-0 items-center gap-2.5 text-left"
            aria-label="Developer portal home"
          >
            <AACMonogram className="h-8 w-8 shrink-0 text-[#16A34A]" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold tracking-tight text-zinc-900">
                All Agent Connect
              </div>
              <div className="hidden text-[11px] font-medium tracking-[0.02em] text-zinc-500 sm:block">
                Developer Portal{companyName ? ` · ${companyName}` : ""}
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "font-semibold text-zinc-900"
                      : "font-medium text-zinc-600 hover:text-zinc-900",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 sm:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <nav className="border-t border-zinc-100 bg-white px-4 py-3 sm:hidden">
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                        isActive
                          ? "bg-zinc-100 font-semibold text-zinc-900"
                          : "font-medium text-zinc-700",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 text-zinc-500" />
                    {label}
                  </NavLink>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700"
                >
                  <LogOut className="h-4 w-4 text-zinc-500" />
                  Sign out
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export default DeveloperShell;
