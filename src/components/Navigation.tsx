import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search, Users, LayoutDashboard, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
              <span className="text-primary">Direct</span> Connect MLS
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="/#home" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Home className="w-4 h-4" />
              Home
            </a>
            <a href="/#properties" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Search className="w-4 h-4" />
              Buy
            </a>
            <a href="/#agents" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Users className="w-4 h-4" />
              Our Agents
            </a>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/agent-dashboard")}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
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
            <a
              href="/#home"
              className="flex items-center gap-2 py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <Home className="w-4 h-4" />
              Home
            </a>
            <a
              href="/#properties"
              className="flex items-center gap-2 py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <Search className="w-4 h-4" />
              Buy
            </a>
            <a
              href="/#agents"
              className="flex items-center gap-2 py-2 text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <Users className="w-4 h-4" />
              Our Agents
            </a>
            <div className="pt-4 border-t border-border mt-4">
              {user ? (
                <Button 
                  className="w-full" 
                  variant="ghost"
                  onClick={() => {
                    navigate("/agent-dashboard");
                    setIsMenuOpen(false);
                  }}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
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
