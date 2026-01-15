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
import { Switch } from "@/components/ui/switch";

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
  
  // Send copy to self
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);
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
            sendCopyToSelf,
          }
        }
      );

      if (error) throw error;

      const copyMsg = sendCopyToSelf ? " (copy sent to you)" : "";
      toast.success(`Email sent to ${data?.sent || data?.recipientCount || 0} recipients${copyMsg}`);
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
    setSendCopyToSelf(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Send Email</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send a targeted email to users whose preferences match your selected geography
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          {/* Recipient Count */}
          <div className="bg-secondary/50 border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              {loadingCount ? (
                <span className="text-sm text-muted-foreground">Calculating recipients...</span>
              ) : recipientCount !== null ? (
                <span className="text-sm">
                  This email will be sent to <strong className="text-foreground font-semibold">{recipientCount}</strong> users
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Select criteria to see recipient count</span>
              )}
            </div>
          </div>

          {/* Geographic Selection - Required */}
          <Collapsible open={geoExpanded} onOpenChange={setGeoExpanded}>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className="flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="font-medium text-foreground">Geographic Area</span>
                    <span className="text-xs font-medium text-destructive">*Required</span>
                  </div>
                  <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                    {geoExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-5 pt-2 space-y-4 border-t border-border bg-secondary/20">
                  {/* State and County */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="h-10 rounded-lg border-neutral-200 bg-white">
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
                      <Label className="text-sm font-medium text-foreground">County</Label>
                      <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                        <SelectTrigger className="h-10 rounded-lg border-neutral-200 bg-white">
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
                      <Label className="text-sm font-medium text-foreground">Towns</Label>
                      <Popover open={townsOpen} onOpenChange={setTownsOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal h-10 rounded-lg border-neutral-200 bg-white hover:bg-neutral-soft">
                            {selectedCities.length > 0 
                              ? `${selectedCities.length} selected` 
                              : "Select towns..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0 rounded-xl border-border shadow-lg" align="start">
                          <div className="p-3 border-b border-border bg-secondary/30">
                            <Input
                              placeholder="Search towns..."
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              className="h-9 rounded-lg border-neutral-200 bg-white"
                            />
                          </div>
                          <ScrollArea className="h-[220px]">
                            <div className="p-2 bg-background">
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
                      <Label className="text-sm font-medium text-foreground">Selected</Label>
                      <div className="min-h-[40px] p-3 border border-border rounded-lg bg-secondary/30 text-sm">
                        {selectedCities.length > 0 
                          ? selectedCities.slice(0, 3).join(", ") + (selectedCities.length > 3 ? ` +${selectedCities.length - 3} more` : "")
                          : <span className="text-muted-foreground">No towns selected</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Property Types */}
          <Collapsible open={propertyExpanded} onOpenChange={setPropertyExpanded}>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className="flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Home className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Property Types</span>
                    {propertyTypes.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">
                        {propertyTypes.length} selected
                      </span>
                    )}
                  </div>
                  <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                    {propertyExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-5 pt-2 border-t border-border bg-secondary/20">
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2.5">
                        <Checkbox
                          id={type.value}
                          checked={propertyTypes.includes(type.value)}
                          onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                          className="rounded-[4px] border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <label htmlFor={type.value} className="text-sm cursor-pointer text-foreground">
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Price Range */}
          <Collapsible open={priceExpanded} onOpenChange={setPriceExpanded}>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className="flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium text-foreground">Price Range</span>
                    {(minPrice || maxPrice) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
                        {minPrice ? `$${parseInt(minPrice).toLocaleString()}` : "Any"} - {maxPrice ? `$${parseInt(maxPrice).toLocaleString()}` : "Any"}
                      </span>
                    )}
                  </div>
                  <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                    {priceExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-5 pt-2 border-t border-border bg-secondary/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Min Price</Label>
                      <Input
                        placeholder="No minimum"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))}
                        className="h-10 rounded-lg border-neutral-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Max Price</Label>
                      <Input
                        placeholder="No maximum"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))}
                        className="h-10 rounded-lg border-neutral-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Template Selection */}
          <div className="space-y-2.5">
            <Label className="text-sm font-medium text-foreground">Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="h-10 rounded-lg border-neutral-200 bg-white">
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
          <div className="space-y-2.5">
            <Label className="text-sm font-medium text-foreground">Subject *</Label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="h-10 rounded-lg border-neutral-200 bg-white"
            />
          </div>

          {/* Message */}
          <div className="space-y-2.5">
            <Label className="text-sm font-medium text-foreground">Message *</Label>
            <Textarea
              placeholder="Your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
              className="rounded-lg border-neutral-200 bg-white resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
          </div>

          {/* Reply Notice */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Replies will be delivered to your email inbox, not to DirectConnectMLS.
            </p>
          </div>

          {/* Send Copy to Self Option */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Send a copy to myself</Label>
              <p className="text-xs text-muted-foreground">
                Receive a copy of this email at your registered email address
              </p>
            </div>
            <Switch
              checked={sendCopyToSelf}
              onCheckedChange={setSendCopyToSelf}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="brandOutline" onClick={handleClose} disabled={sending} className="rounded-lg">
              Cancel
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending || !subject.trim() || !message.trim() || !state}
              className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white rounded-lg"
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
