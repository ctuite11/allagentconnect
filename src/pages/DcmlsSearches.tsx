import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import DcmlsConsumerHeader from "@/components/dcmls/DcmlsConsumerHeader";
import { Button } from "@/components/ui/button";
import { Bell, Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface SavedSearch {
  id: string;
  name: string;
  criteria: any;
  created_at: string;
  updated_at: string;
  notify_client_email: boolean | null;
}

const summarizeCriteria = (c: any): string => {
  if (!c || typeof c !== "object") return "All listings";
  const parts: string[] = [];
  if (Array.isArray(c.cities) && c.cities.length > 0) {
    parts.push(c.cities.slice(0, 3).join(", ") + (c.cities.length > 3 ? "…" : ""));
  } else if (Array.isArray(c.towns) && c.towns.length > 0) {
    parts.push(c.towns.slice(0, 3).join(", ") + (c.towns.length > 3 ? "…" : ""));
  }
  if (Array.isArray(c.propertyTypes) && c.propertyTypes.length > 0) {
    parts.push(c.propertyTypes.join(", "));
  }
  if (c.maxPrice) parts.push(`Up to $${(Number(c.maxPrice) / 1000).toFixed(0)}k`);
  if (c.bedrooms) parts.push(`${c.bedrooms}+ bd`);
  return parts.length > 0 ? parts.join(" · ") : "All listings";
};

const DcmlsSearches = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth?redirect=/searches");
      return;
    }
    const { data, error } = await supabase
      .from("hot_sheets")
      .select("id, name, criteria, created_at, updated_at, notify_client_email")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load saved searches");
    } else {
      setSearches((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [navigate]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved search? You'll stop receiving alerts.")) return;
    const { error } = await supabase.from("hot_sheets").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete search");
    } else {
      toast.success("Saved search deleted");
      setSearches((s) => s.filter((x) => x.id !== id));
    }
  };

  const toggleAlerts = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("hot_sheets")
      .update({ notify_client_email: enabled })
      .eq("id", id);
    if (error) {
      toast.error("Could not update alerts");
    } else {
      setSearches((s) => s.map((x) => (x.id === id ? { ...x, notify_client_email: enabled } : x)));
      toast.success(enabled ? "Email alerts on" : "Email alerts off");
    }
  };

  return (
    <>
      <Seo
        title="Saved Searches — Direct Connect MLS"
        description="Your saved searches and email alerts on Direct Connect MLS."
        canonical="https://directconnectmls.com/searches"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <DcmlsConsumerHeader />

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-16">
          <div className="flex items-start justify-between mb-10 gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                Saved Searches
              </h1>
              <p className="text-muted-foreground mt-2">
                Get notified the moment a matching home hits the network.
              </p>
            </div>
            <Button asChild>
              <Link to="/client/hotsheets/new">
                <Plus className="w-4 h-4 mr-1.5" />
                New Saved Search
              </Link>
            </Button>
          </div>

          {!loading && searches.length === 0 && (
            <div className="border border-border/60 rounded-2xl p-16 text-center bg-muted/20">
              <Search className="w-10 h-10 mx-auto mb-4 text-muted-foreground/60" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No saved searches yet
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create a saved search to receive email alerts when new homes match what you're looking for.
              </p>
              <Button asChild>
                <Link to="/client/hotsheets/new">Create your first search</Link>
              </Button>
            </div>
          )}

          {!loading && searches.length > 0 && (
            <div className="space-y-4">
              {searches.map((s) => (
                <div
                  key={s.id}
                  className="border border-border/60 rounded-xl p-6 bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {s.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {summarizeCriteria(s.criteria)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Updated {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={s.notify_client_email ? "default" : "outline"}
                        onClick={() => toggleAlerts(s.id, !s.notify_client_email)}
                      >
                        <Bell className="w-3.5 h-3.5 mr-1.5" />
                        {s.notify_client_email ? "Alerts on" : "Alerts off"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(s.id)}
                        aria-label="Delete saved search"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default DcmlsSearches;
