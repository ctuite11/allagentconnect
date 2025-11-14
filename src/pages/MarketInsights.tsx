import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Bed, Bath, Square, TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3 } from "lucide-react";
import { differenceInDays, format, subDays, subMonths } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface SoldListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  photos: any;
  property_type: string | null;
  created_at: string;
  active_date: string | null;
  updated_at: string;
  listing_stats?: {
    cumulative_active_days: number;
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444'];

const MarketInsights = () => {
  const navigate = useNavigate();
  const [soldListings, setSoldListings] = useState<SoldListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedPropertyType, setSelectedPropertyType] = useState("all");

  useEffect(() => {
    fetchSoldListings();
  }, [timeRange]);

  const fetchSoldListings = async () => {
    try {
      setLoading(true);
      const daysAgo = parseInt(timeRange);
      const startDate = subDays(new Date(), daysAgo);

      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          listing_stats (
            cumulative_active_days
          )
        `)
        .eq("status", "sold")
        .gte("updated_at", startDate.toISOString())
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSoldListings(data || []);
    } catch (error) {
      console.error("Error fetching sold listings:", error);
      toast.error("Failed to load market data");
    } finally {
      setLoading(false);
    }
  };

  // Filter listings based on selected filters
  const filteredListings = soldListings.filter(listing => {
    if (selectedCity !== "all" && listing.city !== selectedCity) return false;
    if (selectedPropertyType !== "all" && listing.property_type !== selectedPropertyType) return false;
    return true;
  });

  // Get unique cities and property types
  const cities = Array.from(new Set(soldListings.map(l => l.city))).sort();
  const propertyTypes = Array.from(new Set(soldListings.map(l => l.property_type).filter(Boolean))).sort();

  // Calculate statistics
  const totalSold = filteredListings.length;
  const averagePrice = filteredListings.length > 0
    ? filteredListings.reduce((sum, l) => sum + l.price, 0) / filteredListings.length
    : 0;

  const averageDaysOnMarket = filteredListings.length > 0
    ? filteredListings.reduce((sum, l) => {
        const days = l.listing_stats?.cumulative_active_days || 
          differenceInDays(new Date(l.updated_at), new Date(l.active_date || l.created_at));
        return sum + days;
      }, 0) / filteredListings.length
    : 0;

  // Price by area data
  const priceByArea = cities.map(city => {
    const cityListings = filteredListings.filter(l => l.city === city);
    const avgPrice = cityListings.length > 0
      ? cityListings.reduce((sum, l) => sum + l.price, 0) / cityListings.length
      : 0;
    return {
      name: city,
      averagePrice: Math.round(avgPrice),
      count: cityListings.length
    };
  }).sort((a, b) => b.averagePrice - a.averagePrice).slice(0, 10);

  // Price trends over time (weekly buckets)
  const priceTrends = (() => {
    const weeks: { [key: string]: { total: number; count: number } } = {};
    filteredListings.forEach(listing => {
      const weekStart = format(new Date(listing.updated_at), 'MMM dd');
      if (!weeks[weekStart]) {
        weeks[weekStart] = { total: 0, count: 0 };
      }
      weeks[weekStart].total += listing.price;
      weeks[weekStart].count += 1;
    });
    
    return Object.entries(weeks).map(([week, data]) => ({
      week,
      averagePrice: Math.round(data.total / data.count)
    })).slice(-8);
  })();

  // Days on market distribution
  const daysOnMarketDistribution = (() => {
    const buckets = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91-180": 0,
      "180+": 0
    };
    
    filteredListings.forEach(listing => {
      const days = listing.listing_stats?.cumulative_active_days || 
        differenceInDays(new Date(listing.updated_at), new Date(listing.active_date || listing.created_at));
      
      if (days <= 30) buckets["0-30"]++;
      else if (days <= 60) buckets["31-60"]++;
      else if (days <= 90) buckets["61-90"]++;
      else if (days <= 180) buckets["91-180"]++;
      else buckets["180+"]++;
    });
    
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: totalSold > 0 ? Math.round((count / totalSold) * 100) : 0
    }));
  })();

  // Property type distribution
  const propertyTypeDistribution = propertyTypes.map(type => {
    const count = filteredListings.filter(l => l.property_type === type).length;
    return {
      name: type || "Unknown",
      value: count,
      percentage: totalSold > 0 ? Math.round((count / totalSold) * 100) : 0
    };
  }).sort((a, b) => b.value - a.value);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getFirstPhoto = (photos: any) => {
    if (photos && Array.isArray(photos) && photos.length > 0) {
      return photos[0].url || photos[0];
    }
    return null;
  };

  const getDaysOnMarket = (listing: SoldListing) => {
    if (listing.listing_stats?.cumulative_active_days) {
      return listing.listing_stats.cumulative_active_days;
    }
    const startDate = new Date(listing.active_date || listing.created_at);
    const endDate = new Date(listing.updated_at);
    return differenceInDays(endDate, startDate);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-10 h-10 text-primary" />
              <div>
                <h1 className="text-4xl font-bold">Market Insights</h1>
                <p className="text-muted-foreground">
                  Real-time analytics and trends from recently sold properties
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mt-6">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="60">Last 60 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="180">Last 6 Months</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPropertyType} onValueChange={setSelectedPropertyType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Property Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Property Types</SelectItem>
                  {propertyTypes.map(type => (
                    <SelectItem key={type} value={type || ""}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading market data...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sold</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSold}</div>
                    <p className="text-xs text-muted-foreground">
                      Properties sold in timeframe
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Sale Price</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(averagePrice)}</div>
                    <p className="text-xs text-muted-foreground">
                      Mean closing price
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Days on Market</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(averageDaysOnMarket)}</div>
                    <p className="text-xs text-muted-foreground">
                      From listing to sale
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="trends" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="trends">Price Trends</TabsTrigger>
                  <TabsTrigger value="areas">By Area</TabsTrigger>
                  <TabsTrigger value="dom">Days on Market</TabsTrigger>
                  <TabsTrigger value="types">Property Types</TabsTrigger>
                  <TabsTrigger value="listings">Recent Sales</TabsTrigger>
                </TabsList>

                {/* Price Trends Tab */}
                <TabsContent value="trends">
                  <Card>
                    <CardHeader>
                      <CardTitle>Price Trends Over Time</CardTitle>
                      <CardDescription>Average sale prices by week</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={priceTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value: any) => formatPrice(value)} />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="averagePrice" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            name="Average Price"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* By Area Tab */}
                <TabsContent value="areas">
                  <Card>
                    <CardHeader>
                      <CardTitle>Average Sale Prices by Area</CardTitle>
                      <CardDescription>Top 10 cities by average sale price</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={priceByArea}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip 
                            formatter={(value: any, name: string) => {
                              if (name === "averagePrice") return formatPrice(value);
                              return value;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="averagePrice" fill="hsl(var(--primary))" name="Average Price" />
                          <Bar dataKey="count" fill="hsl(var(--secondary))" name="# Sold" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Days on Market Tab */}
                <TabsContent value="dom">
                  <Card>
                    <CardHeader>
                      <CardTitle>Days on Market Distribution</CardTitle>
                      <CardDescription>How long properties stayed on the market before selling</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={daysOnMarketDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" fill="hsl(var(--primary))" name="Properties" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {daysOnMarketDistribution.map((bucket, idx) => (
                          <div key={bucket.range} className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{bucket.percentage}%</div>
                            <div className="text-sm text-muted-foreground">{bucket.range} days</div>
                            <div className="text-xs text-muted-foreground">({bucket.count} properties)</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Property Types Tab */}
                <TabsContent value="types">
                  <Card>
                    <CardHeader>
                      <CardTitle>Property Type Distribution</CardTitle>
                      <CardDescription>Sales breakdown by property type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={propertyTypeDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name}: ${percentage}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {propertyTypeDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-3">
                          {propertyTypeDistribution.map((type, idx) => (
                            <div key={type.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-4 h-4 rounded" 
                                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                />
                                <span className="font-medium">{type.name}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">{type.value}</div>
                                <div className="text-xs text-muted-foreground">{type.percentage}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Recent Sales Tab */}
                <TabsContent value="listings">
                  <div className="space-y-4">
                    {filteredListings.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">No sold properties found for the selected filters.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredListings.slice(0, 12).map((listing) => {
                          const photoUrl = getFirstPhoto(listing.photos);
                          const daysOnMarket = getDaysOnMarket(listing);

                          return (
                            <Card
                              key={listing.id}
                              className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
                              onClick={() => navigate(`/property/${listing.id}`)}
                            >
                              <div className="relative aspect-[4/3]">
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={listing.address}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <Square className="w-12 h-12 text-muted-foreground" />
                                  </div>
                                )}
                                <Badge className="absolute top-4 right-4 bg-green-600 text-white border-0">
                                  SOLD
                                </Badge>
                              </div>

                              <CardContent className="p-6">
                                <div className="mb-3">
                                  <div className="text-2xl font-bold text-primary mb-1">
                                    {formatPrice(listing.price)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>{daysOnMarket} days on market</span>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2 mb-4">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="text-sm">
                                    <div className="font-medium">{listing.address}</div>
                                    <div className="text-muted-foreground">
                                      {listing.city}, {listing.state} {listing.zip_code}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {listing.bedrooms && (
                                    <div className="flex items-center gap-1">
                                      <Bed className="w-4 h-4" />
                                      <span>{listing.bedrooms}</span>
                                    </div>
                                  )}
                                  {listing.bathrooms && (
                                    <div className="flex items-center gap-1">
                                      <Bath className="w-4 h-4" />
                                      <span>{listing.bathrooms}</span>
                                    </div>
                                  )}
                                  {listing.square_feet && (
                                    <div className="flex items-center gap-1">
                                      <Square className="w-4 h-4" />
                                      <span>{listing.square_feet.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>

                                {listing.property_type && (
                                  <div className="mt-3 pt-3 border-t">
                                    <Badge variant="outline" className="text-xs">
                                      {listing.property_type}
                                    </Badge>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default MarketInsights;
