import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";
import { Button } from "@/components/ui/button";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { Seo } from "@/components/Seo";
import { toast } from "sonner";
import { agentSectionDesc, agentSectionTitle } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

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
    <>
      <Seo
        title="Comms | All Agent Connect"
        description="Use the canonical AAC Hot Sheet builder from the agent Hot Sheets flow."
        canonical="https://allagentconnect.com/client-needs"
        noindex
      />

      <AgentAacPage className="pb-12">
        <AgentPageHeader
          title="Communications Center"
          subtitle="Opens the same Hot Sheet builder used on Agent Hot Sheets—notifications are tucked away in this flow."
          className="mb-8"
        />

        <AgentSectionCard className="p-6">
          <h2 className={agentSectionTitle}>Hot Sheet Builder</h2>
          <p className={cn("mt-2", agentSectionDesc)}>
            This launches the same form component used on agent Hot Sheets. Notification settings are hidden in this flow.
          </p>

          <div className="mt-5">
            <Button onClick={() => setBuilderOpen(true)}>Open Canonical Hot Sheet Form</Button>
          </div>
        </AgentSectionCard>
      </AgentAacPage>

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
    </>
  );
};

export default ClientNeedsDashboard;
