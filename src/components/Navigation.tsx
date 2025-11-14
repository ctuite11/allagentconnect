import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search, Users, LayoutDashboard, Menu, X, Heart, Bell, ChevronDown, Building2, FileText, UserCog, Plus, List, UserCircle, BarChart3, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
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
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="text-2xl font-bold cursor-pointer" 
              onClick={() => navigate("/")}
            >
              <span className="text-primary">All Agent</span> <span className="text-foreground">Connect</span>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            
            {/* All Pages Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
                  <Menu className="w-4 h-4" />
                  All Pages
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card border-border shadow-lg z-[100]">
                <DropdownMenuLabel>Properties</DropdownMenuLabel>
                <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate("/browse")}>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/market-insights")}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Market Insights
                  </DropdownMenuItem>
                  {user && (
                    <DropdownMenuItem onClick={() => navigate("/favorites")}>
                      <Heart className="mr-2 h-4 w-4" />
                      Favorites
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Agents</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/our-agents")}>
                    <Users className="mr-2 h-4 w-4" />
                    Our Agents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/agent-search") }>
                    <Search className="mr-2 h-4 w-4" />
                    Agent Search
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tools</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {user && (
                    <DropdownMenuItem onClick={() => navigate("/hot-sheets")}>
                      <Bell className="mr-2 h-4 w-4" />
                      Hot Sheets
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Agent Tools</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("/agent-dashboard")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Success Hub
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-clients")}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        My Clients
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/client-needs")}>
                        <FileText className="mr-2 h-4 w-4" />
                        Client Needs
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/add-listing")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add For Sale Listing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/add-rental-listing")}>
                        <Building2 className="mr-2 h-4 w-4" />
                        Add Rental Listing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent-profile-editor")}>
                        <UserCog className="mr-2 h-4 w-4" />
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/manage-team")}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Team
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Vendors</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/vendor/directory")}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Vendor Directory
                  </DropdownMenuItem>
                  {user && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/vendor/packages")}>
                        <List className="mr-2 h-4 w-4" />
                        Ad Packages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/vendor/dashboard")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Vendor Dashboard
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Success Hub
                      <ChevronDown className="w-3 h-3 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-card border-border shadow-lg z-[100]">
                    <DropdownMenuLabel>Agent Tools</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("/browse")}>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent-dashboard")}>
                        <List className="mr-2 h-4 w-4" />
                        My Listings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-clients")}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        My Contacts
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/hot-sheets")}>
                        <Bell className="mr-2 h-4 w-4" />
                        Hot Sheets
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/client-needs")}>
                        <FileText className="mr-2 h-4 w-4" />
                        Communication Center
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/agent-profile-editor")}>
                        <UserCog className="mr-2 h-4 w-4" />
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/manage-team")}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Team
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Login
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-2">
            <button
              onClick={() => {
                navigate("/");
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            <button
              onClick={() => {
                navigate("/browse");
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={() => {
                navigate("/agent-search");
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
            >
              <Search className="w-4 h-4" />
              Agent Search
            </button>
            <button
              onClick={() => {
                navigate("/our-agents");
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
            >
              <Users className="w-4 h-4" />
              Our Agents
            </button>
            {user && (
              <>
                <div className="pt-2 border-t border-border mt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-2">Agent Tools</p>
                  <button
                    onClick={() => {
                      navigate("/browse");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                  <button
                    onClick={() => {
                      navigate("/agent-dashboard");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <List className="w-4 h-4" />
                    My Listings
                  </button>
                  <button
                    onClick={() => {
                      navigate("/my-clients");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <UserCircle className="w-4 h-4" />
                    My Contacts
                  </button>
                  <button
                    onClick={() => {
                      navigate("/hot-sheets");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    Hot Sheets
                  </button>
                  <button
                    onClick={() => {
                      navigate("/client-needs");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Communication Center
                  </button>
                  <button
                    onClick={() => {
                      navigate("/agent-profile-editor");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <UserCog className="w-4 h-4" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      navigate("/manage-team");
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Manage Team
                  </button>
                </div>
              </>
            )}
            <div className="pt-4 border-t border-border mt-4 space-y-2">
              {user ? (
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              ) : (
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    navigate("/auth");
                    setIsMenuOpen(false);
                  }}
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
