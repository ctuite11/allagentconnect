import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Search, UserPlus, Users, Filter, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

interface SaveToHotSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedListingIds: string[];
  currentSearch?: {
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
    bathrooms?: number;
    property_type?: string;
    propertyTypes?: string[];
    city?: string;
    cities?: string[];
    state?: string;
    listing_type?: string;
    statuses?: string[];
    minSqft?: number;
    maxSqft?: number;
    zipCode?: string;
    [key: string]: any;
  };
}

const SaveToHotSheetDialog = ({ open, onOpenChange, selectedListingIds, currentSearch }: SaveToHotSheetDialogProps) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Client selection state
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Manual client entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualFirstName, setManualFirstName] = useState("");
  const [manualLastName, setManualLastName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Generate default name from search
  useEffect(() => {
    if (open && !name) {
      const parts: string[] = [];
      if (currentSearch?.cities?.length) {
        parts.push(currentSearch.cities[0]);
      } else if (currentSearch?.city) {
        parts.push(currentSearch.city);
      }
      if (currentSearch?.propertyTypes?.length) {
        const typeLabel = currentSearch.propertyTypes[0]?.replace(/_/g, ' ');
        if (typeLabel) parts.push(typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) + 's');
      }
      if (currentSearch?.bedrooms) {
        parts.push(`${currentSearch.bedrooms}+ Bed`);
      }
      if (parts.length > 0) {
        setName(parts.join(' – '));
      }
    }
  }, [open, currentSearch]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedClients([]);
      setClientSearchQuery("");
      setClientSearchResults([]);
      setShowClientDropdown(false);
      setShowManualEntry(false);
      setManualFirstName("");
      setManualLastName("");
      setManualEmail("");
      setManualPhone("");
    }
  }, [open]);

  // Search clients as user types
  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearchQuery || clientSearchQuery.length < 2 || !open) {
        setClientSearchResults([]);
        setShowClientDropdown(false);
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("clients")
          .select("id, first_name, last_name, email, phone")
          .eq("agent_id", user.id)
          .or(`first_name.ilike.%${clientSearchQuery}%,last_name.ilike.%${clientSearchQuery}%,email.ilike.%${clientSearchQuery}%`)
          .order("first_name")
          .limit(10);
        
        if (error) throw error;
        
        // Filter out already selected clients
        const filtered = (data || []).filter(
          client => !selectedClients.some(sc => sc.id === client.id)
        );
        
        setClientSearchResults(filtered);
        setShowClientDropdown(filtered.length > 0);
      } catch (error: any) {
        console.error("Error searching clients:", error);
        setClientSearchResults([]);
      }
    };
    
    const timer = setTimeout(searchClients, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, open, selectedClients]);

  const handleSelectClient = (client: Client) => {
    setSelectedClients(prev => [...prev, client]);
    setClientSearchQuery("");
    setShowClientDropdown(false);
    toast.success(`Added: ${client.first_name} ${client.last_name}`);
  };

  const handleRemoveClient = (clientId: string) => {
    setSelectedClients(prev => prev.filter(c => c.id !== clientId));
  };

  const handleAddManualClient = async () => {
    if (!manualFirstName.trim() || !manualEmail.trim()) {
      toast.error("First name and email are required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in");
        return;
      }

      // Check if client with this email already exists
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone")
        .eq("agent_id", user.id)
        .eq("email", manualEmail.toLowerCase().trim())
        .single();

      if (existingClient) {
        // Use existing client
        if (selectedClients.some(c => c.id === existingClient.id)) {
          toast.error("This client is already added");
        } else {
          setSelectedClients(prev => [...prev, existingClient]);
          toast.success(`Added existing contact: ${existingClient.first_name} ${existingClient.last_name}`);
        }
      } else {
        // Create new client
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert({
            agent_id: user.id,
            first_name: manualFirstName.trim(),
            last_name: manualLastName.trim() || "",
            email: manualEmail.toLowerCase().trim(),
            phone: manualPhone ? formatPhoneNumber(manualPhone) : null,
          })
          .select("id, first_name, last_name, email, phone")
          .single();

        if (error) throw error;

        if (newClient) {
          setSelectedClients(prev => [...prev, newClient]);
          toast.success(`Created and added: ${newClient.first_name} ${newClient.last_name}`);
        }
      }

      // Reset manual entry form
      setManualFirstName("");
      setManualLastName("");
      setManualEmail("");
      setManualPhone("");
      setShowManualEntry(false);
    } catch (error: any) {
      console.error("Error adding client:", error);
      toast.error("Failed to add client");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for this hot sheet");
      return;
    }

    if (selectedListingIds.length === 0) {
      toast.error("No properties selected");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to save hot sheets");
        setLoading(false);
        return;
      }

      // Build criteria from current search (preserve full snapshot)
      const criteria = {
        ...(currentSearch || {}),
        // Ensure key fields are present
        minPrice: currentSearch?.min_price || currentSearch?.minPrice || null,
        maxPrice: currentSearch?.max_price || currentSearch?.maxPrice || null,
        bedrooms: currentSearch?.bedrooms || null,
        bathrooms: currentSearch?.bathrooms || null,
        propertyTypes: currentSearch?.propertyTypes || (currentSearch?.property_type ? [currentSearch.property_type] : []),
        cities: currentSearch?.cities || (currentSearch?.city ? [currentSearch.city] : []),
        state: currentSearch?.state || null,
        statuses: currentSearch?.statuses || [],
        listing_type: currentSearch?.listing_type || "for_sale",
        // Store selected listing IDs in criteria
        selectedListingIds: selectedListingIds,
      };

      // Create hot sheet
      const { data: createdHotSheet, error } = await supabase
        .from("hot_sheets")
        .insert({
          user_id: user.id,
          name: name.trim(),
          criteria,
          is_active: true,
          notify_client_email: selectedClients.length > 0,
          notify_agent_email: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert client associations
      if (createdHotSheet && selectedClients.length > 0) {
        const clientAssociations = selectedClients.map((client, index) => ({
          hot_sheet_id: createdHotSheet.id,
          client_id: client.id,
        }));

        const { error: clientError } = await supabase
          .from('hot_sheet_clients' as any)
          .insert(clientAssociations);

        if (clientError) {
          console.error("Error associating clients:", clientError);
          // Don't fail the whole operation
        }
      }

      toast.success("Hot sheet saved successfully!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving hot sheet:", error);
      toast.error("Failed to save hot sheet");
    } finally {
      setLoading(false);
    }
  };

  // Build filter summary for display
  const getFilterSummary = () => {
    const items: string[] = [];
    
    if (currentSearch?.propertyTypes?.length) {
      items.push(`Types: ${currentSearch.propertyTypes.join(", ")}`);
    } else if (currentSearch?.property_type) {
      items.push(`Type: ${currentSearch.property_type}`);
    }
    
    if (currentSearch?.statuses?.length) {
      items.push(`Status: ${currentSearch.statuses.join(", ")}`);
    }
    
    if (currentSearch?.cities?.length) {
      items.push(`Cities: ${currentSearch.cities.slice(0, 3).join(", ")}${currentSearch.cities.length > 3 ? ` +${currentSearch.cities.length - 3}` : ""}`);
    } else if (currentSearch?.city) {
      items.push(`City: ${currentSearch.city}`);
    }
    
    if (currentSearch?.state) {
      items.push(`State: ${currentSearch.state}`);
    }
    
    const minPrice = currentSearch?.min_price || currentSearch?.minPrice;
    const maxPrice = currentSearch?.max_price || currentSearch?.maxPrice;
    if (minPrice || maxPrice) {
      const priceStr = minPrice && maxPrice 
        ? `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`
        : minPrice 
          ? `$${minPrice.toLocaleString()}+`
          : `Up to $${maxPrice?.toLocaleString()}`;
      items.push(priceStr);
    }
    
    if (currentSearch?.bedrooms) {
      items.push(`${currentSearch.bedrooms}+ beds`);
    }
    
    if (currentSearch?.bathrooms) {
      items.push(`${currentSearch.bathrooms}+ baths`);
    }
    
    return items;
  };

  const filterSummary = getFilterSummary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold">
            Save Hotsheet
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-5">
          {/* Section 1: Hotsheet Name */}
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Hotsheet Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Boston Waterfront Condos – 2+ Bed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
          </div>

          <Separator />

          {/* Section 2: Contacts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Contacts
              </Label>
              {selectedClients.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedClients.length} contact{selectedClients.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Attach one or more contacts to track interest for this hotsheet.
            </p>

            {/* Selected Clients */}
            {selectedClients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedClients.map((client) => (
                  <Badge
                    key={client.id}
                    variant="outline"
                    className="pl-2 pr-1 py-1 flex items-center gap-1 bg-background"
                  >
                    <span className="text-sm">
                      {client.first_name} {client.last_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveClient(client.id)}
                      className="ml-1 p-0.5 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Client Search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              {/* Search Dropdown */}
              {showClientDropdown && clientSearchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {clientSearchResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className="w-full px-3 py-2 text-left hover:bg-muted flex flex-col"
                    >
                      <span className="font-medium text-sm">
                        {client.first_name} {client.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {client.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Contact Toggle */}
            {!showManualEntry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowManualEntry(true)}
                className="text-primary hover:text-primary/80 p-0 h-auto"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add new contact
              </Button>
            ) : (
              <div className="space-y-3 p-3 border border-border rounded-lg bg-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">New Contact</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowManualEntry(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name *"
                    value={manualFirstName}
                    onChange={(e) => setManualFirstName(e.target.value)}
                    className="h-9"
                  />
                  <Input
                    placeholder="Last name"
                    value={manualLastName}
                    onChange={(e) => setManualLastName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Input
                  placeholder="Email *"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="h-9"
                />
                <Input
                  placeholder="Phone (optional)"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddManualClient}
                  className="w-full"
                >
                  Add Contact
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Section 3: Selected Properties */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              Selected Properties
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm font-semibold">
                {selectedListingIds.length}
              </Badge>
              <span className="text-sm text-foreground">
                {selectedListingIds.length === 1 ? 'property' : 'properties'} selected
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              These properties will be saved to the hotsheet.
            </p>
          </div>

          <Separator />

          {/* Section 4: Saved Search Preferences */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Saved Search Preferences
            </Label>
            <p className="text-sm text-muted-foreground">
              The current search criteria will be saved with this hotsheet for reference.
            </p>
            {filterSummary.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filterSummary.map((item, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs bg-muted"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No additional filters applied
              </p>
            )}
          </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white"
          >
            {loading ? "Saving..." : "Save Hotsheet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveToHotSheetDialog;
