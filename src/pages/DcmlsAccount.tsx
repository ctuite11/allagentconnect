import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import { Button } from "@/components/ui/button";
import { Heart, Search, Bell, ArrowRight } from "lucide-react";

const AAC_GREEN = "#50C878";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const DcmlsAccount = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ saved: 0, searches: 0, alertsOn: 0 });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?redirect=/account");
        return;
      }

      const [{ data: profileData }, { count: savedCount }, { data: searchesData }] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("hot_sheets").select("id, notify_client_email").eq("user_id", user.id),
      ]);

      setProfile(profileData ?? { first_name: null, last_name: null, email: user.email ?? null });
      setStats({
        saved: savedCount ?? 0,
        searches: searchesData?.length ?? 0,
        alertsOn: searchesData?.filter((s: any) => s.notify_client_email).length ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [navigate]);

  const firstName = profile?.first_name?.trim();
  const greeting = firstName ? `Welcome back, ${firstName}.` : "Welcome back.";

  return (
    <>
      <Seo
        title="Your Account — Direct Connect MLS"
        description="Your saved homes, searches, and activity on Direct Connect MLS."
        canonical="https://directconnectmls.com/account"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 md:py-16">
          {/* Greeting */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: AAC_GREEN }}
                aria-hidden
              />
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                Your Account
              </p>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
              {greeting}
            </h1>
            {profile?.email && (
              <p className="text-muted-foreground mt-3 text-sm">{profile.email}</p>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <Link
              to="/saved"
              className="group border border-border/60 rounded-xl p-6 bg-card hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <Heart className="w-5 h-5 text-muted-foreground" />
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                {loading ? "—" : stats.saved}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Saved Homes</p>
            </Link>

            <Link
              to="/searches"
              className="group border border-border/60 rounded-xl p-6 bg-card hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <Search className="w-5 h-5 text-muted-foreground" />
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                {loading ? "—" : stats.searches}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Saved Searches</p>
            </Link>

            <div className="border border-border/60 rounded-xl p-6 bg-card">
              <div className="flex items-start justify-between mb-6">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                {loading ? "—" : stats.alertsOn}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Active Alerts</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="border-t border-border/60 pt-12">
            <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground font-medium mb-6">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/browse?dcmls=1">Browse Listings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/client/hotsheets/new">New Saved Search</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/saved">View Saved Homes</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default DcmlsAccount;
