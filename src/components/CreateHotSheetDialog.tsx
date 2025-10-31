import { useState } from "react";
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
  onSuccess: () => void;
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
  
  // Notification settings
  const [notifyClient, setNotifyClient] = useState(true);
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [notificationSchedule, setNotificationSchedule] = useState("immediately");

  // Collapsible sections
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

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

  const handleCreate = async () => {
    if (!hotSheetName.trim()) {
      toast.error("Please enter a hot sheet name");
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
      };

      const { error } = await supabase.from("hot_sheets").insert({
        user_id: userId,
        client_id: clientId || null,
        name: hotSheetName,
        criteria,
        is_active: true,
        notify_client_email: notifyClient,
        notify_agent_email: notifyAgent,
        notification_schedule: notificationSchedule,
      });

      if (error) throw error;

      // Get the created hot sheet ID to process it
      const { data: createdHotSheet } = await supabase
        .from("hot_sheets")
        .select("id")
        .eq("user_id", userId)
        .eq("name", hotSheetName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Trigger initial batch send
      if (createdHotSheet) {
        await supabase.functions.invoke("process-hot-sheet", {
          body: {
            hotSheetId: createdHotSheet.id,
            sendInitialBatch: true,
          },
        });
      }

      toast.success(`Hot sheet created${clientName ? ` for ${clientName}` : ""}`);
      onSuccess();
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