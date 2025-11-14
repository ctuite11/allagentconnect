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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Users, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { usNeighborhoodsByCityState } from "@/data/usNeighborhoodsData";

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
  
  // Additional fields for buyer_need and renter_need
  const [state, setState] = useState("");
  const [counties, setCounties] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);

  // Set default subject when dialog opens
  useEffect(() => {
    if (open && defaultSubject) {
      setSubject(defaultSubject);
    }
  }, [open, defaultSubject]);

  const showLocationFields = category === "buyer_need" || category === "renter_need";
  
  // Get available counties and cities based on selection
  const availableCounties = state ? COUNTIES_BY_STATE[state] || [] : [];
  const availableCities = state 
    ? (counties.length > 0 && hasCountyCityMapping(state) 
        ? counties.flatMap(county => getCitiesForCounty(state, county))
        : usCitiesByState[state] || [])
    : [];
  const availableNeighborhoods = cities.length > 0 && state
    ? [...new Set(cities.flatMap(city => usNeighborhoodsByCityState[`${city}-${state}`] || []))]
    : [];

  // Reset dependent fields when state, county, or city changes
  const handleStateChange = (newState: string) => {
    setState(newState);
    setCounties([]);
    setCities([]);
    setNeighborhoods([]);
  };

  const handleCountyToggle = (countyName: string) => {
    setCounties(prev => 
      prev.includes(countyName) 
        ? prev.filter(c => c !== countyName)
        : [...prev, countyName]
    );
    setCities([]);
    setNeighborhoods([]);
  };

  const handleCityToggle = (cityName: string) => {
    setCities(prev => 
      prev.includes(cityName) 
        ? prev.filter(c => c !== cityName)
        : [...prev, cityName]
    );
    setNeighborhoods([]);
  };

  const handleNeighborhoodToggle = (neighborhoodName: string) => {
    setNeighborhoods(prev => 
      prev.includes(neighborhoodName) 
        ? prev.filter(n => n !== neighborhoodName)
        : [...prev, neighborhoodName]
    );
  };

  const handlePropertyTypeToggle = (typeValue: string) => {
    setPropertyTypes(prev =>
      prev.includes(typeValue)
        ? prev.filter(t => t !== typeValue)
        : [...prev, typeValue]
    );
  };

  const selectAllCounties = () => {
    if (counties.length === availableCounties.length) {
      setCounties([]);
    } else {
      setCounties([...availableCounties]);
    }
    setCities([]);
    setNeighborhoods([]);
  };

  const selectAllCities = () => {
    if (cities.length === availableCities.length) {
      setCities([]);
    } else {
      setCities([...availableCities]);
    }
    setNeighborhoods([]);
  };

  const selectAllNeighborhoods = () => {
    if (neighborhoods.length === availableNeighborhoods.length) {
      setNeighborhoods([]);
    } else {
      setNeighborhoods([...availableNeighborhoods]);
    }
  };

  const selectAllPropertyTypes = () => {
    const allTypes = ["single_family", "condo", "townhouse", "multi_family", "land", "commercial"];
    if (propertyTypes.length === allTypes.length) {
      setPropertyTypes([]);
    } else {
      setPropertyTypes(allTypes);
    }
  };

  const handleMinPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) return;
    setMinPrice(formatted);
  };

  const handleMaxPriceChange = (value: string) => {
    const sanitized = value.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
    const num = parseFloat(formatted);
    if (!isNaN(num) && num > 999999999) return;
    setMaxPrice(formatted);
  };

  const formatDisplayPrice = (price: string) => {
    if (!price) return "";
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const fetchRecipientCount = async () => {
    setLoadingCount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch agents with this preference enabled (excluding self)
      const query = supabase
        .from("notification_preferences")
        .select("user_id")
        .neq("user_id", user.id);

      // Type assertion to handle dynamic column name
      const { data, error } = await (query as any).eq(category, true);

      if (error) throw error;

      setRecipientCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching recipient count:", error);
      setRecipientCount(0);
    } finally {
      setLoadingCount(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecipientCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (showLocationFields) {
      if (!state) {
        toast.error("Please select a state");
        return;
      }
      if (propertyTypes.length === 0) {
        toast.error("Please select at least one property type");
        return;
      }
    }

    // Show confirmation before sending
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setSending(true);
    try {
      const requestBody: any = {
        category,
        subject: subject.trim(),
        message: message.trim(),
      };

      // Add location and price criteria for buyer_need and renter_need
      if (showLocationFields) {
        requestBody.criteria = {
          state,
          counties: counties.length > 0 ? counties : undefined,
          cities: cities.length > 0 ? cities : undefined,
          neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
        };
      }

      const { data, error } = await supabase.functions.invoke("send-client-need-notification", {
        body: requestBody,
      });

      if (error) throw error;

      if (data?.recipientCount === 0) {
        toast.info("No agents match the specified criteria");
      } else {
        toast.success(
          `Message sent successfully to ${data.successCount} agent${data.successCount !== 1 ? "s" : ""}!`
        );
      }

      onOpenChange(false);
      setSubject("");
      setMessage("");
      setState("");
      setCounties([]);
      setCities([]);
      setNeighborhoods([]);
      setMinPrice("");
      setMaxPrice("");
      setPropertyTypes([]);
      setShowConfirmation(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {showConfirmation ? "Confirm & Send Message" : `Send ${categoryTitle} Message`}
          </DialogTitle>
          <DialogDescription>
            {showConfirmation 
              ? "Please review your message and criteria before sending."
              : `Compose your message to send to agents interested in ${categoryTitle.toLowerCase()}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        {showConfirmation ? (
          /* Confirmation View */
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">Subject:</h4>
                <p className="text-sm">{subject}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Message:</h4>
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
            </div>

            {showLocationFields && (state || counties.length > 0 || cities.length > 0 || neighborhoods.length > 0 || propertyTypes.length > 0 || minPrice || maxPrice) && (
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Search Criteria:
                </h4>
                <div className="space-y-1 text-sm">
                  {propertyTypes.length > 0 && (
                    <div><strong>Property Types:</strong> {propertyTypes.map(pt => pt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}</div>
                  )}
                  {state && (
                    <div><strong>State:</strong> {US_STATES.find(s => s.code === state)?.name}</div>
                  )}
                  {counties.length > 0 && (
                    <div><strong>Counties:</strong> {counties.join(', ')}</div>
                  )}
                  {cities.length > 0 && (
                    <div><strong>Cities:</strong> {cities.join(', ')}</div>
                  )}
                  {neighborhoods.length > 0 && (
                    <div><strong>Neighborhoods:</strong> {neighborhoods.join(', ')}</div>
                  )}
                  {propertyTypes.length > 0 && (
                    <div>
                      <strong>Property Types:</strong> {propertyTypes.map(pt => {
                        const labels: Record<string, string> = {
                          single_family: "Single Family",
                          condo: "Condo",
                          townhouse: "Townhouse",
                          multi_family: "Multi-Family",
                          land: "Land",
                          commercial: "Commercial"
                        };
                        return labels[pt] || pt;
                      }).join(', ')}
                    </div>
                  )}
                  {(minPrice || maxPrice) && (
                    <div>
                      <strong>Price Range:</strong>{' '}
                      {minPrice && maxPrice 
                        ? `$${parseFloat(minPrice).toLocaleString()} - $${parseFloat(maxPrice).toLocaleString()}`
                        : minPrice 
                        ? `$${parseFloat(minPrice).toLocaleString()}+`
                        : `Up to $${parseFloat(maxPrice).toLocaleString()}`
                      }
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loadingCount && recipientCount !== null && (
              <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {recipientCount === 0 ? (
                    "No agents will receive this message"
                  ) : (
                    <>
                      This message will be sent to <strong className="text-foreground">{recipientCount}</strong> agent{recipientCount !== 1 ? "s" : ""}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Form View */
          <>
            {/* Recipient Count Preview */}
            {!loadingCount && recipientCount !== null && (
              <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {recipientCount === 0 ? (
                    "No agents will receive this message"
                  ) : (
                    <>
                      This message will be sent to <strong className="text-foreground">{recipientCount}</strong> agent{recipientCount !== 1 ? "s" : ""}
                    </>
                  )}
                </span>
              </div>
            )}
        <div className="space-y-4 py-4">
            {showLocationFields && (
              <>
                {/* Property Type - Required Multi-Select */}
                <div className="space-y-2">
                  <Label>Property Types * (Select Multiple)</Label>
                  <div className="space-y-3">
                    <Button 
                      type="button"
                      onClick={selectAllPropertyTypes}
                      variant={propertyTypes.length === 6 ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      ✓ {propertyTypes.length === 6 ? "Deselect All" : "Select All Property Types"}
                    </Button>
                    <div className="border rounded-md p-3 bg-background max-h-[200px] overflow-y-auto">
                      <div className="space-y-2">
                        {[
                          { value: "single_family", label: "Single Family" },
                          { value: "condo", label: "Condo" },
                          { value: "townhouse", label: "Townhouse" },
                          { value: "multi_family", label: "Multi-Family" },
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
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {propertyTypes.length} {propertyTypes.length === 1 ? 'type' : 'types'} selected
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location Fields */}
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="text-sm font-medium">Location & Criteria</h3>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={state} onValueChange={handleStateChange}>
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

                {state && availableCounties.length > 0 && (
                  <div className="space-y-2">
                    <Label>Counties (Optional - Select Multiple)</Label>
                    <Button 
                      type="button"
                      onClick={selectAllCounties}
                      variant="outline"
                      size="sm"
                      className="w-full mb-2"
                    >
                      ✓ {counties.length === availableCounties.length ? "Deselect All" : "Select All Counties"}
                    </Button>
                    <div className="border rounded-md p-3 bg-background">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {availableCounties.map((countyName) => (
                            <div key={countyName} className="flex items-center space-x-2">
                              <Checkbox
                                id={`county-${countyName}`}
                                checked={counties.includes(countyName)}
                                onCheckedChange={() => handleCountyToggle(countyName)}
                              />
                              <label
                                htmlFor={`county-${countyName}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {countyName}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {counties.length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {counties.length} {counties.length === 1 ? 'county' : 'counties'} selected
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {state && availableCities.length > 0 && (
                  <div className="space-y-2">
                    <Label>Cities/Towns (Optional - Select Multiple)</Label>
                    <Button 
                      type="button"
                      onClick={selectAllCities}
                      variant="outline"
                      size="sm"
                      className="w-full mb-2"
                    >
                      ✓ {cities.length === availableCities.length ? "Deselect All" : "Select All Cities/Towns"}
                    </Button>
                    <div className="border rounded-md p-3 bg-background">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {availableCities.map((cityName) => (
                            <div key={cityName} className="flex items-center space-x-2">
                              <Checkbox
                                id={`city-${cityName}`}
                                checked={cities.includes(cityName)}
                                onCheckedChange={() => handleCityToggle(cityName)}
                              />
                              <label
                                htmlFor={`city-${cityName}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {cityName}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {cities.length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {cities.length} {cities.length === 1 ? 'city' : 'cities'} selected
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {cities.length > 0 && availableNeighborhoods.length > 0 && (
                  <div className="space-y-2">
                    <Label>Neighborhoods/Areas (Optional - Select Multiple)</Label>
                    <Button 
                      type="button"
                      onClick={selectAllNeighborhoods}
                      variant="outline"
                      size="sm"
                      className="w-full mb-2"
                    >
                      ✓ {neighborhoods.length === availableNeighborhoods.length ? "Deselect All" : "Select All Neighborhoods"}
                    </Button>
                    <div className="border rounded-md p-3 bg-background">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {availableNeighborhoods.map((neighborhoodName) => (
                            <div key={neighborhoodName} className="flex items-center space-x-2">
                              <Checkbox
                                id={`neighborhood-${neighborhoodName}`}
                                checked={neighborhoods.includes(neighborhoodName)}
                                onCheckedChange={() => handleNeighborhoodToggle(neighborhoodName)}
                              />
                              <label
                                htmlFor={`neighborhood-${neighborhoodName}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {neighborhoodName}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {neighborhoods.length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {neighborhoods.length} {neighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'} selected
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Min Price (Optional)</Label>
                    <Input
                      id="minPrice"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 100000"
                      value={minPrice}
                      onChange={(e) => handleMinPriceChange(e.target.value)}
                      maxLength={12}
                    />
                    {minPrice && (
                      <p className="text-xs text-muted-foreground">Preview: {formatDisplayPrice(minPrice)}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Max Price (Optional)</Label>
                    <Input
                      id="maxPrice"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 500000"
                      value={maxPrice}
                      onChange={(e) => handleMaxPriceChange(e.target.value)}
                      maxLength={12}
                    />
                    {maxPrice && (
                      <p className="text-xs text-muted-foreground">Preview: {formatDisplayPrice(maxPrice)}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Message Fields */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        </>
        )}
        <div className="flex justify-end gap-3">
          {showConfirmation ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmation(false)}
                disabled={sending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Edit
              </Button>
              <Button onClick={handleSend} disabled={sending || recipientCount === 0}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Confirm & Send"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                Review & Send
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
