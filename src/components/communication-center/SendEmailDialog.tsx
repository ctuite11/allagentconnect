import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Send, 
  Users, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  MapPin,
  Home,
  DollarSign,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const EMAIL_TEMPLATES = [
  { value: "new_listing", label: "New Listing Alert" },
  { value: "open_house", label: "Open House Announcement" },
  { value: "price_change", label: "Price Change" },
  { value: "status_change", label: "Status Change" },
  { value: "custom", label: "Custom Email" },
];

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi Family" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
];

export function SendEmailDialog({ open, onOpenChange, onSuccess }: SendEmailDialogProps) {
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  
  // Form state
  const [template, setTemplate] = useState("custom");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  
  // Geography state
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [showAreas, setShowAreas] = useState(true);
  const [townsOpen, setTownsOpen] = useState(false);
  const [counties, setCounties] = useState<Array<{ id: string; name: string; state: string }>>([]);
  
  // Price state
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // Property types
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  
  // Collapsible sections
  const [geoExpanded, setGeoExpanded] = useState(true);
  const [propertyExpanded, setPropertyExpanded] = useState(false);
  const [priceExpanded, setPriceExpanded] = useState(false);

  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: state,
    county: selectedCountyId,
    showAreas: showAreas,
  });

  // Load counties when state changes
  useEffect(() => {
    const loadCounties = async () => {
      if (!state) {
        setCounties([]);
        return;
      }
      
      try {
        const stateCode = state.length > 2 
          ? US_STATES.find(s => s.name === state)?.code 
          : state;
        
        if (stateCode && COUNTIES_BY_STATE[stateCode]) {
          const stateCounties = COUNTIES_BY_STATE[stateCode].map(name => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            state: stateCode
          }));
          setCounties(stateCounties);
        }
      } catch (error) {
        console.error("Error loading counties:", error);
      }
    };
    
    loadCounties();
    setSelectedCountyId("all");
    setSelectedCities([]);
  }, [state]);

  // Fetch recipient count when criteria changes
  useEffect(() => {
    if (open && state) {
      fetchRecipientCount();
    }
  }, [open, state, selectedCountyId, selectedCities, propertyTypes, minPrice, maxPrice]);

  const fetchRecipientCount = async () => {
    setLoadingCount(true);
    try {
      // For now, we'll estimate based on coverage areas
      // This would be replaced with actual matching logic
      const { count, error } = await supabase
        .from("agent_buyer_coverage_areas")
        .select("*", { count: "exact", head: true })
        .eq("state", state);
      
      if (!error) {
        setRecipientCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching count:", error);
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const handlePropertyTypeToggle = (type: string) => {
    setPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (!state) {
      toast.error("Please select a state");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Build criteria
      const cities: string[] = [];
      const neighborhoods: string[] = [];
      
      selectedCities.forEach(town => {
        if (town.includes('-')) {
          const [city, neighborhood] = town.split('-');
          if (!cities.includes(city)) cities.push(city);
          neighborhoods.push(neighborhood);
        } else {
          if (!cities.includes(town)) cities.push(town);
        }
      });

      const criteria = {
        state,
        counties: selectedCountyId !== "all" ? [selectedCountyId] : undefined,
        cities: cities.length > 0 ? cities : undefined,
        neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
      };

      const { data, error } = await supabase.functions.invoke(
        "send-client-need-notification",
        { 
          body: {
            category: "buyer_need",
            subject,
            message,
            criteria,
          }
        }
      );

      if (error) throw error;

      toast.success(`Email sent to ${data?.recipientCount || 0} recipients`);
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setTemplate("custom");
    setSubject("");
    setMessage("");
    setState("MA");
    setSelectedCountyId("all");
    setSelectedCities([]);
    setMinPrice("");
    setMaxPrice("");
    setPropertyTypes([]);
    setRecipientCount(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Send a targeted email to users whose preferences match your selected geography
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Recipient Count */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {loadingCount ? (
                  <span className="text-sm text-muted-foreground">Calculating recipients...</span>
                ) : recipientCount !== null ? (
                  <span className="text-sm">
                    This email will be sent to <strong className="text-foreground">{recipientCount}</strong> users
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Select criteria to see recipient count</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Geographic Selection - Required */}
          <Collapsible open={geoExpanded} onOpenChange={setGeoExpanded}>
            <Card className="border-l-4 border-l-teal-500">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-teal-500" />
                    <span className="font-medium">Geographic Area</span>
                    <span className="text-xs text-red-500">*Required</span>
                  </div>
                  {geoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4">
                  {/* State and County */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">County</Label>
                      <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="All counties" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Counties</SelectItem>
                          {counties.map((county) => (
                            <SelectItem key={county.id} value={county.id}>
                              {county.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Towns */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Towns</Label>
                      <Popover open={townsOpen} onOpenChange={setTownsOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                            {selectedCities.length > 0 
                              ? `${selectedCities.length} selected` 
                              : "Select towns..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Search towns..."
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              className="h-8"
                            />
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-2">
                              <TownsPicker
                                towns={townsList.filter(t => 
                                  !citySearch || t.toLowerCase().includes(citySearch.toLowerCase())
                                )}
                                selectedTowns={selectedCities}
                                onToggleTown={toggleCity}
                                expandedCities={expandedCities}
                                onToggleCityExpansion={toggleCityExpansion}
                                showAreas={showAreas}
                                state={state}
                              />
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Selected</Label>
                      <div className="min-h-[38px] p-2 border rounded-md bg-muted/30 text-sm">
                        {selectedCities.length > 0 
                          ? selectedCities.slice(0, 3).join(", ") + (selectedCities.length > 3 ? ` +${selectedCities.length - 3} more` : "")
                          : <span className="text-muted-foreground">No towns selected</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Property Types */}
          <Collapsible open={propertyExpanded} onOpenChange={setPropertyExpanded}>
            <Card className="border-l-4 border-l-indigo-500">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-indigo-500" />
                    <span className="font-medium">Property Types</span>
                    {propertyTypes.length > 0 && (
                      <span className="text-xs text-muted-foreground">({propertyTypes.length} selected)</span>
                    )}
                  </div>
                  {propertyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={type.value}
                          checked={propertyTypes.includes(type.value)}
                          onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                        />
                        <label htmlFor={type.value} className="text-sm cursor-pointer">
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Price Range */}
          <Collapsible open={priceExpanded} onOpenChange={setPriceExpanded}>
            <Card className="border-l-4 border-l-green-500">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Price Range</span>
                    {(minPrice || maxPrice) && (
                      <span className="text-xs text-muted-foreground">
                        ({minPrice ? `$${parseInt(minPrice).toLocaleString()}` : "Any"} - {maxPrice ? `$${parseInt(maxPrice).toLocaleString()}` : "Any"})
                      </span>
                    )}
                  </div>
                  {priceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Min Price</Label>
                      <Input
                        placeholder="No minimum"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Max Price</Label>
                      <Input
                        placeholder="No maximum"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              placeholder="Your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
          </div>

          {/* Reply Notice */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Replies will be delivered to your email inbox, not to DirectConnectMLS.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={sending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending || !subject.trim() || !message.trim() || !state}
              className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
