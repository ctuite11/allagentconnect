import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Building2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { formatPhoneNumber } from "@/lib/phoneFormat";

const OurAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

    const fetchAgents = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("agent_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading agents:", error);
        throw error;
      }

      setAgents(data || []);
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const filteredAgents = agents.filter((agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.first_name?.toLowerCase().includes(query) ||
      agent.last_name?.toLowerCase().includes(query) ||
      agent.company?.toLowerCase().includes(query) ||
      agent.email?.toLowerCase().includes(query)
    );
  });

  const renderPhoto = (agent: any) => {
    const initials = `${agent.first_name?.[0] || ""}${agent.last_name?.[0] || ""}`.toUpperCase();

    if (agent.headshot_url) {
      return (
        <img
          src={agent.headshot_url}
          alt={`${agent.first_name} ${agent.last_name}`}
          className="h-full w-full object-cover"
        />
      );
    }

    // Fallback “banner” with initials
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/70 via-primary to-primary/80 text-3xl font-semibold text-primary-foreground">
        {initials || "AA"}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="border-b border-border bg-card py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">
              Meet Our Professional Agents
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
              Connect with experienced real estate professionals ready to help you
              find your perfect property.
            </p>

            <div className="mx-auto max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search agents by name, company, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Agents Grid */}
        <section className="bg-background py-12">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Loading agents...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No agents found matching your search."
                    : "No agents available at the moment."}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 text-sm text-muted-foreground">
                  {filteredAgents.length}{" "}
                  {filteredAgents.length === 1 ? "agent" : "agents"} available
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredAgents.map((agent) => (
                    <Card
                      key={agent.id}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card/60 backdrop-blur transition-transform transition-shadow hover:-translate-y-1 hover:shadow-xl"
                    >
                      {/* Rectangular banner photo */}
                      <div className="relative h-44 w-full overflow-hidden">
                        {renderPhoto(agent)}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-80" />
                        {/* Name over photo on larger screens */}
                        <div className="pointer-events-none absolute bottom-3 left-4 hidden text-left text-white drop-shadow-sm sm:block">
                          <div className="text-lg font-semibold">
                            {agent.first_name} {agent.last_name}
                          </div>
                          {agent.title && (
                            <div className="text-xs opacity-90">{agent.title}</div>
                          )}
                        </div>
                      </div>

                      <CardHeader className="pb-3 pt-4 sm:pt-5">
                        {/* Name in header for mobile (since overlay is hidden) */}
                        <CardTitle className="mb-1 text-base font-semibold sm:hidden">
                          {agent.first_name} {agent.last_name}
                        </CardTitle>
                        {agent.title && (
                          <p className="mb-2 text-xs text-muted-foreground sm:hidden">
                            {agent.title}
                          </p>
                        )}

                        {agent.company && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">
                              {agent.company}
                            </span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="flex flex-1 flex-col justify-between gap-4 pb-5">
                        <div className="space-y-2 text-sm">
                          <a
                            href={`mailto:${agent.email}`}
                            className="group/email flex items-center gap-2 text-sm transition-colors hover:text-primary"
                          >
                            <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover/email:text-primary" />
                            <span className="truncate">{agent.email}</span>
                          </a>

                          {agent.phone && (
                            <a
                              href={`tel:${agent.phone}`}
                              className="group/phone flex items-center gap-2 text-sm transition-colors hover:text-primary"
                            >
                              <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover/phone:text-primary" />
                              <span>{formatPhoneNumber(agent.phone)}</span>
                            </a>
                          )}

                          {agent.agent_county_preferences &&
                            agent.agent_county_preferences.length > 0 && (
                              <div className="pt-3">
                                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span>Service Areas</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {agent.agent_county_preferences
                                    .slice(0, 4)
                                    .map((pref: any) => (
                                      <span
                                        key={pref.county_id}
                                        className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary"
                                      >
                                        {pref.counties.name}, {pref.counties.state}
                                      </span>
                                    ))}
                                  {agent.agent_county_preferences.length > 4 && (
                                    <span className="text-[11px] text-muted-foreground">
                                      +
                                      {agent.agent_county_preferences.length - 4}{" "}
                                      more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>

                        <Button
                          className="mt-4 w-full"
                          onClick={() => navigate(`/agent/${agent.id}`)}
                        >
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary py-16 text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Are You a Real Estate Agent?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg opacity-90">
              Join All Agent Connect and connect with buyers actively searching
              for properties in your area.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth")}
            >
              Register as an Agent
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default OurAgents;
