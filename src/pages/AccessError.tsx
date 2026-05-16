import { useEffect, useState } from "react";
import { ShieldX, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AACMonogram from "@/components/ui/AACMonogram";
import AccessErrorContactDialog from "@/components/access-error/AccessErrorContactDialog";
import { supabase } from "@/integrations/supabase/client";

const AAC_GREEN = "#22C55E";

const AccessError = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setDefaultEmail(data.user.email);
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
    {/* Black header */}
    <header className="w-full bg-black">
      <div className="mx-auto max-w-7xl px-5 h-16 flex items-center">
        <Link to="/" aria-label="All Agent Connect — Home" className="inline-flex items-center gap-2.5">
          <span className="inline-flex w-7 h-7" style={{ color: AAC_GREEN }}>
            <AACMonogram className="w-full h-full" />
          </span>
          <span className="font-semibold tracking-tight text-white text-[15px]">
            All Agent Connect
          </span>
        </Link>
      </div>
    </header>

    {/* Main content */}
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <ShieldX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Access Unavailable</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Your account doesn't have a role assigned yet, or access has been restricted.
          Reach out and we'll get you sorted.
        </p>

        <Button onClick={() => setContactOpen(true)}>
          <Mail className="w-4 h-4 mr-2" />
          Contact Support
        </Button>
      </div>
    </main>

      {/* Black footer */}
      <footer className="w-full bg-black py-6">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} All Agent Connect. All rights reserved.
          </p>
        </div>
      </footer>

      <AccessErrorContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultEmail={defaultEmail}
      />
    </div>
  );
};

export default AccessError;
