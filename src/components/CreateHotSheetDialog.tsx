import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreateHotSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  clientName?: string;
  userId: string;
  onSuccess: (hotSheetId: string) => void;
  hotSheetId?: string;
  editMode?: boolean;
}

export function CreateHotSheetDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  userId,
  onSuccess,
  hotSheetId,
  editMode = false,
}: CreateHotSheetDialogProps) {
  const [hotSheetName, setHotSheetName] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Client information
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  
  // Search criteria
  const [listingNumbers, setListingNumbers] = useState("");
  const [address, setAddress] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rooms, setRooms] = useState("");
  const [acres, setAcres] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [pricePerSqft, setPricePerSqft] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [state, setState] = useState("");
  const [matchingListingsCount, setMatchingListingsCount] = useState<number>(0);
  
  // Agent criteria
  const [preferredCounties, setPreferredCounties] = useState<string[]>([]);
  const [requiresBuyerIncentives, setRequiresBuyerIncentives] = useState(false);
  const [counties, setCounties] = useState<Array<{ id: string; name: string }>>([]);
  
  // Sale listing criteria
  const [listingAgreementTypes, setListingAgreementTypes] = useState<string[]>([]);
  const [entryOnly, setEntryOnly] = useState<boolean | null>(null);
  const [lenderOwned, setLenderOwned] = useState<boolean | null>(null);
  const [shortSale, setShortSale] = useState<boolean | null>(null);
  const [propertyStyles, setPropertyStyles] = useState<string[]>([]);
  const [minYearBuilt, setMinYearBuilt] = useState("");
  const [maxYearBuilt, setMaxYearBuilt] = useState("");
  const [minLotSize, setMinLotSize] = useState("");
  const [maxLotSize, setMaxLotSize] = useState("");
  const [waterfront, setWaterfront] = useState<boolean | null>(null);
  const [waterView, setWaterView] = useState<boolean | null>(null);
  const [beachNearby, setBeachNearby] = useState<boolean | null>(null);
  const [facingDirection, setFacingDirection] = useState<string[]>([]);
  const [minFireplaces, setMinFireplaces] = useState("");
  const [basement, setBasement] = useState<boolean | null>(null);
  const [minGarageSpaces, setMinGarageSpaces] = useState("");
  const [minParkingSpaces, setMinParkingSpaces] = useState("");
  const [constructionFeatures, setConstructionFeatures] = useState<string[]>([]);
  const [roofMaterials, setRoofMaterials] = useState<string[]>([]);
  const [exteriorFeatures, setExteriorFeatures] = useState<string[]>([]);
  const [heatingTypes, setHeatingTypes] = useState<string[]>([]);
  const [coolingTypes, setCoolingTypes] = useState<string[]>([]);
  const [greenFeatures, setGreenFeatures] = useState<string[]>([]);
  
  const [saleCriteriaOpen, setSaleCriteriaOpen] = useState(false);
  
  // Notification settings
  const [notifyClient, setNotifyClient] = useState(true);
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [notificationSchedule, setNotificationSchedule] = useState("immediately");

  // Collapsible sections - All open by default for better visibility
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [agentCriteriaOpen, setAgentCriteriaOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  // Fetch counties and hot sheet data on mount
  useEffect(() => {
    const fetchCounties = async () => {
      const { data } = await supabase
        .from("counties")
        .select("id, name")
        .order("name");
      if (data) setCounties(data);
    };
    fetchCounties();

    // If editing, load the hot sheet data
    if (editMode && hotSheetId && open) {
      loadHotSheet();
    }
  }, [editMode, hotSheetId, open]);

  const loadHotSheet = async () => {
    try {
      const { data, error } = await supabase
        .from("hot_sheets")
        .select("*")
        .eq("id", hotSheetId)
        .single();

      if (error) throw error;
      if (!data) return;

      // Populate form fields
      setHotSheetName(data.name);
      const criteria = data.criteria as any;
      
      setListingNumbers(criteria.listingNumbers || "");
      setAddress(criteria.address || "");
      setPropertyTypes(criteria.propertyTypes || []);
      setStatuses(criteria.statuses || []);
      setMinPrice(criteria.minPrice?.toString() || "");
      setMaxPrice(criteria.maxPrice?.toString() || "");
      setBedrooms(criteria.bedrooms?.toString() || "");
      setBathrooms(criteria.bathrooms?.toString() || "");
      setRooms(criteria.rooms?.toString() || "");
      setAcres(criteria.acres?.toString() || "");
      setMinSqft(criteria.minSqft?.toString() || "");
      setMaxSqft(criteria.maxSqft?.toString() || "");
      setPricePerSqft(criteria.pricePerSqft?.toString() || "");
      setZipCode(criteria.zipCode || "");
      setSelectedCities(criteria.cities || []);
      setState(criteria.state || "");
      setClientFirstName(criteria.clientFirstName || "");
      setClientLastName(criteria.clientLastName || "");
      setClientEmail(criteria.clientEmail || "");
      setClientPhone(criteria.clientPhone || "");
      setPreferredCounties(criteria.preferredCounties || []);
      setRequiresBuyerIncentives(criteria.requiresBuyerIncentives || false);
      setNotifyClient(data.notify_client_email);
      setNotifyAgent(data.notify_agent_email);
      setNotificationSchedule(data.notification_schedule);
    } catch (error) {
      console.error("Error loading hot sheet:", error);
      toast.error("Failed to load hot sheet data");
    }
  };

  const propertyTypeOptions = [
    { value: "single_family", label: "Single Family (SF)" },
    { value: "condo", label: "Condominium (CC)" },
    { value: "multi_family", label: "Multi Family (MF)" },
    { value: "townhouse", label: "Townhouse (TH)" },
    { value: "land", label: "Land (LD)" },
    { value: "commercial", label: "Commercial (CI)" },
    { value: "business_opp", label: "Business Opp. (BU)" },
  ];

  const statusOptions = [
    { value: "new", label: "New (NEW)" },
    { value: "active", label: "Active (ACT)" },
    { value: "price_changed", label: "Price Changed (PCG)" },
    { value: "back_on_market", label: "Back on Market (BOM)" },
    { value: "extended", label: "Extended (EXT)" },
    { value: "reactivated", label: "Reactivated (RAC)" },
    { value: "contingent", label: "Contingent (CTG)" },
    { value: "under_agreement", label: "Under Agreement (UAG)" },
    { value: "sold", label: "Sold (SLD)" },
    { value: "rented", label: "Rented (RNT)" },
    { value: "temporarily_withdrawn", label: "Temporarily Withdrawn (WDN)" },
    { value: "expired", label: "Expired (EXP)" },
    { value: "canceled", label: "Canceled (CAN)" },
    { value: "coming_soon", label: "Coming Soon (CSO)" },
  ];

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  const toggleStatus = (value: string) => {
    setStatuses(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const toggleCounty = (countyId: string) => {
    setPreferredCounties(prev =>
      prev.includes(countyId) ? prev.filter(c => c !== countyId) : [...prev, countyId]
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const availableCities = [
    "Boston", "Cambridge", "Somerville", "Quincy", "Newton", "Brookline",
    "Waltham", "Medford", "Malden", "Revere", "Arlington", "Watertown",
    "Lexington", "Belmont", "Milton", "Dedham", "Needham", "Wellesley",
    "Framingham", "Natick", "Weston", "Wayland", "Lincoln", "Concord"
  ];

  const filteredCities = availableCities.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Fetch matching listings count
  useEffect(() => {
    const fetchMatchingCount = async () => {
      if (!open) return;
      
      try {
        let query = supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");

        if (propertyTypes.length > 0) {
          query = query.in("property_type", propertyTypes);
        }
        if (state) {
          query = query.eq("state", state);
        }
        if (selectedCities.length > 0) {
          query = query.in("city", selectedCities);
        }
        if (minPrice) {
          query = query.gte("price", parseFloat(minPrice));
        }
        if (maxPrice) {
          query = query.lte("price", parseFloat(maxPrice));
        }
        if (bedrooms) {
          query = query.gte("bedrooms", parseInt(bedrooms));
        }
        if (bathrooms) {
          query = query.gte("bathrooms", parseFloat(bathrooms));
        }
        if (minSqft) {
          query = query.gte("square_feet", parseInt(minSqft));
        }
        if (maxSqft) {
          query = query.lte("square_feet", parseInt(maxSqft));
        }

        const { count } = await query;
        setMatchingListingsCount(count || 0);
      } catch (error) {
        console.error("Error fetching matching count:", error);
      }
    };

    fetchMatchingCount();
  }, [open, propertyTypes, state, selectedCities, minPrice, maxPrice, bedrooms, bathrooms, minSqft, maxSqft]);

  const handleCreate = async () => {
    if (!hotSheetName.trim()) {
      toast.error("Please enter a hot sheet name");
      return;
    }
    
    if (!clientEmail.trim()) {
      toast.error("Please enter client email");
      return;
    }

    try {
      setSaving(true);

      const criteria = {
        listingNumbers: listingNumbers || null,
        address: address || null,
        propertyTypes: propertyTypes.length > 0 ? propertyTypes : null,
        statuses: statuses.length > 0 ? statuses : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        rooms: rooms ? parseInt(rooms) : null,
        acres: acres ? parseFloat(acres) : null,
        minSqft: minSqft ? parseInt(minSqft) : null,
        maxSqft: maxSqft ? parseInt(maxSqft) : null,
        pricePerSqft: pricePerSqft ? parseFloat(pricePerSqft) : null,
        zipCode: zipCode || null,
        cities: selectedCities.length > 0 ? selectedCities : null,
        state: state || null,
        // Agent criteria
        preferredCounties: preferredCounties.length > 0 ? preferredCounties : null,
        requiresBuyerIncentives: requiresBuyerIncentives || null,
        // Client information
        clientFirstName: clientFirstName || null,
        clientLastName: clientLastName || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        // Sale listing criteria
        listingAgreementTypes: listingAgreementTypes.length > 0 ? listingAgreementTypes : null,
        entryOnly,
        lenderOwned,
        shortSale,
        propertyStyles: propertyStyles.length > 0 ? propertyStyles : null,
        minYearBuilt: minYearBuilt ? parseInt(minYearBuilt) : null,
        maxYearBuilt: maxYearBuilt ? parseInt(maxYearBuilt) : null,
        minLotSize: minLotSize ? parseFloat(minLotSize) : null,
        maxLotSize: maxLotSize ? parseFloat(maxLotSize) : null,
        waterfront,
        waterView,
        beachNearby,
        facingDirection: facingDirection.length > 0 ? facingDirection : null,
        minFireplaces: minFireplaces ? parseInt(minFireplaces) : null,
        basement,
        minGarageSpaces: minGarageSpaces ? parseInt(minGarageSpaces) : null,
        minParkingSpaces: minParkingSpaces ? parseInt(minParkingSpaces) : null,
        constructionFeatures: constructionFeatures.length > 0 ? constructionFeatures : null,
        roofMaterials: roofMaterials.length > 0 ? roofMaterials : null,
        exteriorFeatures: exteriorFeatures.length > 0 ? exteriorFeatures : null,
        heatingTypes: heatingTypes.length > 0 ? heatingTypes : null,
        coolingTypes: coolingTypes.length > 0 ? coolingTypes : null,
        greenFeatures: greenFeatures.length > 0 ? greenFeatures : null,
      };

      if (editMode && hotSheetId) {
        // Update existing hot sheet
        const { error } = await supabase
          .from("hot_sheets")
          .update({
            name: hotSheetName,
            criteria,
            notify_client_email: notifyClient,
            notify_agent_email: notifyAgent,
            notification_schedule: notificationSchedule,
          })
          .eq("id", hotSheetId);

        if (error) throw error;

        toast.success("Hot sheet updated");
        onSuccess(hotSheetId);
      } else {
        // Create new hot sheet
        const { data: createdHotSheet, error } = await supabase
          .from("hot_sheets")
          .insert({
            user_id: userId,
            client_id: clientId || null,
            name: hotSheetName,
            criteria,
            is_active: true,
            notify_client_email: notifyClient,
            notify_agent_email: notifyAgent,
            notification_schedule: notificationSchedule,
          })
          .select()
          .single();

        if (error) throw error;

        toast.success("Hot sheet created");
        onSuccess(createdHotSheet.id);
      }
      
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating hot sheet:", error);
      toast.error("Failed to create hot sheet");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setHotSheetName("");
    setClientFirstName("");
    setClientLastName("");
    setClientEmail("");
    setClientPhone("");
    setListingNumbers("");
    setAddress("");
    setPropertyTypes([]);
    setStatuses([]);
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setBathrooms("");
    setRooms("");
    setAcres("");
    setMinSqft("");
    setMaxSqft("");
    setPricePerSqft("");
    setZipCode("");
    setSelectedCities([]);
    setCitySearch("");
    setState("");
    setPreferredCounties([]);
    setRequiresBuyerIncentives(false);
    setListingAgreementTypes([]);
    setEntryOnly(null);
    setLenderOwned(null);
    setShortSale(null);
    setPropertyStyles([]);
    setMinYearBuilt("");
    setMaxYearBuilt("");
    setMinLotSize("");
    setMaxLotSize("");
    setWaterfront(null);
    setWaterView(null);
    setBeachNearby(null);
    setFacingDirection([]);
    setMinFireplaces("");
    setBasement(null);
    setMinGarageSpaces("");
    setMinParkingSpaces("");
    setConstructionFeatures([]);
    setRoofMaterials([]);
    setExteriorFeatures([]);
    setHeatingTypes([]);
    setCoolingTypes([]);
    setGreenFeatures([]);
    setNotifyClient(true);
    setNotifyAgent(true);
    setNotificationSchedule("immediately");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Edit Hot Sheet" : "Create Hot Sheet"}{clientName ? ` for ${clientName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Set up search criteria and notification preferences for automatic listing alerts
          </DialogDescription>
          {matchingListingsCount > 0 && (
            <div className="mt-2 p-3 bg-primary/10 rounded-md">
              <p className="text-sm font-medium text-primary">
                {matchingListingsCount} {matchingListingsCount === 1 ? "property" : "properties"} match your current criteria
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Hot Sheet Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Hot Sheet Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Downtown Condos under $500k"
              value={hotSheetName}
              onChange={(e) => setHotSheetName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-first-name">First Name *</Label>
                  <Input
                    id="client-first-name"
                    placeholder="John"
                    value={clientFirstName}
                    onChange={(e) => setClientFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-last-name">Last Name *</Label>
                  <Input
                    id="client-last-name"
                    placeholder="Doe"
                    value={clientLastName}
                    onChange={(e) => setClientLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email *</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="john@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Phone (Optional)</Label>
                <Input
                  id="client-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Search Criteria */}
          <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-base">Search Criteria</CardTitle>
                  {criteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Listing Numbers */}
                  <div className="space-y-2">
                    <Label htmlFor="listing-numbers" className="text-sm font-semibold uppercase">List Number(s)</Label>
                    <Input
                      id="listing-numbers"
                      placeholder="Enter listing number(s)"
                      value={listingNumbers}
                      onChange={(e) => setListingNumbers(e.target.value)}
                    />
                  </div>

                  {/* Location Search */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-semibold uppercase">Location</Label>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          placeholder="Street address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Select value={state} onValueChange={setState}>
                            <SelectTrigger id="state" className="bg-background">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="MA">Massachusetts</SelectItem>
                              <SelectItem value="NY">New York</SelectItem>
                              <SelectItem value="CA">California</SelectItem>
                              <SelectItem value="FL">Florida</SelectItem>
                              <SelectItem value="TX">Texas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            placeholder="ZIP"
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            maxLength={10}
                          />
                        </div>
                      </div>

                      {/* Cities/Towns Dropdown */}
                      <div className="space-y-2">
                        <Label>Cities/Towns</Label>
                        <div className="border rounded-md p-3 space-y-3">
                          <Input
                            placeholder="Type city or town name..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="mb-2"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-2 border rounded p-2">
                            {filteredCities.map((city) => (
                              <div key={city} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`city-${city}`}
                                  checked={selectedCities.includes(city)}
                                  onCheckedChange={() => toggleCity(city)}
                                />
                                <Label htmlFor={`city-${city}`} className="cursor-pointer text-sm">
                                  {city}
                                </Label>
                              </div>
                            ))}
                          </div>
                          {selectedCities.length > 0 && (
                            <div className="pt-2 border-t">
                              <Label className="text-xs font-medium">Selected Cities:</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedCities.map((city) => (
                                  <span
                                    key={city}
                                    className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                                  >
                                    {city}
                                    <button
                                      type="button"
                                      onClick={() => toggleCity(city)}
                                      className="hover:text-primary/70"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Property Types */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold uppercase">Property Type</Label>
                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pt-select-all"
                            checked={propertyTypes.length === propertyTypeOptions.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPropertyTypes(propertyTypeOptions.map(opt => opt.value));
                              } else {
                                setPropertyTypes([]);
                              }
                            }}
                          />
                          <Label htmlFor="pt-select-all" className="cursor-pointer font-medium">
                            Select All
                          </Label>
                        </div>
                        {propertyTypeOptions.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`pt-${option.value}`}
                              checked={propertyTypes.includes(option.value)}
                              onCheckedChange={() => togglePropertyType(option.value)}
                            />
                            <Label htmlFor={`pt-${option.value}`} className="cursor-pointer text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold uppercase">Status</Label>
                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="st-select-all"
                            checked={statuses.length === statusOptions.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setStatuses(statusOptions.map(opt => opt.value));
                              } else {
                                setStatuses([]);
                              }
                            }}
                          />
                          <Label htmlFor="st-select-all" className="cursor-pointer font-medium">
                            Select All
                          </Label>
                        </div>
                        {statusOptions.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`st-${option.value}`}
                              checked={statuses.includes(option.value)}
                              onCheckedChange={() => toggleStatus(option.value)}
                            />
                            <Label htmlFor={`st-${option.value}`} className="cursor-pointer text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Standard Search Criteria */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-semibold uppercase">Standard Search Criteria</Label>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bedrooms">Bedrooms</Label>
                        <Input
                          id="bedrooms"
                          type="number"
                          placeholder="Any"
                          value={bedrooms}
                          onChange={(e) => setBedrooms(e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bathrooms">Total Bathrooms</Label>
                        <Input
                          id="bathrooms"
                          type="number"
                          step="0.5"
                          placeholder="Any"
                          value={bathrooms}
                          onChange={(e) => setBathrooms(e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rooms">Rooms</Label>
                        <Input
                          id="rooms"
                          type="number"
                          placeholder="Any"
                          value={rooms}
                          onChange={(e) => setRooms(e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acres">Acres</Label>
                        <Input
                          id="acres"
                          type="number"
                          step="0.01"
                          placeholder="Any"
                          value={acres}
                          onChange={(e) => setAcres(e.target.value)}
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-sqft">Living Area Total (SqFt) - Min</Label>
                        <FormattedInput
                          id="min-sqft"
                          format="number"
                          placeholder="0"
                          value={minSqft}
                          onChange={(value) => setMinSqft(value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price-per-sqft">Price per SqFt</Label>
                        <FormattedInput
                          id="price-per-sqft"
                          format="currency"
                          placeholder="Any"
                          value={pricePerSqft}
                          onChange={(value) => setPricePerSqft(value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-semibold">Price Range</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-price">Min Price</Label>
                        <FormattedInput
                          id="min-price"
                          format="currency"
                          placeholder="0"
                          value={minPrice}
                          onChange={(value) => setMinPrice(value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-price">Max Price</Label>
                        <FormattedInput
                          id="max-price"
                          format="currency"
                          placeholder="Any"
                          value={maxPrice}
                          onChange={(value) => setMaxPrice(value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Square Footage */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-semibold">Square Footage Range</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-sqft">Max Sq Ft</Label>
                        <FormattedInput
                          id="max-sqft"
                          format="number"
                          placeholder="Any"
                          value={maxSqft}
                          onChange={(value) => setMaxSqft(value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Agent Criteria */}
          <Collapsible open={agentCriteriaOpen} onOpenChange={setAgentCriteriaOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-base">Agent Preferences (Optional)</CardTitle>
                  {agentCriteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {/* Preferred Counties */}
                  <div className="space-y-2">
                    <Label>Preferred Agent Counties</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select counties where you prefer agents to be active
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {counties.map((county) => (
                        <div key={county.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`county-${county.id}`}
                            checked={preferredCounties.includes(county.id)}
                            onCheckedChange={() => toggleCounty(county.id)}
                          />
                          <Label htmlFor={`county-${county.id}`} className="cursor-pointer text-sm">
                            {county.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agent Incentives */}
                  <div className="space-y-2">
                    <Label>Agent Requirements</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="buyer-incentives"
                        checked={requiresBuyerIncentives}
                        onCheckedChange={(checked) => setRequiresBuyerIncentives(checked as boolean)}
                      />
                      <Label htmlFor="buyer-incentives" className="cursor-pointer">
                        Prefer agents offering buyer incentives
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Notification Settings */}
          <Collapsible open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-base">Notification Settings</CardTitle>
                  {notificationsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notify-agent"
                        checked={notifyAgent}
                        onCheckedChange={(checked) => setNotifyAgent(checked as boolean)}
                      />
                      <Label htmlFor="notify-agent" className="cursor-pointer">
                        Send notifications to me (agent)
                      </Label>
                    </div>

                    {clientId && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="notify-client"
                          checked={notifyClient}
                          onCheckedChange={(checked) => setNotifyClient(checked as boolean)}
                        />
                        <Label htmlFor="notify-client" className="cursor-pointer">
                          Send notifications to client
                        </Label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Notification Schedule</Label>
                    <RadioGroup value={notificationSchedule} onValueChange={setNotificationSchedule}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="immediately" id="immediately" />
                        <Label htmlFor="immediately" className="cursor-pointer">
                          Immediately - Get alerts as soon as matching listings appear
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="daily" id="daily" />
                        <Label htmlFor="daily" className="cursor-pointer">
                          Daily - Receive a daily digest of new matching listings
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="weekly" id="weekly" />
                        <Label htmlFor="weekly" className="cursor-pointer">
                          Weekly - Receive a weekly summary of new matching listings
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Hot Sheet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}