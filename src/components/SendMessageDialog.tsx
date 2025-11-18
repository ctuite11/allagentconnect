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
  const [county, setCounty] = useState("all");
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [showAreas, setShowAreas] = useState("yes");
  const [townSearch, setTownSearch] = useState("");
  
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
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
    county,
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

  const handleMinPriceChange = (value: string) => {
    setMinPrice(value);
    if (value) setNoMinPrice(false);
  };

  const handleMaxPriceChange = (value: string) => {
    setMaxPrice(value);
    if (value) setNoMaxPrice(false);
  };

  // Fetch recipient count when criteria changes
  useEffect(() => {
    if (open && showLocationFields) {
      fetchRecipientCount();
    }
  }, [open, state, county, selectedTowns, propertyTypes, minPrice, maxPrice, noMinPrice, noMaxPrice]);

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
          county: county !== "all" ? county : undefined,
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
          county: county !== "all" ? county : undefined,
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
    setCounty("all");
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
                  {county !== "all" && (
                    <p><strong>County:</strong> {county}</p>
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
            {/* Counts Preview */}
            {!loadingCount && recipientCount !== null && (
              <div className="space-y-2">
                {recipientCount !== null && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong className="text-foreground">{recipientCount}</strong> {recipientCount === 1 ? "agent will" : "agents will"} receive this message
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
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

              {/* Simplified Location & Criteria */}
              {showLocationFields && (
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="text-sm font-medium">Location & Criteria</h3>

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

                  {/* County Selection (for states with county data) */}
                  {state && hasCountyData && (
                    <div className="space-y-2">
                      <Label htmlFor="county">County (Optional)</Label>
                      <Select value={county} onValueChange={setCounty}>
                        <SelectTrigger id="county">
                          <SelectValue placeholder="Select county" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Counties</SelectItem>
                          {currentStateCounties.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Show Areas Toggle */}
                  {state && (
                    <div className="space-y-2">
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
                      <ScrollArea className="h-48 border rounded-md p-2">
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
                        />
                      </ScrollArea>
                      {selectedTowns.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedTowns.length} location(s) selected
                        </p>
                      )}
                    </div>
                  )}

                  {/* Property Types */}
                  <div className="space-y-2">
                    <Label>Property Types (Optional)</Label>
                    <Button
                      type="button"
                      onClick={selectAllPropertyTypes}
                      variant="outline"
                      size="sm"
                      className="w-full mb-2"
                    >
                      {propertyTypes.length === 6 ? "Deselect All" : "Select All Types"}
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
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

                  {/* Price Range */}
                  <div className="space-y-2">
                    <Label>Price Range (Optional)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minPrice" className="text-xs text-muted-foreground">
                          Minimum Price
                        </Label>
                        <Input
                          id="minPrice"
                          type="number"
                          value={minPrice}
                          onChange={(e) => handleMinPriceChange(e.target.value)}
                          placeholder="Min"
                          disabled={noMinPrice}
                        />
                        <div className="flex items-center space-x-2 mt-1">
                          <Checkbox
                            id="noMinPrice"
                            checked={noMinPrice}
                            onCheckedChange={(checked) => {
                              setNoMinPrice(checked as boolean);
                              if (checked) setMinPrice("");
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
                        <Input
                          id="maxPrice"
                          type="number"
                          value={maxPrice}
                          onChange={(e) => handleMaxPriceChange(e.target.value)}
                          placeholder="Max"
                          disabled={noMaxPrice}
                        />
                        <div className="flex items-center space-x-2 mt-1">
                          <Checkbox
                            id="noMaxPrice"
                            checked={noMaxPrice}
                            onCheckedChange={(checked) => {
                              setNoMaxPrice(checked as boolean);
                              if (checked) setMaxPrice("");
                            }}
                          />
                          <label htmlFor="noMaxPrice" className="text-xs text-muted-foreground cursor-pointer">
                            No maximum
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
