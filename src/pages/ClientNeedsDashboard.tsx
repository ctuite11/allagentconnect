import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { Seo } from "@/components/Seo";
import { toast } from "sonner";
import { aacStyles } from "@/ui/aacStyles";

const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="bg-white pt-6">
      <Seo
        title="Comms | All Agent Connect"
        description="Use the canonical AAC Hot Sheet builder from the agent Hot Sheets flow."
        canonical="https://allagentconnect.com/client-needs"
        noindex
      />

      <main className={`${aacStyles.pageContainer} pb-12`}>
        <PageHeader
          title="Communications Center"
          subtitle="Using the exact Hot Sheet form from /agent/hot-sheets"
        />

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h2 className="text-[22px] font-semibold text-zinc-900">Hot Sheet Builder</h2>
          <p className="mt-2 text-sm text-zinc-600">
            This launches the same form component used on agent Hot Sheets. Notification settings are hidden in this flow.
          </p>

          <div className="mt-5">
            <Button onClick={() => setBuilderOpen(true)}>Open Canonical Hot Sheet Form</Button>
          </div>
        </section>
      </main>

      {user && (
        <CreateHotSheetDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          userId={user.id}
          hideNotificationSettings
          onSuccess={(hotSheetId) => {
            toast.success("Hot Sheet created");
            setBuilderOpen(false);
            navigate(`/hot-sheets/${hotSheetId}/review`);
          }}
        />
      )}
    </div>
  );
};

export default ClientNeedsDashboard;
