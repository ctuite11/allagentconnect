import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Navigation removed - rendered globally in App.tsx
import { PageHeader } from "@/components/ui/page-header";
import StatePreferencesManager from "@/components/StatePreferencesManager";
import { toast } from "sonner";

const ManageCoverageAreas = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to manage coverage areas");
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Authentication error");
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Manage Coverage Areas"
            backTo="/agent-dashboard"
            className="mb-6"
          />

          <div className="space-y-6">
            <StatePreferencesManager agentId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageCoverageAreas;
