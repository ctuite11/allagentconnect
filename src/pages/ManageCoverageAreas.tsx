import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StatePreferencesManager from "@/components/StatePreferencesManager";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
  <div className="max-w-4xl mx-auto">
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={() => navigate("/allagentconnect")}
        className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-3xl font-bold">Manage Coverage Areas</h1>
    </div>

    <div className="space-y-6">
      <StatePreferencesManager agentId={userId} />
    </div>
  </div>
      </div>
    </div>
  );
};

export default ManageCoverageAreas;
