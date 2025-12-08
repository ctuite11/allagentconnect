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

  const selectAllPropertyTypes = () => {
    if (propertyTypes.length === 6) {
      setPropertyTypes([]);
    } else {
      setPropertyTypes([
        "single_family",
        "condo",
        "townhouse",
        "multi_family",
        "land",
        "commercial",
      ]);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showConfirmation ? "Confirm & Send" : `Send ${categoryTitle}`}
          </DialogTitle>
          <DialogDescription>
            {showConfirmation
              ? "Review your message before sending"
              : "Compose and send a message to matching agents"}
          </DialogDescription>
        </DialogHeader>

        {showConfirmation ? (
          <div className="space-y-6">
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm font-semibold">Subject</Label>
                <p className="mt-1 text-sm">{subject}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Message</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{message}</p>
              </div>
              {state && (
                <div>
                  <Label className="text-sm font-semibold">Criteria</Label>
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
              <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  This will be sent to <strong className="text-foreground">{recipientCount}</strong> {recipientCount === 1 ? "agent" : "agents"}
                </span>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={sending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Edit
              </Button>
              <Button onClick={handleSend} disabled={sending}>
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
          <>
            <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg mb-6">
              <Users className="h-4 w-4 text-muted-foreground" />
              {loadingCount ? (
                <span className="text-sm text-muted-foreground">
                  Calculating recipients...
                </span>
              ) : recipientCount !== null ? (
                <span className="text-sm">
                  Sending to <strong className="text-foreground">{recipientCount}</strong> {recipientCount === 1 ? "agent" : "agents"}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Select criteria to see recipient count
                </span>
              )}
            </div>

            <div className="space-y-6">
              {showLocationFields && (
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="text-sm font-medium">Location & Criteria</h3>

                  {/* Location Section - State and County ALWAYS visible */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">State</Label>
                        <Select value={state} onValueChange={(val) => setState(val)}>
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
                        <Select value={selectedCountyId} onValueChange={(val) => setSelectedCountyId(val)}>
                          <SelectTrigger>
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

                    {/* Towns & Neighborhoods Section - Collapsible, CLOSED by default */}
                    <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-3 rounded-md border">
                          <Label className="text-sm font-semibold uppercase cursor-pointer">
                            Towns & Neighborhoods
                            {selectedCities.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-green-600">
                                ({selectedCities.length} selected)
                              </span>
                            )}
                          </Label>
                          {townsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-4 pt-4">
                          {/* Show Areas Yes/No */}
                          <div className="flex items-center gap-4">
                            <Label className="text-sm">Show Areas</Label>
                            <div className="flex gap-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="show-yes"
                                  name="show-areas"
                                  checked={showAreas === true}
                                  onChange={() => setShowAreas(true)}
                                  className="w-4 h-4"
                                />
                                <Label htmlFor="show-yes" className="text-sm">Yes</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="show-no"
                                  name="show-areas"
                                  checked={showAreas === false}
                                  onChange={() => setShowAreas(false)}
                                  className="w-4 h-4"
                                />
                                <Label htmlFor="show-no" className="text-sm">No</Label>
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
                                className="text-sm"
                              />
                              <div className="border rounded-md bg-background max-h-60 overflow-y-auto p-2 relative z-10">
                                {selectedCountyId && townsList.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={selectAllTowns}
                                    className="w-full text-left px-2 py-1.5 text-sm font-semibold hover:bg-muted rounded mb-1 border-b pb-2"
                                  >
                                    {selectedCountyId === "all" 
                                      ? `✓ Add All Towns from All Counties` 
                                      : `✓ Add All Towns in County (${townsList.length})`}
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
                              <Label className="text-sm">Selected Towns</Label>
                              <div className="border rounded-md p-3 bg-background min-h-[200px] max-h-60 overflow-y-auto">
                                {selectedCities.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No towns selected</p>
                                ) : (
                                  <div className="space-y-1">
                                    {selectedCities.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedCities([])}
                                        className="text-xs text-destructive hover:underline mb-2"
                                      >
                                        Remove All
                                      </button>
                                    )}
                                    {selectedCities.map((city) => (
                                      <div 
                                        key={city}
                                        className="flex items-center justify-between text-sm py-1 px-2 bg-muted rounded"
                                      >
                                        <span>{city.includes('-') ? city.replace('-', ' - ') : city}</span>
                                        <button
                                          type="button"
                                          onClick={() => toggleCity(city)}
                                          className="text-muted-foreground hover:text-destructive text-xs"
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
                    </Collapsible>
                  </div>

                  {/* Property Types - Collapsible, CLOSED by default, HIDDEN for general_discussion */}
                  {category !== "general_discussion" && (
                    <Collapsible>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-3 rounded-md border">
                          <Label className="text-sm font-semibold uppercase cursor-pointer">
                            Property Types
                            {propertyTypes.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-green-600">
                                ({propertyTypes.length} selected)
                              </span>
                            )}
                          </Label>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 pt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="select-all-property-types"
                                checked={propertyTypes.length === 6}
                                onCheckedChange={selectAllPropertyTypes}
                              />
                              <Label
                                htmlFor="select-all-property-types"
                                className="font-normal cursor-pointer"
                              >
                                Select All
                              </Label>
                            </div>
                            
                            {[
                              { value: "single_family", label: "Single Family" },
                              { value: "condo", label: "Condo" },
                              { value: "townhouse", label: "Townhouse" },
                              { value: "multi_family", label: "Multi Family" },
                              { value: "land", label: "Land" },
                              { value: "commercial", label: "Commercial" },
                            ].map((type) => (
                              <div key={type.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`type-${type.value}`}
                                  checked={propertyTypes.includes(type.value)}
                                  onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                                />
                                <label
                                  htmlFor={`type-${type.value}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {type.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Price Range - Collapsible, CLOSED by default, HIDDEN for general_discussion */}
                  {category !== "general_discussion" && (
                    <Collapsible>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-3 rounded-md border">
                          <Label className="text-sm font-semibold uppercase cursor-pointer">
                            Price Range
                            {(minPrice || maxPrice) && (
                              <span className="ml-2 text-xs font-normal text-green-600">
                                (${minPriceDisplay || '0'} - ${maxPriceDisplay || '∞'})
                              </span>
                            )}
                          </Label>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="minPrice" className="text-xs text-muted-foreground">
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
                                  className="pl-7"
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
                                />
                                <label htmlFor="noMinPrice" className="text-xs text-muted-foreground cursor-pointer">
                                  No minimum
                                </label>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">
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
                                  className="pl-7"
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
                                />
                                <label htmlFor="noMaxPrice" className="text-xs text-muted-foreground cursor-pointer">
                                  No maximum
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}

              {/* Subject & Message */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject line"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message..."
                    className="min-h-[150px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button onClick={handleSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Preview & Send
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
