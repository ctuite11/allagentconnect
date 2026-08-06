import { useEffect, useState } from "react";
import { ShieldX, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccessErrorContactDialog from "@/components/access-error/AccessErrorContactDialog";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";

const AccessError = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setDefaultEmail(data.user.email);
    });
  }, []);

  const resetSession = async () => {
    setResetting(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore — we clear storage below regardless
    }
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // storage may be unavailable
    }
    window.location.replace("/auth");
  };

  return (
    <>
      <AuthShell>
        <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm text-center">
          <ShieldX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Access Unavailable</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Your account doesn't have a role assigned yet, or access has been restricted.
            Reach out and we'll get you sorted.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={resetSession} disabled={resetting}>
              <LogOut className="w-4 h-4 mr-2" />
              {resetting ? "Clearing…" : "Sign out and try again"}
            </Button>
            <Button onClick={() => setContactOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>
      </AuthShell>
      <AccessErrorContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultEmail={defaultEmail}
      />
    </>
  );
};

export default AccessError;
