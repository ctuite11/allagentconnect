import { BUYER_NEED_DISCLOSURE } from "@/lib/buyerNeedCompose";
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
import { toast } from "sonner";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Home,
  DollarSign,
  Info,
} from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
import { COMMS_FILTERS_UI } from "@/lib/commsFiltersCopy";
import {
  commsChevron,
  commsCountBadge,
  commsDialogBody,
  commsDialogContent,
  commsDialogDescription,
  commsDialogHeaderPad,
  commsDialogTitle,
  commsFieldLabel,
  commsInput,
  commsLabel,
  commsMessageCard,
  commsOutlineButton,
  commsPopoverContent,
  commsRecipientPreview,
  commsSectionBody,
  commsSectionIcon,
  commsSectionShell,
  commsSectionTitle,
  commsSectionTriggerRow,
  commsTextarea,
} from "@/components/communication-center/commsCenterFormStyles";
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

  // Build criteria the same way handleSend does — single source of truth for recipient logic.
  const buildCriteria = () => {
    const cities: string[] = [];
    const neighborhoods: string[] = [];
    selectedCities.forEach((town) => {
      if (town.includes("-")) {
        const [city, neighborhood] = town.split("-");
        if (!cities.includes(city)) cities.push(city);
        neighborhoods.push(neighborhood);
      } else {
        if (!cities.includes(town)) cities.push(town);
      }
    });
    return {
      state,
      counties: selectedCountyId !== "all" ? [selectedCountyId] : undefined,
      cities: cities.length > 0 ? cities : undefined,
      neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
    };
  };

  // Fetch recipient count via previewOnly so preview matches actual send list.
  useEffect(() => {
    if (!open || !state) return;
    let cancelled = false;
    setLoadingCount(true);
    const handle = setTimeout(async () => {
      try {
        const criteria = buildCriteria();
        const { data, error } = await supabase.functions.invoke(
          "send-client-need-notification",
          {
            body: {
              category: "buyer_need",
              subject: "",
              message: "",
              previewOnly: true,
              criteria,
            },
          }
        );
        if (cancelled) return;
        if (error) throw error;
        setRecipientCount(data?.recipientCount ?? 0);
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching recipient preview:", err);
          setRecipientCount(0);
        }
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, state, selectedCountyId, selectedCities, propertyTypes, minPrice, maxPrice]);

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

      const criteria = buildCriteria();

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

      const count = data?.sent ?? data?.queued ?? data?.recipientCount ?? 0;
      const copyMsg = sendCopyToSelf ? " A copy was sent to you." : "";
      toast.success("Message sent", {
        description: `Delivered to ${count} agent${count === 1 ? "" : "s"}.${copyMsg}`,
      });
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
      <DialogContent className={commsDialogContent}>
        <div className={commsDialogHeaderPad}>
          <DialogHeader>
            <DialogTitle className={commsDialogTitle}>Send Email</DialogTitle>
            <DialogDescription className={commsDialogDescription}>
              {COMMS_FILTERS_UI.sendDialogAudience}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={commsDialogBody}>
          <div className={commsRecipientPreview}>
            <div className="flex items-center gap-3">
              <AACMonogram className="h-6 w-6 text-emerald-600" />
              {loadingCount ? (
                <span className="text-sm text-neutral-500">Calculating recipients...</span>
              ) : recipientCount !== null ? (
                <span className="text-sm text-neutral-700">
                  Sending to{" "}
                  <strong className="font-semibold text-neutral-900">{recipientCount}</strong>{" "}
                  {recipientCount === 1 ? "agent" : "agents"}
                </span>
              ) : (
                <span className="text-sm text-neutral-500">Select criteria to see recipient count</span>
              )}
            </div>
          </div>

          {/* Geographic Selection - Required */}
          <Collapsible open={geoExpanded} onOpenChange={setGeoExpanded}>
            <div className={commsSectionShell}>
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className={commsSectionTriggerRow}>
                  <div className="flex min-w-0 items-center gap-3">
                    <MapPin className={commsSectionIcon} strokeWidth={2} aria-hidden />
                    <span className={commsSectionTitle}>Geographic Area</span>
                    <span className="text-xs font-medium text-destructive">*Required</span>
                  </div>
                  {geoExpanded ? (
                    <ChevronUp className={commsChevron} strokeWidth={2} aria-hidden />
                  ) : (
                    <ChevronDown className={commsChevron} strokeWidth={2} aria-hidden />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={commsSectionBody}>
                  {/* State and County */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={commsLabel}>State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className={commsInput}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {US_STATES.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className={commsLabel}>County</Label>
                      <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                        <SelectTrigger className={commsInput}>
                          <SelectValue placeholder="All counties" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
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
                      <Label className={commsLabel}>Towns</Label>
                      <Popover open={townsOpen} onOpenChange={setTownsOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start font-normal ${commsInput} hover:bg-neutral-50`}
                          >
                            {selectedCities.length > 0 
                              ? `${selectedCities.length} selected` 
                              : "Select towns..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className={commsPopoverContent} align="start">
                          <div className="border-b border-neutral-200 p-3">
                            <Input
                              placeholder="Search towns..."
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              className={commsInput}
                            />
                          </div>
                          <ScrollArea className="h-[220px]">
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
                      <Label className={commsLabel}>Selected</Label>
                      <div className="min-h-[44px] rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                        {selectedCities.length > 0 
                          ? selectedCities.slice(0, 3).join(", ") + (selectedCities.length > 3 ? ` +${selectedCities.length - 3} more` : "")
                          : <span className="text-neutral-400">No towns selected</span>
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
            <div className={commsSectionShell}>
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className={commsSectionTriggerRow}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Home className={commsSectionIcon} strokeWidth={2} aria-hidden />
                    <span className={commsSectionTitle}>Property Types</span>
                    {propertyTypes.length > 0 && (
                      <span className={commsCountBadge}>{propertyTypes.length} selected</span>
                    )}
                  </div>
                  {propertyExpanded ? (
                    <ChevronUp className={commsChevron} strokeWidth={2} aria-hidden />
                  ) : (
                    <ChevronDown className={commsChevron} strokeWidth={2} aria-hidden />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={commsSectionBody}>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2.5">
                        <Checkbox
                          id={type.value}
                          checked={propertyTypes.includes(type.value)}
                          onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                          className="rounded-[4px] border-neutral-300"
                        />
                        <label htmlFor={type.value} className="cursor-pointer text-sm text-neutral-700">
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
            <div className={commsSectionShell}>
              <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                <div className={commsSectionTriggerRow}>
                  <div className="flex min-w-0 items-center gap-3">
                    <DollarSign className={commsSectionIcon} strokeWidth={2} aria-hidden />
                    <span className={commsSectionTitle}>Price Range</span>
                    {(minPrice || maxPrice) && (
                      <span className={commsCountBadge}>
                        {minPrice ? `$${parseInt(minPrice, 10).toLocaleString()}` : "Any"} -{" "}
                        {maxPrice ? `$${parseInt(maxPrice, 10).toLocaleString()}` : "Any"}
                      </span>
                    )}
                  </div>
                  {priceExpanded ? (
                    <ChevronUp className={commsChevron} strokeWidth={2} aria-hidden />
                  ) : (
                    <ChevronDown className={commsChevron} strokeWidth={2} aria-hidden />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={commsSectionBody}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={commsLabel}>Min Price</Label>
                      <Input
                        placeholder="No minimum"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ""))}
                        className={commsInput}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={commsLabel}>Max Price</Label>
                      <Input
                        placeholder="No maximum"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ""))}
                        className={commsInput}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className={commsMessageCard}>
            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className={commsInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {EMAIL_TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Subject *</Label>
              <Input
                placeholder="Email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                className={commsInput}
              />
            </div>

            <div className="space-y-2.5">
              <Label className={commsFieldLabel}>Message *</Label>
              <Textarea
                placeholder="Your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={5000}
                className={commsTextarea}
              />
              <p className="text-right text-xs text-neutral-500">{message.length}/5000</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-900">
              Replies will be delivered to your email inbox, not to DirectConnectMLS.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-neutral-900">Send a copy to myself</Label>
              <p className="text-xs text-neutral-500">
                Receive a copy of this email at your registered email address
              </p>
            </div>
            <Switch checked={sendCopyToSelf} onCheckedChange={setSendCopyToSelf} />
          </div>

          <div
            className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            data-testid="buyer-need-disclosure"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
            <p className="text-sm text-neutral-700">{BUYER_NEED_DISCLOSURE}</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={sending}
              className={commsOutlineButton}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim() || !state}
              className="rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
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
