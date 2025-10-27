import { Button } from "@/components/ui/button";
import { Home, Search, Users, LayoutDashboard } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              <span className="text-primary">Direct</span> Connect MLS
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Home className="w-4 h-4" />
              Home
            </a>
            <a href="#properties" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Search className="w-4 h-4" />
              Buy
            </a>
            <a href="#agents" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <Users className="w-4 h-4" />
              Our Agents
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button size="sm">Sign In</Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
