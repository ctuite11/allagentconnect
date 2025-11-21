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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Users, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity } from "@/data/usNeighborhoodsData";

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
  
  // Geographic fields
  const [state, setState] = useState("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState("yes");
  const [townSearch, setTownSearch] = useState("");
  
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minPriceDisplay, setMinPriceDisplay] = useState("");
  const [maxPriceDisplay, setMaxPriceDisplay] = useState("");
  const [noMinPrice, setNoMinPrice] = useState(false);
  const [noMaxPrice, setNoMaxPrice] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);

  // Use the towns picker hook
  const {
    townsList,
    expandedCities,
    toggleCityExpansion,
    hasCountyData
  } = useTownsPicker({
    state,
    county: selectedCounties.length === 1 ? selectedCounties[0] : "",
    showAreas: showAreas === "yes"
  });

  const currentStateCounties = hasCountyData ? getCountiesForState(state) : [];

  // Set default subject when dialog opens
  useEffect(() => {
    if (open && defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [open, defaultSubject]);

  const showLocationFields = true; // Show filtering for all categories

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

  const toggleCounty = (countyName: string) => {
    setSelectedCounties(prev =>
      prev.includes(countyName)
        ? prev.filter(c => c !== countyName)
        : [...prev, countyName]
    );
  };

  const selectAllCounties = () => {
    if (selectedCounties.length === currentStateCounties.length) {
      setSelectedCounties([]);
    } else {
      setSelectedCounties([...currentStateCounties]);
    }
  };

  const handleMinPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');
    setMinPrice(sanitized);
    // Format as user types
    const formatted = sanitized ? sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
    setMinPriceDisplay(formatted);
    if (sanitized) setNoMinPrice(false);
  };

  const handleMaxPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');
    setMaxPrice(sanitized);
    // Format as user types
    const formatted = sanitized ? sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
    setMaxPriceDisplay(formatted);
    if (sanitized) setNoMaxPrice(false);
  };

  // Fetch recipient count when criteria changes
  useEffect(() => {
    if (open && showLocationFields) {
      fetchRecipientCount();
    }
  }, [open, state, selectedCounties, selectedTowns, propertyTypes, minPrice, maxPrice, noMinPrice, noMaxPrice]);

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
        // Extract cities and neighborhoods from selectedTowns
        const cities: string[] = [];
        const neighborhoods: string[] = [];
        
        selectedTowns.forEach(town => {
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
          counties: selectedCounties.length > 0 ? selectedCounties : undefined,
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

  // Auto-select neighborhoods when all towns are selected
  useEffect(() => {
    if (showAreas === "yes" && state) {
      // Get all city names (non-hyphenated entries)
      const allCities = townsList.filter(t => !t.includes('-'));
      
      // Check if all cities are selected
      const allCitiesSelected = allCities.every(city => selectedTowns.includes(city));
      
      if (allCitiesSelected && allCities.length > 0) {
        // Auto-add all neighborhoods
        const withNeighborhoods = [...selectedTowns];
        allCities.forEach(city => {
          const neighborhoods = getAreasForCity(city, state);
          if (neighborhoods && neighborhoods.length > 0) {
            neighborhoods.forEach(n => {
              const key = `${city}-${n}`;
              if (!withNeighborhoods.includes(key)) {
                withNeighborhoods.push(key);
              }
            });
          }
        });
        
        if (withNeighborhoods.length > selectedTowns.length) {
          setSelectedTowns(withNeighborhoods);
        }
      }
    }
  }, [selectedTowns, townsList, showAreas, state]);

  const handleSend = async () => {
    if (!showConfirmation) {
      // Validate
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

      // Show confirmation
      setShowConfirmation(true);
      return;
    }

    // Actually send
    setSending(true);
    try {
      const requestBody: any = {
        category,
        subject,
        message,
      };

      if (showLocationFields) {
        // Extract cities and neighborhoods from selectedTowns
        const cities: string[] = [];
        const neighborhoods: string[] = [];
        
        selectedTowns.forEach(town => {
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
          counties: selectedCounties.length > 0 ? selectedCounties : undefined,
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
    setState("");
    setSelectedCounties([]);
    setSelectedTowns([]);
    setTownSearch("");
    setMinPrice("");
    setMaxPrice("");
    setNoMinPrice(false);
    setNoMaxPrice(false);
    setPropertyTypes([]);
    setRecipientCount(null);
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const toggleTown = (town: string) => {
    setSelectedTowns(prev =>
      prev.includes(town)
        ? prev.filter(t => t !== town)
        : [...prev, town]
    );
  };

  const selectAllTowns = () => {
    if (selectedTowns.length === townsList.length) {
      // Deselect all
      setSelectedTowns([]);
    } else {
      // Select all towns AND neighborhoods
      const allLocations: string[] = [];
      
      townsList.forEach(town => {
        if (!town.includes('-')) {
          // Add the city/town
          allLocations.push(town);
          
          // Add all its neighborhoods if showAreas is enabled
          if (showAreas === "yes") {
            const neighborhoods = getAreasForCity(town, state);
            if (neighborhoods && neighborhoods.length > 0) {
              neighborhoods.forEach(n => {
                allLocations.push(`${town}-${n}`);
              });
            }
          }
        }
      });
      
      setSelectedTowns(allLocations);
    }
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
          /* Confirmation View */
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
                    <p><strong>State:</strong> {state}</p>
                  {selectedCounties.length > 0 && (
                    <p><strong>Counties:</strong> {selectedCounties.length} selected</p>
                  )}
                  {selectedTowns.length > 0 && (
                    <p><strong>Towns/Cities:</strong> {selectedTowns.length} selected</p>
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
          /* Form View */
          <>
            {/* Agent Counter - Always show to prevent layout shift */}
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
              {/* Simplified Location & Criteria */}
              {showLocationFields && (
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="text-sm font-medium">Location & Criteria</h3>

                  {/* Property Types */}
                  <div className="space-y-2">
                    <Label>Property Types (Optional)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Select All Option */}
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
                      
                      {/* Individual Options */}
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
                    {propertyTypes.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {propertyTypes.length} type(s) selected
                      </p>
                    )}
                  </div>

                  {/* Price Range */}
                  <div className="space-y-2">
                    <Label>Price Range (Optional)</Label>
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
                            placeholder={category === "renter_need" ? "20,000" : "500,000"}
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
                          <label htmlFor="maxMaxPrice" className="text-xs text-muted-foreground cursor-pointer">
                            No maximum
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state">
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

                  {/* Counties and Neighborhoods Side-by-Side */}
                  {state && hasCountyData && currentStateCounties.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Counties Section (Left) */}
                      <div className="space-y-2">
                        <Label>Counties (Optional)</Label>
                        <ScrollArea className="h-32 border rounded-md">
                          <div className="space-y-2 p-2 pl-1">
                            {/* Select All Option */}
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="select-all-counties"
                                checked={selectedCounties.length === currentStateCounties.length}
                                onCheckedChange={selectAllCounties}
                              />
                              <Label
                                htmlFor="select-all-counties"
                                className="font-normal cursor-pointer"
                              >
                                Select All
                              </Label>
                            </div>
                            
                            {/* Individual County Options */}
                            {currentStateCounties.map((countyName) => (
                              <div key={countyName} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`county-${countyName}`}
                                  checked={selectedCounties.includes(countyName)}
                                  onCheckedChange={() => toggleCounty(countyName)}
                                />
                                <Label
                                  htmlFor={`county-${countyName}`}
                                  className="font-normal cursor-pointer"
                                >
                                  {countyName}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        {selectedCounties.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {selectedCounties.length} county/counties selected
                          </p>
                        )}
                      </div>

                      {/* Include Neighborhoods Section (Right) */}
                      <div className="space-y-2 pt-8">
                        <Label>Include Neighborhoods?</Label>
                        <RadioGroup value={showAreas} onValueChange={setShowAreas}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="areas-yes" />
                            <Label htmlFor="areas-yes" className="font-normal cursor-pointer">
                              Yes - Show neighborhoods within cities
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="areas-no" />
                            <Label htmlFor="areas-no" className="font-normal cursor-pointer">
                              No - Cities only
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}

                  {/* Town/City Selection */}
                  {state && (
                    <div className="space-y-2">
                      <Label htmlFor="townSearch">Cities/Towns (Optional)</Label>
                      <Input
                        id="townSearch"
                        placeholder="Search cities..."
                        value={townSearch}
                        onChange={(e) => setTownSearch(e.target.value)}
                      />
                      <ScrollArea className="h-48 border rounded-md">
                        <TownsPicker
                          towns={townsList}
                          selectedTowns={selectedTowns}
                          onToggleTown={toggleTown}
                          expandedCities={expandedCities}
                          onToggleCityExpansion={toggleCityExpansion}
                          state={state}
                          searchQuery={townSearch}
                          variant="checkbox"
                          showAreas={showAreas === "yes"}
                          showSelectAll={true}
                          onSelectAll={selectAllTowns}
                        />
                      </ScrollArea>
                      {selectedTowns.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedTowns.length} location(s) selected
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Subject and Message */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message"
                    rows={6}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={
                    !subject.trim() ||
                    !message.trim() ||
                    (showLocationFields && !state) ||
                    loadingCount ||
                    recipientCount === 0
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Review & Send
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
