import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, ArrowRight, Loader2 } from "lucide-react";
import { User } from "@supabase/supabase-js";

const VerifyAgent = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<string>("unverified");

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Fetch agent status from agent_settings
      const { data: settings } = await supabase
        .from('agent_settings')
        .select('agent_status')
        .eq('user_id', session.user.id)
        .single();

      if (mounted && settings) {
        setAgentStatus(settings.agent_status || 'unverified');
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleContinue = () => {
    navigate('/agent-dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            {agentStatus === 'verified' ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : (
              <Shield className="h-8 w-8 text-primary" />
            )}
          </div>

          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {agentStatus === 'verified' ? "You're verified!" : "Welcome to AllAgentConnect"}
          </h1>

          <p className="text-muted-foreground text-sm mb-4">
            {user?.email}
          </p>

          <div className="mb-6">
            <Badge 
              variant={agentStatus === 'verified' ? 'default' : 'secondary'}
              className="text-sm"
            >
              Status: {agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}
            </Badge>
          </div>

          {agentStatus !== 'verified' && (
            <p className="text-sm text-muted-foreground mb-6">
              Complete your profile and verify your license to unlock full platform access.
            </p>
          )}

          <div className="space-y-3">
            <Button onClick={handleContinue} className="w-full">
              Continue to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyAgent;
