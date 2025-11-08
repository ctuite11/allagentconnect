import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Eye, Heart, Mail, Calendar, Users, BarChart3, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

interface ListingStats {
  listing_id: string;
  view_count: number;
  save_count: number;
  contact_count: number;
  showing_request_count: number;
  updated_at: string;
  cumulative_active_days: number;
}

interface Listing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  status: string;
  created_at: string;
  is_relisting?: boolean;
  original_listing_id?: string | null;
  listing_stats?: ListingStats;
}

interface ViewData {
  date: string;
  count: number;
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}

const ListingAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("30");
  const [viewsOverTime, setViewsOverTime] = useState<ViewData[]>([]);
  const [currentStats, setCurrentStats] = useState<ListingStats | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);

  useEffect(() => {
    document.title = "Listing Analytics - Agent Connect";
    loadListings();
  }, []);

  useEffect(() => {
    if (id) {
      setSelectedListing(id);
    } else if (listings.length > 0 && !selectedListing) {
      setSelectedListing(listings[0].id);
    }
  }, [id, listings]);

  useEffect(() => {
    if (selectedListing) {
      loadAnalyticsData();
    }
  }, [selectedListing, timeRange]);

  const loadListings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("listings")
        .select(`
          id,
          address,
          city,
          state,
          price,
          status,
          created_at,
          listing_stats (
            listing_id,
            view_count,
            save_count,
            contact_count,
            showing_request_count,
            updated_at
          )
        `)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedData = data?.map(listing => ({
        ...listing,
        listing_stats: listing.listing_stats?.[0]
      })) || [];

      setListings(transformedData);
    } catch (error: any) {
      toast.error("Error loading listings: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      const days = parseInt(timeRange);
      const startDate = startOfDay(subDays(new Date(), days));

      // Load current stats
      const { data: statsData } = await supabase
        .from("listing_stats")
        .select("*")
        .eq("listing_id", selectedListing)
        .single();

      if (statsData) {
        setCurrentStats(statsData);
      }

      // Load views over time
      const { data: viewsData } = await supabase
        .from("listing_views")
        .select("created_at")
        .eq("listing_id", selectedListing)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (viewsData) {
        // Group views by day
        const viewsByDay = new Map<string, number>();
        const dateRange = eachDayOfInterval({
          start: startDate,
          end: new Date()
        });

        // Initialize all days with 0
        dateRange.forEach(date => {
          viewsByDay.set(format(date, "yyyy-MM-dd"), 0);
        });

        // Count views per day
        viewsData.forEach(view => {
          const dateKey = format(new Date(view.created_at), "yyyy-MM-dd");
          viewsByDay.set(dateKey, (viewsByDay.get(dateKey) || 0) + 1);
        });

        // Convert to array for chart
        const chartData = Array.from(viewsByDay.entries()).map(([date, count]) => ({
          date: format(new Date(date), "MMM d"),
          count
        }));

        setViewsOverTime(chartData);
      }

      // Load status history
      const { data: historyData } = await supabase
        .from("listing_status_history")
        .select("*")
        .eq("listing_id", selectedListing)
        .order("changed_at", { ascending: false });

      if (historyData) {
        setStatusHistory(historyData);
      }
    } catch (error: any) {
      console.error("Error loading analytics:", error);
      toast.error("Error loading analytics data");
    }
  };

  const calculateConversionRate = (numerator: number, denominator: number): string => {
    if (denominator === 0) return "0%";
    return ((numerator / denominator) * 100).toFixed(1) + "%";
  };

  const calculateCumulativeActiveDays = (): number => {
    if (statusHistory.length === 0) return 0;

    let totalActiveDays = 0;
    let currentActiveStart: Date | null = null;

    // Sort history by date ascending (oldest first)
    const sortedHistory = [...statusHistory].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    sortedHistory.forEach((history) => {
      const changeDate = new Date(history.changed_at);

      if (history.new_status === 'active' && !currentActiveStart) {
        // Start of an active period
        currentActiveStart = changeDate;
      } else if (history.new_status !== 'active' && currentActiveStart) {
        // End of an active period
        const diffTime = changeDate.getTime() - currentActiveStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalActiveDays += diffDays;
        currentActiveStart = null;
      }
    });

    // If currently active, add days from last active start to now
    if (currentActiveStart) {
      const now = new Date();
      const diffTime = now.getTime() - currentActiveStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalActiveDays += diffDays;
    }

    return totalActiveDays;
  };

  const getEngagementData = () => {
    if (!currentStats) return [];
    return [
      { name: "Views", value: currentStats.view_count, color: "#3b82f6" },
      { name: "Saves", value: currentStats.save_count, color: "#ef4444" },
      { name: "Contacts", value: currentStats.contact_count, color: "#10b981" },
      { name: "Showings", value: currentStats.showing_request_count, color: "#f59e0b" },
    ];
  };

  const getConversionMetrics = () => {
    if (!currentStats) return [];
    
    const viewToSave = calculateConversionRate(currentStats.save_count, currentStats.view_count);
    const viewToContact = calculateConversionRate(currentStats.contact_count, currentStats.view_count);
    const viewToShowing = calculateConversionRate(currentStats.showing_request_count, currentStats.view_count);
    const contactToShowing = calculateConversionRate(currentStats.showing_request_count, currentStats.contact_count);

    return [
      { metric: "View → Save", rate: viewToSave, icon: Heart },
      { metric: "View → Contact", rate: viewToContact, icon: Mail },
      { metric: "View → Showing", rate: viewToShowing, icon: Calendar },
      { metric: "Contact → Showing", rate: contactToShowing, icon: Users },
    ];
  };

  const selectedListingData = listings.find(l => l.id === selectedListing);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/agent-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Listing Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Track performance and engagement metrics for your listings
            </p>
          </div>
        </div>

        {/* Listing Selector and Time Range */}
        <div className="flex gap-4 mb-6">
          <Select value={selectedListing} onValueChange={setSelectedListing}>
            <SelectTrigger className="w-[400px]">
              <SelectValue placeholder="Select a listing" />
            </SelectTrigger>
            <SelectContent>
              {listings.map(listing => (
                <SelectItem key={listing.id} value={listing.id}>
                  {listing.address} - {listing.city}, {listing.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedListingData && currentStats && (
          <>
            {/* Listing Info Card */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedListingData.address}</CardTitle>
                    <CardDescription>
                      {selectedListingData.city}, {selectedListingData.state} • 
                      Listed {format(new Date(selectedListingData.created_at), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      ${selectedListingData.price.toLocaleString()}
                    </div>
                    <Badge variant={selectedListingData.status === "active" ? "default" : "secondary"}>
                      {selectedListingData.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Total Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentStats.view_count}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Saves
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentStats.save_count}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentStats.contact_count}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Showing Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentStats.showing_request_count}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="trends" className="space-y-6">
              <TabsList>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="engagement">Engagement</TabsTrigger>
                <TabsTrigger value="conversions">Conversions</TabsTrigger>
                <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
              </TabsList>

              <TabsContent value="trends" className="space-y-6">
                {/* Views Over Time */}
                <Card>
                  <CardHeader>
                    <CardTitle>Views Over Time</CardTitle>
                    <CardDescription>
                      Daily view count for the selected time period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={viewsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.3}
                          name="Views"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="engagement" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Engagement Breakdown Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Engagement Breakdown</CardTitle>
                      <CardDescription>
                        Distribution of engagement types
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getEngagementData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {getEngagementData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Engagement Bar Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Engagement Metrics</CardTitle>
                      <CardDescription>
                        Total engagement by type
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={getEngagementData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="conversions" className="space-y-6">
                {/* Conversion Rates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getConversionMetrics().map((metric, index) => {
                    const Icon = metric.icon;
                    return (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {metric.metric}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold flex items-center gap-2">
                            {metric.rate}
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Conversion Funnel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Funnel</CardTitle>
                    <CardDescription>
                      Track how viewers progress through the engagement funnel
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Views</span>
                          <span className="text-sm text-muted-foreground">{currentStats.view_count}</span>
                        </div>
                        <div className="w-full h-4 bg-blue-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: "100%" }} />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Saves</span>
                          <span className="text-sm text-muted-foreground">
                            {currentStats.save_count} ({calculateConversionRate(currentStats.save_count, currentStats.view_count)})
                          </span>
                        </div>
                        <div className="w-full h-4 bg-red-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-600" 
                            style={{ 
                              width: `${(currentStats.save_count / Math.max(currentStats.view_count, 1)) * 100}%` 
                            }} 
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Contacts</span>
                          <span className="text-sm text-muted-foreground">
                            {currentStats.contact_count} ({calculateConversionRate(currentStats.contact_count, currentStats.view_count)})
                          </span>
                        </div>
                        <div className="w-full h-4 bg-green-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-600" 
                            style={{ 
                              width: `${(currentStats.contact_count / Math.max(currentStats.view_count, 1)) * 100}%` 
                            }} 
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Showing Requests</span>
                          <span className="text-sm text-muted-foreground">
                            {currentStats.showing_request_count} ({calculateConversionRate(currentStats.showing_request_count, currentStats.view_count)})
                          </span>
                        </div>
                        <div className="w-full h-4 bg-amber-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-600" 
                            style={{ 
                              width: `${(currentStats.showing_request_count / Math.max(currentStats.view_count, 1)) * 100}%` 
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lifecycle" className="space-y-6">
                {/* Relisting Information Alert */}
                {selectedListingData && (selectedListingData as any).is_relisting && (
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-1">Relisted Property</h4>
                          <p className="text-sm text-blue-700">
                            This listing was relisted within 30 days by the same agent. 
                            Days on market and status history have been preserved from the previous listing.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Status History Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Listing Status History
                    </CardTitle>
                    <CardDescription>
                      Complete timeline of all status changes for this listing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statusHistory.length > 0 ? (
                      <div className="space-y-4">
                        {statusHistory.map((history, index) => (
                          <div key={history.id} className="relative pl-8 pb-6 border-l-2 border-muted last:border-0">
                            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  {history.old_status && (
                                    <>
                                      <Badge variant="outline" className="capitalize">
                                        {history.old_status.replace(/_/g, ' ')}
                                      </Badge>
                                      <span className="text-muted-foreground">→</span>
                                    </>
                                  )}
                                  <Badge 
                                    variant={history.new_status === 'active' ? 'default' : 'secondary'}
                                    className="capitalize"
                                  >
                                    {history.new_status.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(history.changed_at), "MMMM d, yyyy 'at' h:mm a")}
                                </p>
                                {history.notes && (
                                  <p className="text-sm mt-2">{history.notes}</p>
                                )}
                              </div>
                              {index === 0 && (
                                <Badge variant="outline" className="text-xs">Current</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No status changes recorded yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Days on Market Summary */}
                {selectedListingData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Days on Market */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Current Period</CardTitle>
                        <CardDescription>
                          Days since listing last became active
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-6">
                          <div className="text-5xl font-bold text-primary mb-2">
                            {(() => {
                              // Find the most recent transition to active status
                              const sortedHistory = [...statusHistory].sort(
                                (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
                              );
                              const activeHistory = sortedHistory.find(h => h.new_status === 'active');
                              if (activeHistory) {
                                const activeDate = new Date(activeHistory.changed_at);
                                const today = new Date();
                                const diffTime = Math.abs(today.getTime() - activeDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return diffDays;
                              }
                              return 0;
                            })()}
                          </div>
                          <p className="text-muted-foreground">Days in Current Active Period</p>
                          {selectedListingData.status !== 'active' && (
                            <Badge variant="secondary" className="mt-2">Not Currently Active</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cumulative Active Days */}
                    <Card className="border-primary/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Cumulative Active Days
                        </CardTitle>
                        <CardDescription>
                          Total days active across all periods
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-6">
                          <div className="text-5xl font-bold text-primary mb-2">
                            {currentStats?.cumulative_active_days || calculateCumulativeActiveDays()}
                          </div>
                          <p className="text-muted-foreground">Total Active Days on Market</p>
                          {(() => {
                            const sortedHistory = [...statusHistory].sort(
                              (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
                            );
                            const activePeriods = sortedHistory.filter(h => h.new_status === 'active').length;
                            if (activePeriods > 1) {
                              return (
                                <Badge variant="outline" className="mt-2">
                                  {activePeriods} Active Periods
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {listings.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No listings found. Create your first listing to see analytics.</p>
              <Button className="mt-4" onClick={() => navigate("/add-listing")}>
                Add Listing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ListingAnalytics;
