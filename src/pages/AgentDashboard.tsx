import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";

interface County {
  id: string;
  name: string;
  state: string;
}

interface AgentProfile {
  receive_buyer_alerts: boolean;
}

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());
  const [receiveAlerts, setReceiveAlerts] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadData(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async (userId: string) => {
    try {
      const [countiesRes, prefsRes, profileRes] = await Promise.all([
        supabase.from("counties").select("*").order("name"),
        supabase.from("agent_county_preferences").select("county_id").eq("agent_id", userId),
        supabase.from("agent_profiles").select("receive_buyer_alerts").eq("id", userId).single(),
      ]);

      if (countiesRes.data) setCounties(countiesRes.data);
      if (prefsRes.data) {
        setSelectedCounties(new Set(prefsRes.data.map((p) => p.county_id)));
      }
      if (profileRes.data) {
        setReceiveAlerts(profileRes.data.receive_buyer_alerts);
      }
    } catch (error: any) {
      toast.error("Error loading data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCountyToggle = async (countyId: string) => {
    const newSelected = new Set(selectedCounties);
    
    try {
      if (newSelected.has(countyId)) {
        newSelected.delete(countyId);
        await supabase
          .from("agent_county_preferences")
          .delete()
          .eq("agent_id", user?.id)
          .eq("county_id", countyId);
      } else {
        newSelected.add(countyId);
        await supabase.from("agent_county_preferences").insert({
          agent_id: user?.id,
          county_id: countyId,
        });
      }
      setSelectedCounties(newSelected);
      toast.success("County preferences updated");
    } catch (error: any) {
      toast.error("Error updating preferences: " + error.message);
    }
  };

  const handleAlertsToggle = async () => {
    try {
      const newValue = !receiveAlerts;
      await supabase
        .from("agent_profiles")
        .update({ receive_buyer_alerts: newValue })
        .eq("id", user?.id);
      setReceiveAlerts(newValue);
      toast.success(newValue ? "Email alerts enabled" : "Email alerts disabled");
    } catch (error: any) {
      toast.error("Error updating alert preference: " + error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Agent Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Email Alerts</CardTitle>
              <CardDescription>
                Control whether you receive buyer need notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receive-alerts"
                  checked={receiveAlerts}
                  onCheckedChange={handleAlertsToggle}
                />
                <Label htmlFor="receive-alerts" className="cursor-pointer">
                  Receive buyer need email alerts
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>County Preferences</CardTitle>
              <CardDescription>
                Select counties where you want to receive buyer alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {counties.map((county) => (
                  <div key={county.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={county.id}
                      checked={selectedCounties.has(county.id)}
                      onCheckedChange={() => handleCountyToggle(county.id)}
                    />
                    <Label htmlFor={county.id} className="cursor-pointer">
                      {county.name}, {county.state}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Add listings or post buyer needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate("/add-listing")}
                className="w-full"
              >
                Add New Listing
              </Button>
              <Button 
                onClick={() => navigate("/submit-buyer-need")}
                variant="secondary"
                className="w-full"
              >
                Submit New Buyer Need
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
