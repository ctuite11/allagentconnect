import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "aac_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = (type: "all" | "essential") => {
    localStorage.setItem(STORAGE_KEY, type);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-32px)] max-w-[520px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background border border-border rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-sm text-muted-foreground flex-1">
          We use cookies for authentication and platform performance.{" "}
          <Link to="/cookies" className="underline text-primary hover:text-primary/80">
            Cookie Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => accept("essential")}>
            Essential Only
          </Button>
          <Button size="sm" className="rounded-full text-xs" onClick={() => accept("all")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
