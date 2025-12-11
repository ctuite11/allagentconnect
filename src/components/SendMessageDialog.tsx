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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Send, Users, ArrowLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
  categoryTitle: string;
  defaultSubject?: string;
}

export const SendMessageDialog = ({ open, onOpenChange, category, categoryTitle, defaultSubject }: SendMessageDialogProps) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Geographic selection state - EXACTLY like SubmitClientNeed
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [showAreas, setShowAreas] = useState<boolean>(true);
  const [townsOpen, setTownsOpen] = useState(false);
  const [propertyTypesOpen, setPropertyTypesOpen] = useState(false);
  const [priceRangeOpen, setPriceRangeOpen] = useState(false);
  const [counties, setCounties] = useState<Array<{ id: string; name: string; state: string }>>([]);
  
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPriceDisplay, setMinPriceDisplay] = useState("");
  const [maxPriceDisplay, setMaxPriceDisplay] = useState("");
  const [noMinPrice, setNoMinPrice] = useState(false);
  const [noMaxPrice, setNoMaxPrice] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);

  // Use the EXACT same hook pattern as SubmitClientNeed
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state: state,
    county: selectedCountyId,
    showAreas: showAreas,
  });

  // Get full state name for display
  const getStateName = (code: string) => {
    return US_STATES.find(s => s.code === code)?.name || code;
  };

  // Set default subject when dialog opens
  useEffect(() => {
    if (open && defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [open, defaultSubject]);

  // Load counties for selected state - EXACTLY like SubmitClientNeed
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
        } else {
          const { data, error } = await supabase
            .from("counties")
            .select("*")
            .eq("state", stateCode || state)
            .order("name");
          
          if (!error && data) {
            setCounties(data);
          }
        }
      } catch (error) {
        console.error("Error loading counties:", error);
      }
    };
    
    loadCounties();
    setSelectedCountyId("all");
    setSelectedCities([]);
  }, [state]);

  const showLocationFields = true;

  // Toggle city - EXACTLY like SubmitClientNeed
  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  // Select all towns - EXACTLY like SubmitClientNeed
  const selectAllTowns = () => {
    const allSelections = [...townsList];
    
    if (showAreas) {
      const stateKey = state && state.length > 2 
        ? (US_STATES.find(s => s.name.toLowerCase() === state.toLowerCase())?.code ?? state)
        : state?.toUpperCase();

      townsList.forEach(town => {
        if (town.includes('-')) return;
        
        const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
        let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
        
        if ((neighborhoods?.length ?? 0) === 0) {
          neighborhoods = Array.from(new Set(
            townsList
              .filter((t) => t.startsWith(`${town}-`))
              .map((t) => t.split('-').slice(1).join('-'))
          ));
        }
        
        if (neighborhoods && neighborhoods.length > 0) {
          neighborhoods.forEach((n: string) => {
            const fullEntry = `${town}-${n}`;
            if (!allSelections.includes(fullEntry)) {
              allSelections.push(fullEntry);
            }
          });
        }
      });
    }
    
    setSelectedCities(allSelections);
  };

  const handlePropertyTypeToggle = (type: string) => {
    setPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Property type options - includes "apartment" for renter_need only
  const getPropertyTypeOptions = () => {
    const baseTypes = [
      { value: "single_family", label: "Single Family" },
      { value: "condo", label: "Condo" },
      { value: "townhouse", label: "Townhouse" },
      { value: "multi_family", label: "Multi Family" },
      { value: "land", label: "Land" },
      { value: "commercial", label: "Commercial" },
    ];
    
    if (category === "renter_need") {
      // Insert "apartment" at the beginning for rental flows
      return [
        { value: "apartment", label: "Apartment" },
        ...baseTypes,
      ];
    }
    
    return baseTypes;
  };

  const propertyTypeOptions = getPropertyTypeOptions();

  const selectAllPropertyTypes = () => {
    if (propertyTypes.length === propertyTypeOptions.length) {
      setPropertyTypes([]);
    } else {
      setPropertyTypes(propertyTypeOptions.map(t => t.value));
    }
  };

  const handleMinPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');
    setMinPrice(sanitized);
    const formatted = sanitized ? sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
    setMinPriceDisplay(formatted);
    if (sanitized) setNoMinPrice(false);
  };

  const handleMaxPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');
    setMaxPrice(sanitized);
    const formatted = sanitized ? sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
    setMaxPriceDisplay(formatted);
    if (sanitized) setNoMaxPrice(false);
  };

  // Fetch recipient count when criteria changes
  useEffect(() => {
    if (open && showLocationFields) {
      fetchRecipientCount();
    }
  }, [open, state, selectedCountyId, selectedCities, propertyTypes, minPrice, maxPrice, noMinPrice, noMaxPrice]);

  const fetchRecipientCount = async () => {
    if (!state) {
      setRecipientCount(null);
      return;
    }

    setLoadingCount(true);
    try {
      const requestBody: any = {
        category,
        subject,
        message,
        previewOnly: true,
      };

      if (showLocationFields) {
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

        requestBody.criteria = {
          state: state || undefined,
          counties: selectedCountyId && selectedCountyId !== "all" ? [selectedCountyId] : undefined,
          cities: cities.length > 0 ? cities : undefined,
          neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
          minPrice: !noMinPrice && minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: !noMaxPrice && maxPrice ? parseFloat(maxPrice) : undefined,
          propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
        };
      }

      console.log("Fetching recipient count with criteria:", JSON.stringify(requestBody, null, 2));
      
      const { data, error } = await supabase.functions.invoke(
        "send-client-need-notification",
        { body: requestBody }
      );

      if (error) throw error;
      setRecipientCount(data?.recipientCount ?? 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  const handleSend = async () => {
    if (!showConfirmation) {
      if (!subject.trim()) {
        toast.error("Please enter a subject");
        return;
      }
      if (!message.trim()) {
        toast.error("Please enter a message");
        return;
      }
      if (showLocationFields && !state) {
        toast.error("Please select a state");
        return;
      }

      setShowConfirmation(true);
      return;
    }

    setSending(true);
    try {
      const requestBody: any = {
        category,
        subject,
        message,
      };

      if (showLocationFields) {
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

        requestBody.criteria = {
          state: state || undefined,
          counties: selectedCountyId && selectedCountyId !== "all" ? [selectedCountyId] : undefined,
          cities: cities.length > 0 ? cities : undefined,
          neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
          minPrice: !noMinPrice && minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: !noMaxPrice && maxPrice ? parseFloat(maxPrice) : undefined,
          propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
        };
      }

      const { data, error } = await supabase.functions.invoke(
        "send-client-need-notification",
        { body: requestBody }
      );

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "Message sent successfully!");
        handleClose();
      } else {
        throw new Error(data.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setState("MA");
    setSelectedCountyId("all");
    setSelectedCities([]);
    setCitySearch("");
    setShowAreas(true);
    setTownsOpen(false);
    setMinPrice("");
    setMaxPrice("");
    setMinPriceDisplay("");
    setMaxPriceDisplay("");
    setNoMinPrice(false);
    setNoMaxPrice(false);
    setPropertyTypes([]);
    setRecipientCount(null);
    setShowConfirmation(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {showConfirmation ? "Confirm & Send" : `Send ${categoryTitle}`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {showConfirmation
                ? "Review your message before sending"
                : "Compose and send a message to matching agents"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {showConfirmation ? (
          <div className="space-y-5 p-6">
            <div className="space-y-4 p-4 bg-secondary/30 rounded-xl border border-border">
              <div>
                <Label className="text-sm font-semibold text-foreground">Subject</Label>
                <p className="mt-1 text-sm">{subject}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground">Message</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{message}</p>
              </div>
              {state && (
                <div>
                  <Label className="text-sm font-semibold text-foreground">Criteria</Label>
                  <div className="mt-1 text-sm space-y-1">
                    <p><strong>State:</strong> {getStateName(state)}</p>
                  {selectedCountyId && selectedCountyId !== "all" && (
                    <p><strong>County:</strong> {selectedCountyId}</p>
                  )}
                  {selectedCities.length > 0 && (
                    <p><strong>Towns/Cities:</strong> {selectedCities.length} selected</p>
                  )}
                    {propertyTypes.length > 0 && (
                      <p><strong>Property Types:</strong> {propertyTypes.map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(", ")}</p>
                    )}
                    {minPrice && !noMinPrice && (
                      <p><strong>Min Price:</strong> ${parseFloat(minPrice).toLocaleString()}</p>
                    )}
                    {maxPrice && !noMaxPrice && (
                      <p><strong>Max Price:</strong> ${parseFloat(maxPrice).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!loadingCount && recipientCount !== null && (
              <div className="bg-secondary/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">
                    This will be sent to <strong className="text-primary font-semibold">{recipientCount}</strong> {recipientCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={sending}
                className="rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Edit
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={sending}
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
                    Confirm & Send
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            {/* Recipient Count */}
            <div className="bg-secondary/50 border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                {loadingCount ? (
                  <span className="text-sm text-muted-foreground">
                    Calculating recipients...
                  </span>
                ) : recipientCount !== null ? (
                  <span className="text-sm">
                    Sending to <strong className="text-primary font-semibold">{recipientCount}</strong> {recipientCount === 1 ? "agent" : "agents"}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Select criteria to see recipient count
                  </span>
                )}
              </div>
            </div>

            {showLocationFields && (
              <div className="space-y-4">
                {/* State and County - Always visible */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 bg-background border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                        <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="font-medium text-foreground">Location</span>
                      <span className="text-xs font-medium text-destructive">*Required</span>
                    </div>
                  </div>
                  <div className="p-4 bg-secondary/20">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">State</Label>
                        <Select value={state} onValueChange={(val) => setState(val)}>
                          <SelectTrigger className="h-10 rounded-lg border-border bg-background">
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
                        <Select value={selectedCountyId} onValueChange={(val) => setSelectedCountyId(val)}>
                          <SelectTrigger className="h-10 rounded-lg border-border bg-background">
                            <SelectValue placeholder="All Counties" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Counties</SelectItem>
                            {counties.map((county) => (
                              <SelectItem key={county.id} value={county.name}>
                                {county.name} County
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Towns & Neighborhoods Section */}
                <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                      <div className={`flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors ${townsOpen ? 'border-l-2 border-l-teal-500' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                            <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <span className="font-medium text-foreground">Towns & Neighborhoods</span>
                          {selectedCities.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 font-medium">
                              {selectedCities.length} selected
                            </span>
                          )}
                        </div>
                        <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                          {townsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 pt-2 border-t border-border bg-secondary/20 space-y-4">
                        {/* Show Areas Yes/No */}
                        <div className="flex items-center gap-4">
                          <Label className="text-sm font-medium text-foreground">Show Areas</Label>
                          <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="show-yes"
                                name="show-areas"
                                checked={showAreas === true}
                                onChange={() => setShowAreas(true)}
                                className="w-4 h-4 accent-teal-600"
                              />
                              <Label htmlFor="show-yes" className="text-sm cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="show-no"
                                name="show-areas"
                                checked={showAreas === false}
                                onChange={() => setShowAreas(false)}
                                className="w-4 h-4 accent-teal-600"
                              />
                              <Label htmlFor="show-no" className="text-sm cursor-pointer">No</Label>
                            </div>
                          </div>
                        </div>

                        {/* Two-column: Towns picker + Selected towns */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Input
                              placeholder="Type Full or Partial Name"
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              className="h-10 rounded-lg border-border bg-background text-sm"
                            />
                            <div className="border border-border rounded-lg bg-secondary/30 max-h-60 overflow-y-auto p-2 relative z-10">
                              {selectedCountyId && townsList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={selectAllTowns}
                                  className="w-full text-left px-3 py-2 text-sm font-semibold hover:bg-muted rounded-lg mb-1 border-b border-border pb-2 flex items-center gap-2"
                                >
                                  <span className="text-teal-600">✓</span>
                                  {selectedCountyId === "all" 
                                    ? `Add All Towns from All Counties` 
                                    : `Add All Towns in County (${townsList.length})`}
                                </button>
                              )}
                              <TownsPicker
                                towns={townsList}
                                selectedTowns={selectedCities}
                                onToggleTown={toggleCity}
                                expandedCities={expandedCities}
                                onToggleCityExpansion={toggleCityExpansion}
                                state={state}
                                searchQuery={citySearch}
                                variant="button"
                                showAreas={showAreas}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">Selected Towns</Label>
                            <div className="border border-border rounded-lg p-3 bg-secondary/30 min-h-[200px] max-h-60 overflow-y-auto">
                              {selectedCities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No towns selected</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {selectedCities.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCities([])}
                                      className="text-xs text-destructive hover:underline mb-2 font-medium"
                                    >
                                      Remove All
                                    </button>
                                  )}
                                  {selectedCities.map((city) => (
                                    <div 
                                      key={city}
                                      className="flex items-center justify-between text-sm py-1.5 px-3 bg-background border border-border rounded-lg"
                                    >
                                      <span>{city.includes('-') ? city.replace('-', ' - ') : city}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleCity(city)}
                                        className="text-muted-foreground hover:text-destructive text-lg leading-none"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Property Types - HIDDEN for general_discussion */}
                {category !== "general_discussion" && (
                  <Collapsible open={propertyTypesOpen} onOpenChange={setPropertyTypesOpen}>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                        <div className={`flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors ${propertyTypesOpen ? 'border-l-2 border-l-indigo-500' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                              <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <span className="font-medium text-foreground">Property Types</span>
                            {propertyTypes.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                                {propertyTypes.length} selected
                              </span>
                            )}
                          </div>
                          <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                            {propertyTypesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 pt-2 border-t border-border bg-secondary/20">
                          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                            <div className="flex items-center space-x-2.5">
                              <Checkbox
                                id="select-all-property-types"
                                checked={propertyTypes.length === propertyTypeOptions.length}
                                onCheckedChange={selectAllPropertyTypes}
                                className="rounded-[4px] border-border data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                              />
                              <Label
                                htmlFor="select-all-property-types"
                                className="font-semibold cursor-pointer text-sm"
                              >
                                Select All
                              </Label>
                            </div>
                            
                            {propertyTypeOptions.map((type) => (
                              <div key={type.value} className="flex items-center space-x-2.5">
                                <Checkbox
                                  id={`type-${type.value}`}
                                  checked={propertyTypes.includes(type.value)}
                                  onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                                  className="rounded-[4px] border-border data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                />
                                <label
                                  htmlFor={`type-${type.value}`}
                                  className="text-sm cursor-pointer text-foreground"
                                >
                                  {type.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Price Range - HIDDEN for general_discussion */}
                {category !== "general_discussion" && (
                  <Collapsible open={priceRangeOpen} onOpenChange={setPriceRangeOpen}>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                        <div className={`flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/50 transition-colors ${priceRangeOpen ? 'border-l-2 border-l-green-500' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <span className="font-medium text-foreground">Price Range</span>
                            {(minPrice || maxPrice) && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
                                ${minPriceDisplay || '0'} - ${maxPriceDisplay || '∞'}
                              </span>
                            )}
                          </div>
                          <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center">
                            {priceRangeOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 pt-2 border-t border-border bg-secondary/20">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="minPrice" className="text-sm font-medium text-foreground">
                                Minimum Price
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  id="minPrice"
                                  type="text"
                                  inputMode="numeric"
                                  value={minPriceDisplay}
                                  onChange={(e) => handleMinPriceChange(e.target.value)}
                                  placeholder={category === "renter_need" ? "1,000" : "500,000"}
                                  className="pl-7 h-10 rounded-lg border-border bg-background"
                                  disabled={noMinPrice}
                                />
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <Checkbox
                                  id="noMinPrice"
                                  checked={noMinPrice}
                                  onCheckedChange={(checked) => {
                                    setNoMinPrice(checked as boolean);
                                    if (checked) {
                                      setMinPrice("");
                                      setMinPriceDisplay("");
                                    }
                                  }}
                                  className="rounded-[4px] border-border"
                                />
                                <label htmlFor="noMinPrice" className="text-xs text-muted-foreground cursor-pointer">
                                  No minimum
                                </label>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="maxPrice" className="text-sm font-medium text-foreground">
                                Maximum Price
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  id="maxPrice"
                                  type="text"
                                  inputMode="numeric"
                                  value={maxPriceDisplay}
                                  onChange={(e) => handleMaxPriceChange(e.target.value)}
                                  placeholder={category === "renter_need" ? "5,000" : "2,000,000"}
                                  className="pl-7 h-10 rounded-lg border-border bg-background"
                                  disabled={noMaxPrice}
                                />
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <Checkbox
                                  id="noMaxPrice"
                                  checked={noMaxPrice}
                                  onCheckedChange={(checked) => {
                                    setNoMaxPrice(checked as boolean);
                                    if (checked) {
                                      setMaxPrice("");
                                      setMaxPriceDisplay("");
                                    }
                                  }}
                                  className="rounded-[4px] border-border"
                                />
                                <label htmlFor="noMaxPrice" className="text-xs text-muted-foreground cursor-pointer">
                                  No maximum
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </div>
            )}

            {/* Subject & Message */}
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label htmlFor="subject" className="text-sm font-medium text-foreground">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject line"
                  className="h-10 rounded-lg border-border bg-background"
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="message" className="text-sm font-medium text-foreground">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  className="min-h-[150px] rounded-lg border-border bg-background resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSend}
                className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white rounded-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                Preview & Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
