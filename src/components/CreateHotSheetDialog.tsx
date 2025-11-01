import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
}

export function CreateHotSheetDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  userId,
  onSuccess,
}: CreateHotSheetDialogProps) {
  const [hotSheetName, setHotSheetName] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Client information
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  
  // Search criteria
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MA");
  
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

  // Collapsible sections
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [agentCriteriaOpen, setAgentCriteriaOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  // Fetch counties on mount
  useEffect(() => {
    const fetchCounties = async () => {
      const { data } = await supabase
        .from("counties")
        .select("id, name")
        .order("name");
      if (data) setCounties(data);
    };
    fetchCounties();
  }, []);

  const propertyTypeOptions = [
    { value: "single_family", label: "Single Family" },
    { value: "condo", label: "Condo" },
    { value: "multi_family", label: "Multi Family" },
    { value: "townhouse", label: "Townhouse" },
    { value: "land", label: "Land" },
  ];

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "price_changed", label: "Price Changed" },
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
        propertyTypes: propertyTypes.length > 0 ? propertyTypes : null,
        statuses: statuses.length > 0 ? statuses : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        minSqft: minSqft ? parseInt(minSqft) : null,
        maxSqft: maxSqft ? parseInt(maxSqft) : null,
        zipCode: zipCode || null,
        city: city || null,
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
    setPropertyTypes([]);
    setStatuses([]);
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setBathrooms("");
    setMinSqft("");
    setMaxSqft("");
    setZipCode("");
    setCity("");
    setState("MA");
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
            Create Hot Sheet{clientName ? ` for ${clientName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Set up search criteria and notification preferences for automatic listing alerts
          </DialogDescription>
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
                <CardContent className="space-y-4">
                  {/* Property Types */}
                  <div className="space-y-2">
                    <Label>Property Types</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyTypeOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`pt-${option.value}`}
                            checked={propertyTypes.includes(option.value)}
                            onCheckedChange={() => togglePropertyType(option.value)}
                          />
                          <Label htmlFor={`pt-${option.value}`} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`st-${option.value}`}
                            checked={statuses.includes(option.value)}
                            onCheckedChange={() => toggleStatus(option.value)}
                          />
                          <Label htmlFor={`st-${option.value}`} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-price">Min Price</Label>
                      <Input
                        id="min-price"
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-price">Max Price</Label>
                      <Input
                        id="max-price"
                        type="number"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Bedrooms & Bathrooms */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bedrooms">Min Bedrooms</Label>
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
                      <Label htmlFor="bathrooms">Min Bathrooms</Label>
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
                  </div>

                  {/* Square Footage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-sqft">Min Sq Ft</Label>
                      <Input
                        id="min-sqft"
                        type="number"
                        placeholder="0"
                        value={minSqft}
                        onChange={(e) => setMinSqft(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-sqft">Max Sq Ft</Label>
                      <Input
                        id="max-sqft"
                        type="number"
                        placeholder="Any"
                        value={maxSqft}
                        onChange={(e) => setMaxSqft(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="Any"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger id="state">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MA">MA</SelectItem>
                          <SelectItem value="NY">NY</SelectItem>
                          <SelectItem value="CA">CA</SelectItem>
                          <SelectItem value="FL">FL</SelectItem>
                          <SelectItem value="TX">TX</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">Zip Code</Label>
                      <Input
                        id="zip"
                        placeholder="Any"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                      />
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