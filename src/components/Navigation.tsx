import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Users, LayoutDashboard, Menu, X, Heart, Bell, ChevronDown, Building2, FileText, UserCog, Plus, List, UserCircle, BarChart3, LogOut, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { role, loading: roleLoading } = useUserRole(user);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check agent status for pending users
  useEffect(() => {
    const checkAgentStatus = async () => {
      if (!user || role !== "agent") {
        setAgentStatus(null);
        return;
      }

      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', user.id)
        .maybeSingle();

      setAgentStatus(settings?.agent_status || 'unverified');
    };

    if (!roleLoading) {
      checkAgentStatus();
    }
  }, [user, role, roleLoading]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsMenuOpen(false);
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Hide global navigation on auth page
  if (location.pathname === "/auth") return null;

  // HARD LOCKDOWN: Hide navigation on /pending-verification regardless of role
  if (location.pathname === "/pending-verification") return null;

  // Hide navigation for pending agents on any other page as fallback
  const isPending = user && role === "agent" && agentStatus === "pending";
  if (isPending) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
    <header className="bg-white relative">
      <div className="mx-auto max-w-6xl px-5 py-3 flex items-center justify-between">
        <div onClick={() => navigate("/")} className="cursor-pointer">
          <Logo size="lg" />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600 relative top-[1px]">
          <button
            onClick={() => navigate("/")}
            className="hover:text-emerald-600 transition-colors"
          >
            Home
          </button>
          
          {/* All Pages Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                All Pages
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-xl z-[100]">
              <DropdownMenuLabel className="text-slate-500 text-xs">Properties</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate("/browse")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/market-insights")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Market Insights
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem onClick={() => navigate("/favorites")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                    <Heart className="mr-2 h-4 w-4" />
                    Favorites
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuLabel className="text-slate-500 text-xs">Agents</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate("/find-agent")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                  <Users className="mr-2 h-4 w-4" />
                  Find an Agent
                </DropdownMenuItem>
                {user && role === "agent" && (
                  <DropdownMenuItem onClick={() => navigate("/our-members")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                    <Users className="mr-2 h-4 w-4" />
                    Our Members
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/agent-search")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                  <Search className="mr-2 h-4 w-4" />
                  Agent Search
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              {user && (
                <>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuLabel className="text-slate-500 text-xs">Agent Tools</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate("/agent-dashboard")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Success Hub
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/agent/listings")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <List className="mr-2 h-4 w-4" />
                      My Listings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/my-clients")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <UserCircle className="mr-2 h-4 w-4" />
                      My Contacts
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/hot-sheets")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <Bell className="mr-2 h-4 w-4" />
                      Hot Sheets
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/client-needs")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <FileText className="mr-2 h-4 w-4" />
                      Communications Center
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/agent-profile-editor")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <UserCog className="mr-2 h-4 w-4" />
                      Profile & Branding
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/listing-search")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <Search className="mr-2 h-4 w-4" />
                      Listing Search
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuLabel className="text-slate-500 text-xs">Add Listings</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate("/agent/listings/new")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <Plus className="mr-2 h-4 w-4" />
                      Add For Sale Listing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/add-rental-listing")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <Building2 className="mr-2 h-4 w-4" />
                      Add Rental Listing
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuLabel className="text-slate-500 text-xs">Vendors</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate("/vendor/directory")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                  <Building2 className="mr-2 h-4 w-4" />
                  Vendor Directory
                </DropdownMenuItem>
                {user && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/vendor/packages")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <List className="mr-2 h-4 w-4" />
                      Ad Packages
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/vendor/dashboard")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Vendor Dashboard
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {user && role === "agent" && (
            <button
              onClick={() => navigate("/agent-dashboard")}
              className="hover:text-emerald-600 transition-colors"
            >
              Success Hub
            </button>
          )}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-2 relative top-[1px]">
          {user ? (
            <>
              {role === "agent" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Tools
                      <ChevronDown className="w-3 h-3 ml-1.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-white border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-xl z-[100]">
                    <DropdownMenuLabel className="text-slate-500 text-xs">Agent Tools</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("/agent-dashboard")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Success Hub
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent/listings")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <List className="mr-2 h-4 w-4" />
                        My Listings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-clients")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <UserCircle className="mr-2 h-4 w-4" />
                        My Contacts
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/hot-sheets")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <Bell className="mr-2 h-4 w-4" />
                        Hot Sheets
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/client-needs")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <FileText className="mr-2 h-4 w-4" />
                        Communications Center
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent-profile-editor")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <UserCog className="mr-2 h-4 w-4" />
                        Profile & Branding
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/listing-search")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <Search className="mr-2 h-4 w-4" />
                        Listing Search
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="bg-slate-200" />
                    <DropdownMenuLabel className="text-slate-500 text-xs">More</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("/browse")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/manage-team")} className="text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        <Users className="mr-2 h-4 w-4" />
                        Manage Team
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {role === "admin" && (
                <button 
                  onClick={() => navigate("/admin/approvals")}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Tools
                </button>
              )}
              {role === "buyer" && (
                <>
                  <button 
                    onClick={() => navigate("/client/dashboard")}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </button>
                  <button 
                    onClick={() => navigate("/client/favorites")}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Favorites
                  </button>
                </>
              )}
              {/* Signed in as email indicator */}
              <span className="hidden lg:inline text-xs text-slate-400 max-w-[150px] truncate" title={user.email || undefined}>
                {user.email}
              </span>
              <button 
                onClick={() => navigate(role === "agent" ? "/listing-search" : "/browse")}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <Search className="w-4 h-4 mr-2" />
                {role === "agent" ? "Search" : "Search Homes"}
              </button>
              <button 
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Get Access <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-700 hover:text-slate-900 transition"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-5 py-4 space-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <button
            onClick={() => {
              navigate("/");
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            onClick={() => {
              navigate(role === "agent" ? "/listing-search" : "/browse");
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
          >
            <Search className="w-4 h-4" />
            {role === "agent" ? "Listing Search" : "Search Homes"}
          </button>
          <button
            onClick={() => {
              navigate("/agent-search");
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
          >
            <Search className="w-4 h-4" />
            Agent Search
          </button>
          <button
            onClick={() => {
              navigate("/find-agent");
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
          >
            <Users className="w-4 h-4" />
            Find an Agent
          </button>
          {user && role === "agent" && (
            <button
              onClick={() => {
                navigate("/our-members");
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
            >
              <Users className="w-4 h-4" />
              Our Members
            </button>
          )}
          {user && (
            <>
              <div className="pt-2 border-t border-slate-200 mt-2">
                {role === "admin" ? (
                  <>
                    <p className="text-xs font-semibold text-slate-500 mb-2 px-2">Admin</p>
                    <button
                      onClick={() => {
                        navigate("/admin/approvals");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <Shield className="w-4 h-4" />
                      Admin Tools
                    </button>
                  </>
                ) : role === "agent" ? (
                  <>
                    <p className="text-xs font-semibold text-slate-500 mb-2 px-2">Agent Tools</p>
                    <button
                      onClick={() => {
                        navigate("/agent-dashboard");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Success Hub
                    </button>
                    <button
                      onClick={() => {
                        navigate("/agent/listings");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <List className="w-4 h-4" />
                      My Listings
                    </button>
                    <button
                      onClick={() => {
                        navigate("/my-clients");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <UserCircle className="w-4 h-4" />
                      My Contacts
                    </button>
                    <button
                      onClick={() => {
                        navigate("/hot-sheets");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <Bell className="w-4 h-4" />
                      Hot Sheets
                    </button>
                    <button
                      onClick={() => {
                        navigate("/client-needs");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <FileText className="w-4 h-4" />
                      Communications Center
                    </button>
                    <button
                      onClick={() => {
                        navigate("/agent-profile-editor");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <UserCog className="w-4 h-4" />
                      Profile & Branding
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-500 mb-2 px-2">Client Portal</p>
                    <button
                      onClick={() => {
                        navigate("/client/dashboard");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      My Dashboard
                    </button>
                    <button
                      onClick={() => {
                        navigate("/client/favorites");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <Heart className="w-4 h-4" />
                      My Favorites
                    </button>
                    <button
                      onClick={() => {
                        navigate("/browse");
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full py-2 text-slate-700 hover:text-slate-900 transition"
                    >
                      <Search className="w-4 h-4" />
                      Search Homes
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          <div className="pt-4 border-t border-slate-200 mt-4 space-y-2">
            {user ? (
              <button 
                className="w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            ) : (
              <>
                <button 
                  className="w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition"
                  onClick={() => {
                    navigate("/auth");
                    setIsMenuOpen(false);
                  }}
                >
                  Log in
                </button>
                <button 
                  className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition"
                  onClick={() => {
                    navigate("/auth");
                    setIsMenuOpen(false);
                  }}
                >
                  Get Access <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Bottom fade overlay - positioned to overlap content below */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full h-3 bg-gradient-to-b from-white/60 to-transparent" />
    </header>
    </div>
  );
};

export default Navigation;
