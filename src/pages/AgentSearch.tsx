import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Building2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";

const AgentSearch = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [counties, setCounties] = useState<any[]>([]);
  const [showBuyerIncentivesOnly, setShowBuyerIncentivesOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"a-z" | "z-a">("a-z");

  useEffect(() => {
    fetchCounties();
    fetchAgents();
  }, []);

  const fetchCounties = async () => {
    try {
      const { data, error } = await supabase
        .from("counties")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setCounties(data || []);
    } catch (error: any) {
      console.error("Error fetching counties:", error);
    }
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          agent_county_preferences (
            county_id,
            counties (id, name, state)
          )
        `)
        .eq("receive_buyer_alerts", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCounty = (countyId: string) => {
    setSelectedCounties(prev =>
      prev.includes(countyId)
        ? prev.filter(id => id !== countyId)
        : [...prev, countyId]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCounties([]);
    setShowBuyerIncentivesOnly(false);
    setSortOrder("a-z");
  };

  const filteredAgents = agents.filter((agent) => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesText = 
        agent.first_name?.toLowerCase().includes(query) ||
        agent.last_name?.toLowerCase().includes(query) ||
        agent.company?.toLowerCase().includes(query) ||
        agent.email?.toLowerCase().includes(query);
      
      if (!matchesText) return false;
    }

    // County filter
    if (selectedCounties.length > 0) {
      const agentCounties = agent.agent_county_preferences?.map((pref: any) => pref.counties.id) || [];
      const hasMatchingCounty = selectedCounties.some(countyId => agentCounties.includes(countyId));
      if (!hasMatchingCounty) return false;
    }

    // Buyer incentives filter
    if (showBuyerIncentivesOnly && !agent.buyer_incentives) {
      return false;
    }

    return true;
  });

  // Apply sorting
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
    
    if (sortOrder === "a-z") {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-24">
        {/* Header */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Agent Search
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              Find experienced real estate agents in your preferred counties who are ready to help with your property needs
            </p>
          </div>
        </section>

        {/* Search and Filters */}
        <section className="py-8 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-4 gap-6">
              {/* Filters Sidebar */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Filters</CardTitle>
                      {(searchQuery || selectedCounties.length > 0 || showBuyerIncentivesOnly) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFilters}
                          className="text-xs"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Search Input */}
                    <div className="space-y-2">
                      <Label>Search by Name or Company</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          type="text"
                          placeholder="Search agents..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setSearchQuery("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* County Filter */}
                    <div className="space-y-2">
                      <Label>Service Areas (Counties)</Label>
                      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
                        {counties.map((county) => (
                          <div key={county.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`county-${county.id}`}
                              checked={selectedCounties.includes(county.id)}
                              onCheckedChange={() => toggleCounty(county.id)}
                            />
                            <Label
                              htmlFor={`county-${county.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {county.name}, {county.state}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {selectedCounties.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedCounties.length} {selectedCounties.length === 1 ? 'county' : 'counties'} selected
                        </p>
                      )}
                    </div>

                    {/* Buyer Incentives Filter */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="buyer-incentives"
                          checked={showBuyerIncentivesOnly}
                          onCheckedChange={(checked) => setShowBuyerIncentivesOnly(checked as boolean)}
                        />
                        <Label htmlFor="buyer-incentives" className="cursor-pointer">
                          Offers Buyer Incentives
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Results */}
              <div className="lg:col-span-3">
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading agents...</p>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      No agents found matching your criteria
                    </p>
                    <Button onClick={handleClearFilters} variant="outline">
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {filteredAgents.length} {filteredAgents.length === 1 ? "agent" : "agents"} found
                      </p>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="sort-order" className="text-sm">Sort:</Label>
                        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a")}>
                          <SelectTrigger id="sort-order" className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a-z">A-Z</SelectItem>
                            <SelectItem value="z-a">Z-A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      {sortedAgents.map((agent) => (
                        <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl font-bold text-primary">
                                  {agent.first_name?.[0]}{agent.last_name?.[0]}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate">
                                  {agent.first_name} {agent.last_name}
                                </CardTitle>
                                {agent.company && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {agent.company}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{agent.email}</span>
                            </div>
                            
                            {agent.phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4 flex-shrink-0" />
                                <span>{agent.phone}</span>
                              </div>
                            )}

                            {agent.buyer_incentives && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium text-primary mb-1">Buyer Incentives:</p>
                                <p className="text-sm text-muted-foreground">{agent.buyer_incentives}</p>
                              </div>
                            )}

                            {agent.agent_county_preferences && agent.agent_county_preferences.length > 0 && (
                              <div className="pt-2 border-t">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                                  <div className="flex-1">
                                    <p className="font-medium text-xs text-muted-foreground mb-1">Service Areas:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {agent.agent_county_preferences.slice(0, 3).map((pref: any) => (
                                        <span
                                          key={pref.county_id}
                                          className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                                        >
                                          {pref.counties.name}, {pref.counties.state}
                                        </span>
                                      ))}
                                      {agent.agent_county_preferences.length > 3 && (
                                        <span className="text-xs text-muted-foreground px-2 py-1">
                                          +{agent.agent_county_preferences.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <Button 
                              className="w-full mt-4" 
                              onClick={() => navigate(`/agent/${agent.id}`)}
                            >
                              View Full Profile
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Are You a Real Estate Agent?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join All Agent Connect and get matched with buyers actively searching for properties in your area
            </p>
              <Button size="lg" variant="secondary" onClick={() => navigate("/auth")}>
                Register as an Agent
              </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AgentSearch;
