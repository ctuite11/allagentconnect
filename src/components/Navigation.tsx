import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search, Users, LayoutDashboard, Menu, X, Heart, Bell, ChevronDown, Building2, FileText, UserCog, Plus, List } from "lucide-react";
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>
              <span className="text-primary">AllAgent</span>Connect
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
              <DropdownMenuContent className="w-56 bg-background z-50">
                <DropdownMenuLabel>Properties</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/browse")}>
                    <Search className="mr-2 h-4 w-4" />
                    Browse Properties
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
                  {user && (
                    <DropdownMenuItem onClick={() => navigate("/agent-search")}>
                      <Search className="mr-2 h-4 w-4" />
                      Agent Search
                    </DropdownMenuItem>
                  )}
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
                  <DropdownMenuItem onClick={() => navigate("/submit-buyer-need")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Submit Buyer Need
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Agent Tools</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("/agent-dashboard")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
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
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/submit-buyer-need")}>
              Submit Need
            </Button>
            {user ? (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate("/agent-search")}>
                  Agent Search
                </Button>
                <Button variant="default" size="sm" onClick={() => navigate("/agent-dashboard")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")}>
                Agent Login
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
              Browse
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
                <button
                  onClick={() => {
                    navigate("/favorites");
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full py-2 text-foreground hover:text-primary transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  Favorites
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
              </>
            )}
            <div className="pt-4 border-t border-border mt-4 space-y-2">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  navigate("/submit-buyer-need");
                  setIsMenuOpen(false);
                }}
              >
                Submit Need
              </Button>
              {user ? (
                <>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => {
                      navigate("/agent-search");
                      setIsMenuOpen(false);
                    }}
                  >
                    Agent Search
                  </Button>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      navigate("/agent-dashboard");
                      setIsMenuOpen(false);
                    }}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => {
                    navigate("/auth");
                    setIsMenuOpen(false);
                  }}
                >
                  Agent Login
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
