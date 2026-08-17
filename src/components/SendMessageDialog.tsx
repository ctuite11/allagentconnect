import { useState, useEffect, useRef } from "react";
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
import { Send, ArrowLeft, Loader2, ChevronDown, ChevronUp, MapPin, Home, DollarSign, Building2 } from "lucide-react";
import AACMonogram from "@/components/ui/AACMonogram";
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
  commsSelectTrigger,
  commsOutlineButton,
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
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";
import { formatCriteriaDisplayLabels } from "@/lib/formatCriteriaDisplay";
import { RecipientListDialog, type RecipientRow } from "@/components/communication-center/RecipientListDialog";
import {
  CommsAttachmentPicker,
  type PendingCommsAttachment,
} from "@/components/communication-center/CommsAttachmentPicker";
import { removeCommsAttachment } from "@/lib/commsAttachments";

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
  const [recipientList, setRecipientList] = useState<RecipientRow[]>([]);
  const [recipientListOpen, setRecipientListOpen] = useState(false);
  const [attachments, setAttachments] = useState<PendingCommsAttachment[]>([]);
  
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
  const composeRootRef = useRef<HTMLDivElement>(null);

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
      setRecipientList(Array.isArray(data?.recipients) ? data.recipients : []);
    } catch (error) {
      console.error("Error fetching counts:", error);
      setRecipientCount(0);
      setRecipientList([]);
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
        attachments: attachments.map(({ path, kind, mimeType, name, size }) => ({
          path,
          kind,
          mimeType,
          name,
          size,
        })),
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
        handleClose({ discardAttachments: false });
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

  const handleClose = (opts?: { discardAttachments?: boolean }) => {
    const discard = opts?.discardAttachments !== false;
    attachments.forEach((a) => {
      URL.revokeObjectURL(a.previewUrl);
      // Only orphaned uploads are purged; sent broadcasts keep their media.
      if (discard) void removeCommsAttachment(a.path);
    });
    setAttachments([]);
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

  /**
   * Return from Confirm & Send to the compose/filters step.
   * Collapse the towns search picker and clear the name query so Back does not
   * land on the town "Type Full or Partial Name" search UI.
   */
  const handleBackToEdit = () => {
    setTownsOpen(false);
    setCitySearch("");
    setShowConfirmation(false);
    // Wait for compose DOM to mount after leaving confirmation.
    window.setTimeout(() => {
      const root = composeRootRef.current;
      if (!root) return;
      const dialog = root.closest('[role="dialog"]');
      if (dialog instanceof HTMLElement) {
        dialog.scrollTo({ top: 0, behavior: "smooth" });
      }
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else onOpenChange(true); }}>
      <DialogContent className={commsDialogContent}>
        <div className={commsDialogHeaderPad}>
          <DialogHeader>
            <DialogTitle className={commsDialogTitle}>
              {showConfirmation ? "Confirm & Send" : `Send ${categoryTitle}`}
            </DialogTitle>
            <DialogDescription className={commsDialogDescription}>
              {showConfirmation
                ? "Review your message before sending"
                : "Compose and send a message to matching agents"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {showConfirmation ? (
          <div className="space-y-5 p-6">
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div>
                <Label className="text-sm font-semibold text-neutral-900">Subject</Label>
                <p className="mt-1 text-sm">{subject}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-neutral-900">Message</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{message}</p>
              </div>
              {state && (
                <div>
                  <Label className="text-sm font-semibold text-neutral-900">Criteria</Label>
                  <div className="mt-1 text-sm space-y-1">
                    <p><strong>State:</strong> {getStateName(state)}</p>
                  {selectedCountyId && selectedCountyId !== "all" && (
                    <p><strong>County:</strong> {selectedCountyId}</p>
                  )}
                  {selectedCities.length > 0 && (
                    <p><strong>Towns/Cities:</strong> {selectedCities.length} selected</p>
                  )}
                    {propertyTypes.length > 0 && (
                      <p><strong>Property Types:</strong> {formatCriteriaDisplayLabels(propertyTypes)}</p>
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
              <div className={commsRecipientPreview}>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <AACMonogram className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm text-neutral-600">
                    This will be sent to{" "}
                    <button
                      type="button"
                      onClick={() => setRecipientListOpen(true)}
                      disabled={recipientCount === 0}
                      className="font-semibold text-primary underline-offset-2 hover:underline disabled:no-underline disabled:text-neutral-900 disabled:cursor-default"
                    >
                      {recipientCount} {recipientCount === 1 ? "agent" : "agents"}
                    </button>
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToEdit}
                disabled={sending}
                className="rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSend}
                disabled={sending}
                className={commsOutlineButton}
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
          <div ref={composeRootRef} className={commsDialogBody}>
            {/* Recipient Count */}
            <div className={commsRecipientPreview}>
              <div className="flex items-center gap-3">
                <AACMonogram className="h-6 w-6 text-emerald-600" />
                {loadingCount ? (
                  <span className="text-sm text-neutral-500">
                    Calculating recipients...
                  </span>
                ) : recipientCount !== null ? (
                  <span className="text-sm text-neutral-700">
                    Sending to{" "}
                    <button
                      type="button"
                      onClick={() => setRecipientListOpen(true)}
                      disabled={recipientCount === 0}
                      className="font-semibold text-primary underline-offset-2 hover:underline disabled:no-underline disabled:text-neutral-900 disabled:cursor-default"
                    >
                      {recipientCount} {recipientCount === 1 ? "agent" : "agents"}
                    </button>
                  </span>
                ) : (
                  <span className="text-sm text-neutral-500">
                    Select criteria to see recipient count
                  </span>
                )}
              </div>
            </div>

            {showLocationFields && (
              <div className="space-y-6">
                {/* State and County - Always visible */}
                <div className={commsSectionShell}>
                  <div className="border-b border-neutral-200 px-6 pb-3 pt-5">
                    <div className="flex items-center gap-3">
                      <MapPin className={commsSectionIcon} strokeWidth={2} />
                      <span className={commsSectionTitle}>Location</span>
                      <span className="text-xs font-medium text-destructive">*Required</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={commsLabel}>State</Label>
                        <Select value={state} onValueChange={(val) => setState(val)}>
                          <SelectTrigger className={commsSelectTrigger}>
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
                        <Select value={selectedCountyId} onValueChange={(val) => setSelectedCountyId(val)}>
                          <SelectTrigger className={commsSelectTrigger}>
                            <SelectValue placeholder="All Counties" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
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
                  <div className={commsSectionShell}>
                    <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                      <div className={commsSectionTriggerRow}>
                        <div className="flex items-center gap-3">
                          <Building2 className={commsSectionIcon} strokeWidth={2} />
                          <span className={commsSectionTitle}>Towns & Neighborhoods</span>
                          {selectedCities.length > 0 && (
                            <span className={commsCountBadge}>
                              {selectedCities.length} selected
                            </span>
                          )}
                        </div>
                        {townsOpen ? (
                          <ChevronUp className={commsChevron} strokeWidth={2} />
                        ) : (
                          <ChevronDown className={commsChevron} strokeWidth={2} />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className={commsSectionBody}>
                        {/* Show Areas Yes/No */}
                        <div className="flex items-center gap-4">
                          <Label className={commsLabel}>Show Areas</Label>
                          <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="show-yes"
                                name="show-areas"
                                checked={showAreas === true}
                                onChange={() => setShowAreas(true)}
                                className="h-4 w-4 accent-emerald-600"
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
                                className="h-4 w-4 accent-emerald-600"
                              />
                              <Label htmlFor="show-no" className="text-sm cursor-pointer">No</Label>
                            </div>
                          </div>
                        </div>

                        {/* Search spans full width */}
                        <Input
                          placeholder="Type Full or Partial Name"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          className={commsInput}
                        />

                        {/* Two-column: Towns list + Selected towns */}
                        <div className="grid grid-cols-[1fr_1fr] gap-6">
                          <div className="space-y-2">
                            <div className="border border-neutral-200 rounded-xl bg-white max-h-60 overflow-y-auto p-2 relative z-10">
                              {selectedCountyId && townsList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={selectAllTowns}
                                  className="mb-1 w-full rounded px-2 py-1 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                                >
                                  Add All Towns ({townsList.length})
                                </button>
                              )}
                              <TownsPicker
                                towns={townsList}
                                selectedTowns={selectedCities}
                                onToggleTown={(town) => {
                                  if (!selectedCities.includes(town)) {
                                    toggleCity(town);
                                  }
                                }}
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
                             <div className="flex items-center justify-between mb-2">
                               <Label className={commsLabel}>Selected Towns</Label>
                               {selectedCities.length > 0 && (
                                 <button
                                   type="button"
                                   onClick={() => setSelectedCities([])}
                                   className="text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer"
                                 >
                                   Delete all
                                 </button>
                               )}
                             </div>
                             <div className="border border-neutral-200 rounded-xl bg-white p-3 min-h-[200px] max-h-60 overflow-y-auto">
                               {selectedCities.length === 0 ? (
                                 <div className="flex items-center justify-center h-full min-h-[160px]">
                                   <p className="text-sm text-neutral-400">No towns selected</p>
                                 </div>
                               ) : (
                                 <div className="space-y-1">
                                  {selectedCities.map((city) => (
                                    <div
                                      key={city}
                                      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50 transition-colors"
                                    >
                                      <span className="text-sm text-neutral-800">
                                        {city.includes('-') ? city.replace('-', ' - ') : city}
                                      </span>
                                      <button
                                         type="button"
                                         onClick={() => toggleCity(city)}
                                         className="ml-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-1 text-base leading-none cursor-pointer transition-colors"
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
                    <div className={commsSectionShell}>
                      <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                        <div className={commsSectionTriggerRow}>
                          <div className="flex items-center gap-3">
                            <Home className={commsSectionIcon} strokeWidth={2} />
                            <span className={commsSectionTitle}>Property Types</span>
                            {propertyTypes.length > 0 && (
                              <span className={commsCountBadge}>
                                {propertyTypes.length} selected
                              </span>
                            )}
                          </div>
                          {propertyTypesOpen ? (
                            <ChevronUp className={commsChevron} strokeWidth={2} />
                          ) : (
                            <ChevronDown className={commsChevron} strokeWidth={2} />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-neutral-200 p-6 pt-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Checkbox
                              id="selectAllPropertyTypes"
                              checked={propertyTypes.length === propertyTypeOptions.length}
                              onCheckedChange={() => selectAllPropertyTypes()}
                            />
                            <label htmlFor="selectAllPropertyTypes" className="text-sm font-medium text-neutral-700 cursor-pointer">
                              {propertyTypes.length === propertyTypeOptions.length ? "Clear All" : "Select All"}
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {propertyTypeOptions.map((type) => (
                              <div key={type.value} className="flex items-center space-x-2 hover:bg-neutral-50 rounded px-1 py-1 transition-colors">
                                <Checkbox
                                  id={`pt-${type.value}`}
                                  checked={propertyTypes.includes(type.value)}
                                  onCheckedChange={() => handlePropertyTypeToggle(type.value)}
                                />
                                <label htmlFor={`pt-${type.value}`} className="text-sm text-neutral-700 cursor-pointer">
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
                    <div className={commsSectionShell}>
                      <CollapsibleTrigger className="w-full focus:outline-none focus-visible:outline-none">
                        <div className={commsSectionTriggerRow}>
                          <div className="flex items-center gap-3">
                            <DollarSign className={commsSectionIcon} strokeWidth={2} />
                            <span className={commsSectionTitle}>Price Range</span>
                            {(minPrice || maxPrice) && (
                              <span className={commsCountBadge}>
                                ${minPriceDisplay || '0'} - ${maxPriceDisplay || '∞'}
                              </span>
                            )}
                          </div>
                          {priceRangeOpen ? (
                            <ChevronUp className={commsChevron} strokeWidth={2} />
                          ) : (
                            <ChevronDown className={commsChevron} strokeWidth={2} />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-neutral-200 p-6 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="minPrice" className={commsLabel}>
                                Minimum Price
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                                <Input
                                  id="minPrice"
                                  type="text"
                                  inputMode="numeric"
                                  value={minPriceDisplay}
                                  onChange={(e) => handleMinPriceChange(e.target.value)}
                                  placeholder={category === "renter_need" ? "1,000" : "500,000"}
                                  className={`pl-7 ${commsInput}`}
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
                                  className="rounded-[4px] border-neutral-300"
                                />
                                <label htmlFor="noMinPrice" className="text-sm text-neutral-500 cursor-pointer">
                                  No minimum
                                </label>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="maxPrice" className={commsLabel}>
                                Maximum Price
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                                <Input
                                  id="maxPrice"
                                  type="text"
                                  inputMode="numeric"
                                  value={maxPriceDisplay}
                                  onChange={(e) => handleMaxPriceChange(e.target.value)}
                                  placeholder={category === "renter_need" ? "5,000" : "2,000,000"}
                                  className={`pl-7 ${commsInput}`}
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
                                  className="rounded-[4px] border-neutral-300"
                                />
                                <label htmlFor="noMaxPrice" className="text-sm text-neutral-500 cursor-pointer">
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
            <div className={commsMessageCard}>
              <div className="space-y-2.5">
                <Label htmlFor="subject" className={commsFieldLabel}>
                  Subject *
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject line"
                  className={commsInput}
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="message" className={commsFieldLabel}>
                  Message *
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  className={commsTextarea}
                />
              </div>

              <div className="space-y-2.5">
                <Label className={commsFieldLabel}>Photos or video</Label>
                <CommsAttachmentPicker
                  attachments={attachments}
                  onChange={setAttachments}
                  disabled={sending}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className={commsOutlineButton}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSend}
                className={commsOutlineButton}
              >
                <Send className="h-4 w-4 mr-2" />
                Preview & Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <RecipientListDialog
      open={recipientListOpen}
      onOpenChange={setRecipientListOpen}
      recipients={recipientList}
      loading={loadingCount}
    />
    </>
  );
};
