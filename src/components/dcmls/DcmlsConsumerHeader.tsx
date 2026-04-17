import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AACMonogram from "@/components/ui/AACMonogram";

const AAC_BLUE = "#0E56F5";

interface NavItem {
  label: string;
  to: string;
  authed?: boolean;
}

const PUBLIC_ITEMS: NavItem[] = [
  { label: "Browse", to: "/browse?dcmls=1" },
];
const AUTHED_ITEMS: NavItem[] = [
  { label: "Browse", to: "/browse?dcmls=1" },
  { label: "Saved Homes", to: "/saved", authed: true },
  { label: "Hot Sheets", to: "/searches", authed: true },
  { label: "Account", to: "/account", authed: true },
];

interface PageLink {
  label: string;
  to: string;
  external?: boolean;
}

const PAGES_LINKS: PageLink[] = [
  { label: "About", to: "https://allagentconnect.com", external: true },
  { label: "Contact", to: "mailto:hello@allagentconnect.com", external: true },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Fair Housing", to: "/fair-housing" },
  { label: "Disclosures", to: "/disclosures" },
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

  const renderPageLink = (p: PageLink, className?: string) =>
    p.external ? (
      <a
        key={p.to}
        href={p.to}
        target={p.to.startsWith("mailto:") ? undefined : "_blank"}
        rel={p.to.startsWith("mailto:") ? undefined : "noreferrer"}
        className={className}
      >
        {p.label}
      </a>
    ) : (
      <Link key={p.to} to={p.to} className={className}>
        {p.label}
      </Link>
    );

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

          {/* Pages dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1"
              >
                Pages
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {PAGES_LINKS.map((p) => (
                <DropdownMenuItem key={p.to} asChild>
                  {renderPageLink(p, "w-full cursor-pointer text-sm")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {signedIn ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          ) : (
            <div className="flex items-center gap-2 pl-2">
              <Button asChild variant="ghost" size="sm" className="text-foreground">
                <Link to="/consumer/auth?mode=signin">Sign In</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="text-white"
                style={{ backgroundColor: AAC_BLUE }}
              >
                <Link to="/consumer/auth?mode=signup">Create Account</Link>
              </Button>
            </div>
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
                <div className="flex flex-col gap-2 mt-2">
                  <Button asChild variant="outline">
                    <Link to="/consumer/auth?mode=signin">Sign In</Link>
                  </Button>
                  <Button
                    asChild
                    className="text-white"
                    style={{ backgroundColor: AAC_BLUE }}
                  >
                    <Link to="/consumer/auth?mode=signup">Create Account</Link>
                  </Button>
                </div>
              )}

              {/* Pages section (mobile) */}
              <div className="mt-6 pt-4 border-t border-border/60">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold px-3 mb-2">
                  Pages
                </div>
                <div className="flex flex-col">
                  {PAGES_LINKS.map((p) =>
                    renderPageLink(
                      p,
                      "px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors",
                    ),
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default DcmlsConsumerHeader;
