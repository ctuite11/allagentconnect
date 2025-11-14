import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarIcon, Mail } from "lucide-react";
import { toast } from "sonner";
import { US_STATES } from "@/data/usStatesCountiesData";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ContactMatchesDialog } from "@/components/ContactMatchesDialog";

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

const ListingIntel = () => {
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
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchClientNeeds();
    }
  }, [user, stateFilter, cityFilter, propertyTypeFilter, minPriceFilter, maxPriceFilter, startDate, endDate]);

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
          <h1 className="text-3xl font-bold mb-2">Listing Intel</h1>
          <p className="text-muted-foreground">
            Filter and find potential buyers for your listings
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-l-4 border-l-primary">
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

        {/* Results - Prominent Count */}
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 border-l-4 border-l-primary">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Potential Buyer Pool</h3>
                <p className="text-sm text-muted-foreground">
                  Active client needs matching your filters
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-5xl font-bold text-primary">
                    {clientNeeds.length}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {clientNeeds.length === 1 ? 'buyer' : 'buyers'}
                  </p>
                </div>
                {clientNeeds.length > 0 && (
                  <Button 
                    onClick={() => setContactDialogOpen(true)}
                    size="lg"
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Contact All Matches
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <ContactMatchesDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          matchCount={clientNeeds.length}
          filters={{
            stateFilter,
            cityFilter,
            propertyTypeFilter,
            minPriceFilter,
            maxPriceFilter,
            startDate,
            endDate,
          }}
        />
      </div>
    </div>
  );
};

export default ListingIntel;
