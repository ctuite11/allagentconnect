import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, DollarSign, Home, Calendar, User, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { US_STATES } from "@/data/usStatesCountiesData";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface ClientNeed {
  id: string;
  property_type: string;
  city: string;
  state: string;
  max_price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  created_at: string;
  submitted_by: string;
}

const ClientNeedsDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clientNeeds, setClientNeeds] = useState<ClientNeed[]>([]);
  
  // Filters
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchClientNeeds();
    }
  }, [user, stateFilter, cityFilter, propertyTypeFilter, minPriceFilter, maxPriceFilter, startDate, endDate]);

  useEffect(() => {
    if (!user) return;

    // Set up real-time subscription for new client needs
    const channel = supabase
      .channel('client-needs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_needs'
        },
        (payload) => {
          console.log('New client need received:', payload);
          setClientNeeds(prev => [payload.new as ClientNeed, ...prev]);
          toast.success("New client need submitted!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchClientNeeds = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("client_needs")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters
      if (stateFilter) {
        query = query.eq("state", stateFilter);
      }
      if (cityFilter) {
        query = query.ilike("city", `%${cityFilter}%`);
      }
      if (propertyTypeFilter && propertyTypeFilter.trim()) {
        query = query.eq("property_type", propertyTypeFilter as any);
      }
      if (minPriceFilter) {
        query = query.gte("max_price", parseFloat(minPriceFilter));
      }
      if (maxPriceFilter) {
        query = query.lte("max_price", parseFloat(maxPriceFilter));
      }
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        // Set end of day for endDate
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setClientNeeds(data || []);
    } catch (error: any) {
      console.error("Error fetching client needs:", error);
      toast.error("Failed to load client needs");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setStateFilter("");
    setCityFilter("");
    setPropertyTypeFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const formatPropertyType = (type: string) => {
    const typeMap: Record<string, string> = {
      single_family: "Single Family",
      condo: "Condo",
      townhouse: "Townhouse",
      multi_family: "Multi-Family",
      land: "Land",
      commercial: "Commercial",
      residential_rental: "Residential Rental",
      commercial_rental: "Commercial Rental",
    };
    return typeMap[type] || type;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Client Needs Dashboard</h1>
          <p className="text-muted-foreground">
            View and filter submitted client real estate needs
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter client needs by location, property type, and price</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="state">State</Label>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent className="z-50 max-h-[300px]">
                    <SelectItem value=" ">All States</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Search city..."
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="propertyType">Property Type</Label>
                <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value=" ">All Types</SelectItem>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="residential_rental">Residential Rental</SelectItem>
                    <SelectItem value="commercial_rental">Commercial Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="minPrice">Min Price</Label>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="Min"
                  value={minPriceFilter}
                  onChange={(e) => setMinPriceFilter(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="maxPrice">Max Price</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="Max"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={fetchClientNeeds}>Apply Filters</Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {clientNeeds.length} {clientNeeds.length === 1 ? 'client need' : 'client needs'} found
          </p>
        </div>

        {clientNeeds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No client needs found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clientNeeds.map((need) => (
              <Card key={need.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-sm">
                          {formatPropertyType(need.property_type)}
                        </Badge>
                        {need.bedrooms && (
                          <Badge variant="outline" className="text-xs">
                            <Home className="w-3 h-3 mr-1" />
                            {need.bedrooms} bed
                          </Badge>
                        )}
                        {need.bathrooms && (
                          <Badge variant="outline" className="text-xs">
                            {need.bathrooms} bath
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{need.city}, {need.state}</span>
                      </div>

                      <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                        <DollarSign className="w-5 h-5" />
                        <span>Max Budget: {formatPrice(need.max_price)}</span>
                      </div>

                      {need.description && (
                        <div className="text-sm text-muted-foreground">
                          <p className="line-clamp-2">{need.description}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Submitted {format(new Date(need.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientNeedsDashboard;
