import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AACMonogram from "@/components/ui/AACMonogram";

const AAC_BLUE = "#0E56F5";

interface NavItem {
  label: string;
  to: string;
  authed?: boolean;
}

const PUBLIC_ITEMS: NavItem[] = [{ label: "Browse", to: "/browse?dcmls=1" }];
const AUTHED_ITEMS: NavItem[] = [
  { label: "Browse", to: "/browse?dcmls=1" },
  { label: "Saved Homes", to: "/saved", authed: true },
  { label: "Saved Searches", to: "/searches", authed: true },
  { label: "Account", to: "/account", authed: true },
];

const DcmlsConsumerHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setSignedIn(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const items = signedIn ? AUTHED_ITEMS : PUBLIC_ITEMS;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (to: string) => {
    const path = to.split("?")[0];
    return location.pathname === path;
  };

  return (
    <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" style={{ color: AAC_BLUE }}>
          <AACMonogram className="w-7 h-7" />
          <span
            className="font-semibold tracking-tight text-foreground text-[15px]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Direct Connect <span style={{ color: AAC_BLUE }}>MLS</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => (
            <Button
              key={item.to}
              asChild
              variant="ghost"
              size="sm"
              className={
                isActive(item.to)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }
            >
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
          {signedIn ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </nav>

        {/* Mobile nav */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-1 mt-8">
              {items.map((item) => (
                <Button
                  key={item.to}
                  asChild
                  variant="ghost"
                  className="justify-start"
                >
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              ))}
              {signedIn ? (
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              ) : (
                <Button asChild className="mt-2">
                  <Link to="/auth">Sign In</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default DcmlsConsumerHeader;
