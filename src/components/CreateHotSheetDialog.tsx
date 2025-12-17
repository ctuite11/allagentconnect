import React, { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { z } from "zod";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Client information
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [existingClient, setExistingClient] = useState<any>(null);
  const [internalClientId, setClientId] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
  }>>([]);
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    hotSheetName?: string;
    clientFirstName?: string;
    clientLastName?: string;
    clientEmail?: string;
    clientPhone?: string;
  }>({});
  
  // Search criteria
  const [listingNumbers, setListingNumbers] = useState("");
  const [address, setAddress] = useState("");
  const [addressMode, setAddressMode] = useState<"street" | "mylocation">("street");
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("");

  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [hasNoMin, setHasNoMin] = useState(false);
  const [hasNoMax, setHasNoMax] = useState(false);
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [rooms, setRooms] = useState("");
  const [acres, setAcres] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [pricePerSqft, setPricePerSqft] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Towns / coverage areas
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [multiTownInput, setMultiTownInput] = useState("");
  const [state, setState] = useState("MA");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("all");
  const [showAreas, setShowAreas] = useState<boolean>(true);

  // Live results counter
  const [matchingListingsCount, setMatchingListingsCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState(false);
  
  const [counties, setCounties] = useState<Array<{ id: string; name: string; state: string }>>([]);
  
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
  const [hasParking, setHasParking] = useState<boolean | null>(null);
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

  // Collapsible sections - Towns, Property Type, Status collapsed by default
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [clientInfoOpen, setClientInfoOpen] = useState(true);
  const [townsOpen, setTownsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  
  // Add another contact modal
  const [showAddAnotherContactModal, setShowAddAnotherContactModal] = useState(false);
  const [createdHotSheetId, setCreatedHotSheetId] = useState<string | null>(null);

  // Fetch hot sheet data on mount if editing
  useEffect(() => {
    // If editing, load the hot sheet data
    if (editMode && hotSheetId && open) {
      loadHotSheet();
    }
  }, [editMode, hotSheetId, open]);

  // Fetch client data if clientId is provided
  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId || !open) return;
      
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setClientFirstName(data.first_name || "");
          setClientLastName(data.last_name || "");
          setClientEmail(data.email || "");
          setClientPhone(data.phone ? formatPhoneNumber(data.phone) : "");
          setExistingClient(data);
          setClientSearchQuery(`${data.first_name} ${data.last_name}`);
        }
      } catch (error: any) {
        console.error("Error fetching client:", error);
      }
    };
    
    fetchClient();
  }, [clientId, open]);

  // Search clients as user types
  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearchQuery || clientSearchQuery.length < 2 || !open) {
        setClientSearchResults([]);
        setShowClientDropdown(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("agent_id", userId)
          .or(`first_name.ilike.%${clientSearchQuery}%,last_name.ilike.%${clientSearchQuery}%,email.ilike.%${clientSearchQuery}%`)
          .order("first_name")
          .limit(10);
        
        if (error) throw error;
        
        setClientSearchResults(data || []);
        setShowClientDropdown((data || []).length > 0);
      } catch (error: any) {
        console.error("Error searching clients:", error);
        setClientSearchResults([]);
      }
    };
    
    // Debounce the search
    const timer = setTimeout(searchClients, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, userId, open]);

  const handleSelectClient = (client: any) => {
    // Check if client is already selected
    if (selectedClients.some(c => c.id === client.id)) {
      toast.error("This client is already added");
      return;
    }
    
    // Add to selected clients
    setSelectedClients(prev => [...prev, {
      id: client.id,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone
    }]);
    
    // Clear search and form
    setClientSearchQuery("");
    setClientFirstName("");
    setClientLastName("");
    setClientEmail("");
    setClientPhone("");
    setExistingClient(null);
    setShowClientDropdown(false);
    
    toast.success(`Added client: ${client.first_name} ${client.last_name}`);
  };

  const handleRemoveClient = (clientId: string) => {
    setSelectedClients(prev => prev.filter(c => c.id !== clientId));
    toast.success("Client removed");
  };

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
      
      // Load all the criteria fields
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
      // Normalize loaded state to 2-letter code, default to MA
      const loadedState = criteria.state as string | undefined;
      const normalizedState = loadedState && loadedState.length > 2
        ? (US_STATES.find(s => s.name === loadedState)?.code ?? loadedState)
        : (loadedState || "MA");
      setState(normalizedState);
      
      // Load notification settings
      setNotifyClient(data.notify_client_email);
      setNotifyAgent(data.notify_agent_email);
      setNotificationSchedule(data.notification_schedule);

      // Load associated clients from hot_sheet_clients table
      const { data: hotSheetClients } = await supabase
        .from('hot_sheet_clients' as any)
        .select(`
          client_id,
          clients (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('hot_sheet_id', hotSheetId);

      if (hotSheetClients && hotSheetClients.length > 0) {
        const clients = hotSheetClients
          .map((hsc: any) => {
            const client = hsc.clients;
            if (Array.isArray(client)) {
              return client[0];
            }
            return client;
          })
          .filter((client: any): client is NonNullable<typeof client> => client !== null);
        
        setSelectedClients(clients);
      }

      // Load additional criteria fields
      setListingAgreementTypes(criteria.listingAgreementTypes || []);
      setEntryOnly(criteria.entryOnly ?? null);
      setLenderOwned(criteria.lenderOwned ?? null);
      setShortSale(criteria.shortSale ?? null);
      setPropertyStyles(criteria.propertyStyles || []);
      setMinYearBuilt(criteria.minYearBuilt?.toString() || "");
      setMaxYearBuilt(criteria.maxYearBuilt?.toString() || "");
      setMinLotSize(criteria.minLotSize?.toString() || "");
      setMaxLotSize(criteria.maxLotSize?.toString() || "");
      setWaterfront(criteria.waterfront ?? null);
      setWaterView(criteria.waterView ?? null);
      setBeachNearby(criteria.beachNearby ?? null);
      setFacingDirection(criteria.facingDirection || []);
      setMinFireplaces(criteria.minFireplaces?.toString() || "");
      setBasement(criteria.basement ?? null);
      setHasParking(criteria.hasParking ?? null);
      setMinGarageSpaces(criteria.minGarageSpaces?.toString() || "");
      setMinParkingSpaces(criteria.minParkingSpaces?.toString() || "");
      setConstructionFeatures(criteria.constructionFeatures || []);
      setRoofMaterials(criteria.roofMaterials || []);
      setExteriorFeatures(criteria.exteriorFeatures || []);
      setHeatingTypes(criteria.heatingTypes || []);
      setCoolingTypes(criteria.coolingTypes || []);
      setGreenFeatures(criteria.greenFeatures || []);

      // ... rest of criteria loading
    } catch (error: any) {
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

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  const selectAllTowns = () => {
    const allSelections = [...townsList];
    
    // If showAreas is enabled, include all neighborhoods for each town
    if (showAreas) {
      const stateKey = state && state.length > 2 
        ? (US_STATES.find(s => s.name.toLowerCase() === state.toLowerCase())?.code ?? state)
        : state?.toUpperCase();

      townsList.forEach(town => {
        // Skip if this is already a neighborhood entry
        if (town.includes('-')) return;
        
        // Get neighborhoods from the data
        const hasNeighborhoods = hasNeighborhoodData(town, stateKey || state);
        let neighborhoods = hasNeighborhoods ? getAreasForCity(town, stateKey || state) : [];
        
        // Also check for hyphenated neighborhoods in the towns list
        if ((neighborhoods?.length ?? 0) === 0) {
          neighborhoods = Array.from(new Set(
            townsList
              .filter((t) => t.startsWith(`${town}-`))
              .map((t) => t.split('-').slice(1).join('-'))
          ));
        }
        
        // Add all neighborhoods for this town
        neighborhoods?.forEach(neighborhood => {
          allSelections.push(`${town}-${neighborhood}`);
        });
      });
      
      setSelectedCities(allSelections);
      toast.success(`Selected all ${allSelections.length} towns and neighborhoods`);
    } else {
      setSelectedCities(allSelections);
      toast.success(`Selected all ${allSelections.length} towns`);
    }
  };

  const handleAddMultipleTowns = () => {
    if (!multiTownInput.trim()) {
      toast.error("Please enter at least one town name");
      return;
    }

    // Split by comma, semicolon, or newline and trim each entry
    const inputTowns = multiTownInput
      .split(/[,;\n]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const addedTowns: string[] = [];
    const notFoundTowns: string[] = [];

    inputTowns.forEach(inputTown => {
      // Try to find matching town (case-insensitive, partial match)
      const matchedTown = townsList.find(town => 
        town.toLowerCase().includes(inputTown.toLowerCase())
      );

      if (matchedTown) {
        if (!selectedCities.includes(matchedTown)) {
          addedTowns.push(matchedTown);
        }
      } else {
        notFoundTowns.push(inputTown);
      }
    });

    // Add the matched towns to selection
    if (addedTowns.length > 0) {
      setSelectedCities(prev => [...prev, ...addedTowns]);
    }

    // Provide feedback
    if (addedTowns.length > 0 && notFoundTowns.length === 0) {
      toast.success(`Added ${addedTowns.length} town(s) to selected areas`);
      setMultiTownInput("");
    } else if (addedTowns.length > 0 && notFoundTowns.length > 0) {
      toast.success(`Added ${addedTowns.length} town(s). Not found: ${notFoundTowns.join(", ")}`);
      setMultiTownInput("");
    } else {
      toast.error(`No matching towns found for: ${notFoundTowns.join(", ")}`);
    }
  };

  // Get counties for the selected state from COUNTIES_BY_STATE
  const countiesForState = state && COUNTIES_BY_STATE[state]
    ? COUNTIES_BY_STATE[state].map(name => ({ id: name, name, state }))
    : [];

  // Use the shared towns picker hook
  const { townsList, expandedCities, toggleCityExpansion } = useTownsPicker({
    state,
    county: selectedCountyId,
    showAreas
  });

  // Fetch matching listings count
  useEffect(() => {
    const fetchMatchingCount = async () => {
      if (!open) return;
      
      setLoadingCount(true);
      try {
        // Build criteria object in the same format as SearchResults/HotSheetReview
        const criteria = {
          propertyTypes, // UI codes like "single_family" - will be mapped to DB values
          statuses: statuses.length > 0 ? statuses : undefined,
          cities: selectedCities,
          state,
          zipCode,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
          bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
          minSqft: minSqft ? parseInt(minSqft) : undefined,
          maxSqft: maxSqft ? parseInt(maxSqft) : undefined,
        };

        // Use buildListingsQuery to get the full query, then count the results
        // Since we can't get count directly from the query (select is already called),
        // we fetch IDs and count them
        const { data, error } = await buildListingsQuery(supabase, criteria).limit(1000);
        
        if (error) throw error;
        
        setMatchingListingsCount(data?.length || 0);
      } catch (error) {
        console.error("Error fetching matching count:", error);
      } finally {
        setLoadingCount(false);
      }
    };

    // Debounce the fetch to avoid too many requests
    const timeoutId = setTimeout(fetchMatchingCount, 300);
    return () => clearTimeout(timeoutId);
  }, [
    open,
    statuses,
    propertyTypes,
    state,
    selectedCities,
    zipCode,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    minSqft,
    maxSqft,
  ]);

  // Reset search input when state or county changes
  useEffect(() => {
    setCitySearch("");
  }, [state, selectedCountyId]);

  // Validation schema
  const hotSheetSchema = z.object({
    hotSheetName: z.string()
      .trim()
      .min(1, "Hot sheet name is required")
      .max(100, "Hot sheet name must be less than 100 characters"),
    clientFirstName: z.string()
      .trim()
      .min(1, "Client first name is required")
      .max(100, "First name must be less than 100 characters"),
    clientLastName: z.string()
      .trim()
      .min(1, "Client last name is required")
      .max(100, "Last name must be less than 100 characters"),
    clientEmail: z.string()
      .trim()
      .min(1, "Client email is required")
      .email("Invalid email address")
      .max(255, "Email must be less than 255 characters"),
    clientPhone: z.string()
      .trim()
      .optional()
      .refine((val) => {
        if (!val || val.length === 0) return true;
        // Remove formatting and check if it's a valid 10-digit US phone
        const digitsOnly = val.replace(/\D/g, '');
        return digitsOnly.length === 10 || digitsOnly.length === 11;
      }, "Invalid phone number (must be 10 digits)")
  });

  const handleValidateAndShowConfirmation = async () => {
    // Clear previous errors
    setErrors({});
    
    // Check if at least one client is selected
    if (selectedClients.length === 0 && !clientFirstName && !clientEmail) {
      toast.error("Please add at least one client");
      return;
    }

    // If there's client data in the form but not added to list, validate and offer to add
    if (clientFirstName || clientEmail) {
      // Validate the pending client
      const validation = hotSheetSchema.safeParse({
        hotSheetName,
        clientFirstName,
        clientLastName,
        clientEmail,
        clientPhone
      });
      
      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error("Please fix the validation errors or clear the client form");
        return;
      }

      // Check if this client exists or needs to be created
      if (!existingClient && clientFirstName && clientEmail) {
        setShowCreateClientDialog(true);
        return;
      }
    }

    // Validate hot sheet name
    if (!hotSheetName || hotSheetName.trim().length === 0) {
      setErrors({ hotSheetName: "Hot sheet name is required" });
      toast.error("Hot sheet name is required");
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleAddClientWithoutSaving = () => {
    // Add client to hot sheet without saving to database
    setSelectedClients(prev => [...prev, {
      id: `temp-${Date.now()}`, // Temporary ID for unsaved clients
      first_name: clientFirstName.trim(),
      last_name: clientLastName.trim(),
      email: clientEmail.toLowerCase().trim(),
      phone: clientPhone ? formatPhoneNumber(clientPhone) : null
    }]);
    
    setShowCreateClientDialog(false);
    toast.success("Client added to hot sheet (not saved to your contacts)");
    
    // Clear the form
    setClientFirstName("");
    setClientLastName("");
    setClientEmail("");
    setClientPhone("");
    setExistingClient(null);
    setClientSearchQuery("");
    
    // Collapse client info
    setClientInfoOpen(false);
  };

  const handleCreateClient = async () => {
    setCreatingClient(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          agent_id: userId,
          first_name: clientFirstName.trim(),
          last_name: clientLastName.trim(),
          email: clientEmail.toLowerCase().trim(),
          phone: clientPhone ? formatPhoneNumber(clientPhone) : null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Add newly created client to selected clients
        setSelectedClients(prev => [...prev, {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone
        }]);
        
        // Clear the form
        setClientFirstName("");
        setClientLastName("");
        setClientEmail("");
        setClientPhone("");
        setExistingClient(null);
        setClientSearchQuery("");
      }
      setShowCreateClientDialog(false);
      toast.success("Client saved and added to hot sheet");
      
      // Clear the form
      setClientFirstName("");
      setClientLastName("");
      setClientEmail("");
      setClientPhone("");
      setExistingClient(null);
      setClientSearchQuery("");
      
      // Collapse client info
      setClientInfoOpen(false);
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast.error(error?.message || "Failed to create client");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleCreate = async () => {
    setShowConfirmDialog(false);

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
        selectedCountyId: selectedCountyId && selectedCountyId !== "all" ? selectedCountyId : null,
        // Client information
        clientFirstName: clientFirstName || null,
        clientLastName: clientLastName || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone ? formatPhoneNumber(clientPhone) : null,
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
        hasParking,
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

        // Update clients in hot_sheet_clients junction table
        if (selectedClients.length > 0) {
          // Delete existing relationships
          const { error: deleteError } = await supabase
            .from('hot_sheet_clients' as any)
            .delete()
            .eq('hot_sheet_id', hotSheetId);

          if (deleteError) throw deleteError;

          // Insert new relationships
          const { error: insertError } = await supabase
            .from('hot_sheet_clients' as any)
            .insert(
              selectedClients.map(client => ({
                hot_sheet_id: hotSheetId,
                client_id: client.id
              }))
            );

          if (insertError) throw insertError;
        }

        toast.success("Hot sheet updated");
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess(hotSheetId);
          onOpenChange(false);
          resetForm();
        }, 1500);
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

        // Insert clients into hot_sheet_clients junction table
        if (selectedClients.length > 0 && createdHotSheet) {
          const { error: clientError } = await supabase
            .from('hot_sheet_clients' as any)
            .insert(
              selectedClients.map(client => ({
                hot_sheet_id: createdHotSheet.id,
                client_id: client.id
              }))
            );

          if (clientError) throw clientError;
        }

        toast.success("Hot sheet created successfully!");
        setShowSuccess(true);
        setCreatedHotSheetId(createdHotSheet.id);
        // Show add another contact modal
        setTimeout(() => {
          setShowSuccess(false);
          setShowAddAnotherContactModal(true);
        }, 1000);
      }
    } catch (error: any) {
      console.error("Error creating hot sheet:", error);
      toast.error(error?.message ? `Failed to create hot sheet: ${error.message}` : "Failed to create hot sheet");
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
    setExistingClient(null);
    
    setClientSearchQuery("");
    setClientSearchResults([]);
    setShowClientDropdown(false);
    setClientInfoOpen(true);
    setSelectedClients([]);
    setShowCreateClientDialog(false);
    setCreatingClient(false);
    setErrors({});
    setShowConfirmDialog(false);
    setShowSuccess(false);
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
    setHasParking(null);
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
          <div className="mt-2 p-3 bg-white border border-neutral-200 rounded-md">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Matching Listings:</span>
              {loadingCount ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-primary">
                  {matchingListingsCount} {matchingListingsCount === 1 ? "property" : "properties"}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hot Sheet Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Hot Sheet Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Downtown Condos under $500k"
              value={hotSheetName}
              onChange={(e) => {
                setHotSheetName(e.target.value);
                if (errors.hotSheetName) {
                  setErrors(prev => ({ ...prev, hotSheetName: undefined }));
                }
              }}
              maxLength={100}
              className={errors.hotSheetName ? "border-destructive" : ""}
            />
            {errors.hotSheetName && (
              <p className="text-sm text-destructive">{errors.hotSheetName}</p>
            )}
          </div>

          {/* Contact Information */}
          <Collapsible open={clientInfoOpen} onOpenChange={setClientInfoOpen}>
            <Card className={`border ${clientInfoOpen ? 'border-neutral-300' : 'border-border'}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Contact Information *
                      {selectedClients.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-green-600">
                          ✓ {selectedClients.length} {selectedClients.length === 1 ? 'contact' : 'contacts'}
                        </span>
                      )}
                    </CardTitle>
                    {clientInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
              {/* Selected Contacts List */}
              {selectedClients.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Contacts ({selectedClients.length})</Label>
                  <div className="space-y-2 p-3 bg-white rounded-md border border-neutral-200">
                    {selectedClients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-2 bg-white rounded border border-neutral-200">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {client.first_name} {client.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                          {client.phone && (
                            <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClient(client.id)}
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Search */}
              <div className="space-y-2 relative">
                <Label htmlFor="client-search">Search Existing Contact</Label>
                <Input
                  id="client-search"
                  placeholder="Search by name or email..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (clientSearchResults.length > 0) {
                      setShowClientDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown items
                    setTimeout(() => setShowClientDropdown(false), 200);
                  }}
                />
                {showClientDropdown && clientSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {clientSearchResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <div className="font-medium text-sm">
                          {client.first_name} {client.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                        {client.phone && (
                          <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {existingClient && (
                  <p className="text-sm text-muted-foreground">
                    Found existing contact - fields auto-filled
                  </p>
                )}
              </div>

              <Separator />

              <p className="text-sm text-muted-foreground">Or add a new contact manually:</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-first-name">First Name *</Label>
                  <Input
                    id="client-first-name"
                    placeholder="John"
                    value={clientFirstName}
                    onChange={(e) => {
                      setClientFirstName(e.target.value);
                      if (errors.clientFirstName) {
                        setErrors(prev => ({ ...prev, clientFirstName: undefined }));
                      }
                    }}
                    className={errors.clientFirstName ? "border-destructive" : ""}
                  />
                  {existingClient && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Existing contact found
                    </p>
                  )}
                  {errors.clientFirstName && (
                    <p className="text-sm text-destructive">{errors.clientFirstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-last-name">Last Name *</Label>
                  <Input
                    id="client-last-name"
                    placeholder="Doe"
                    value={clientLastName}
                    onChange={(e) => {
                      setClientLastName(e.target.value);
                      if (errors.clientLastName) {
                        setErrors(prev => ({ ...prev, clientLastName: undefined }));
                      }
                    }}
                    className={errors.clientLastName ? "border-destructive" : ""}
                  />
                  {errors.clientLastName && (
                    <p className="text-sm text-destructive">{errors.clientLastName}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email *</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="john@example.com"
                  value={clientEmail}
                  onChange={(e) => {
                    setClientEmail(e.target.value);
                    if (errors.clientEmail) {
                      setErrors(prev => ({ ...prev, clientEmail: undefined }));
                    }
                  }}
                  className={errors.clientEmail ? "border-destructive" : ""}
                />
                {errors.clientEmail && (
                  <p className="text-sm text-destructive">{errors.clientEmail}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Phone (Optional)</Label>
                <FormattedInput
                  id="client-phone"
                  format="phone"
                  placeholder="1234567890"
                  value={clientPhone}
                  onChange={(value) => {
                    setClientPhone(value);
                    if (errors.clientPhone) {
                      setErrors(prev => ({ ...prev, clientPhone: undefined }));
                    }
                  }}
                  className={errors.clientPhone ? "border-destructive" : ""}
                />
                {errors.clientPhone && (
                  <p className="text-sm text-destructive">{errors.clientPhone}</p>
                )}
              </div>

              {/* Add Contact Button */}
              {(clientFirstName || clientLastName || clientEmail || clientPhone) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!existingClient) {
                      setShowCreateClientDialog(true);
                    } else {
                      handleSelectClient(existingClient);
                    }
                  }}
                  className="w-full"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add This Contact
                </Button>
              )}

            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

          {/* Search Criteria */}
          <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
            <Card className={`border ${criteriaOpen ? 'border-neutral-300' : 'border-border'}`}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30">
                  <CardTitle className="text-base">Search Criteria</CardTitle>
                  {criteriaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* State and County - Always Visible */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-semibold">State</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger id="state" className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          {US_STATES.map((stateItem) => (
                            <SelectItem key={stateItem.code} value={stateItem.code}>
                              {stateItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="county" className="text-sm font-semibold">County</Label>
                      <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                        <SelectTrigger id="county" className="bg-white">
                          <SelectValue placeholder="All Counties" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          <SelectItem value="all">
                            All Counties
                          </SelectItem>
                          {countiesForState.map((county) => (
                            <SelectItem key={county.id} value={county.id}>
                              {county.name} County
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Towns & Neighborhoods Section - Collapsed by default */}
                  <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className={`flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border ${townsOpen ? 'border-neutral-300' : 'border-border'}`}>
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

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Input
                              placeholder="Type Full or Partial Name"
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              className="text-sm"
                            />
                            <div className="border border-neutral-200 rounded-md bg-white max-h-60 overflow-y-auto p-2 relative z-10">
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
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Selected Towns</Label>
                              {selectedCities.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCities([])}
                                  className="h-7 px-2 text-xs"
                                >
                                  Remove All
                                </Button>
                              )}
                            </div>
                            <div className="border border-neutral-200 rounded-md p-3 bg-white min-h-[200px] max-h-60 overflow-y-auto">
                              {selectedCities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No towns selected</p>
                              ) : (
                                selectedCities.map((city) => (
                                  <button
                                    key={city}
                                    type="button"
                                    onClick={() => toggleCity(city)}
                                    className="w-full text-left py-1 px-2 text-sm border-b last:border-b-0 hover:bg-muted rounded cursor-pointer"
                                  >
                                    {city}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Type Multiple Towns/Areas</Label>
                          <p className="text-xs text-muted-foreground">Separate multiple towns with commas</p>
                          <div className="flex gap-2">
                            <Input
                              value={multiTownInput}
                              onChange={(e) => setMultiTownInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMultipleTowns();
                                }
                              }}
                              placeholder="e.g. Northborough, Worcester, Boston"
                              className="text-sm flex-1"
                            />
                            <Button 
                              type="button" 
                              onClick={handleAddMultipleTowns}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 text-sm"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Property Type - Collapsed by default */}
                  <Collapsible open={propertyTypeOpen} onOpenChange={setPropertyTypeOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className={`flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border ${propertyTypeOpen ? 'border-neutral-300' : 'border-border'}`}>
                        <Label className="text-sm font-semibold uppercase cursor-pointer">
                          Property Type
                          {propertyTypes.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-green-600">
                              ({propertyTypes.length} selected)
                            </span>
                          )}
                        </Label>
                        {propertyTypeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto mt-2">
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
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Status - Collapsed by default */}
                  <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className={`flex items-center justify-between cursor-pointer hover:bg-muted/30 p-3 rounded-md border ${statusOpen ? 'border-neutral-300' : 'border-border'}`}>
                        <Label className="text-sm font-semibold uppercase cursor-pointer">
                          Status
                          {statuses.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-green-600">
                              ({statuses.length} selected)
                            </span>
                          )}
                        </Label>
                        {statusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto mt-2">
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
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Price Range */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-semibold">Price Range</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-price">Min Price</Label>
                        <FormattedInput
                          id="min-price"
                          format="currency"
                          placeholder="500000"
                          value={minPrice}
                          onChange={(value) => setMinPrice(value)}
                          disabled={hasNoMin}
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="no-min"
                            checked={hasNoMin}
                            onCheckedChange={(checked) => {
                              setHasNoMin(checked === true);
                              if (checked) setMinPrice("");
                            }}
                          />
                          <Label htmlFor="no-min" className="text-sm font-normal cursor-pointer">
                            No Minimum
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-price">Max Price</Label>
                        <FormattedInput
                          id="max-price"
                          format="currency"
                          placeholder="1000000"
                          value={maxPrice}
                          onChange={(value) => setMaxPrice(value)}
                          disabled={hasNoMax}
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="no-max"
                            checked={hasNoMax}
                            onCheckedChange={(checked) => {
                              setHasNoMax(checked === true);
                              if (checked) setMaxPrice("");
                            }}
                          />
                          <Label htmlFor="no-max" className="text-sm font-normal cursor-pointer">
                            No Maximum
                          </Label>
                        </div>
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

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Living Area Total (SqFt)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="min-sqft">Min</Label>
                          <FormattedInput
                            id="min-sqft"
                            format="number"
                            placeholder="0"
                            value={minSqft}
                            onChange={(value) => setMinSqft(value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max-sqft">Max</Label>
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

                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label className="text-sm">Parking (includes garage)</Label>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="parking-yes"
                              name="parking"
                              checked={hasParking === true}
                              onChange={() => setHasParking(true)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="parking-yes" className="text-sm">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="parking-no"
                              name="parking"
                              checked={hasParking === false}
                              onChange={() => setHasParking(false)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="parking-no" className="text-sm">No</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="parking-any"
                              name="parking"
                              checked={hasParking === null}
                              onChange={() => setHasParking(null)}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="parking-any" className="text-sm">Any</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Notification Settings */}
          <Collapsible open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Card className={`border ${notificationsOpen ? 'border-neutral-300' : 'border-border'}`}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30">
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleValidateAndShowConfirmation} 
              disabled={saving}
              className="min-w-[180px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : showSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4 animate-scale-in" />
                  Created!
                </>
              ) : (
                editMode ? "Update Hot Sheet" : "Create Hot Sheet"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Review Hot Sheet Details</AlertDialogTitle>
            <AlertDialogDescription>
              Please review the criteria below before creating your hot sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 my-4">
            {/* Hot Sheet Name */}
            <div className="border-b pb-3">
              <p className="text-sm font-semibold text-foreground">Hot Sheet Name</p>
              <p className="text-sm text-muted-foreground">{hotSheetName}</p>
            </div>

            {/* Contact Information */}
            <div className="border-b pb-3">
              <p className="text-sm font-semibold text-foreground mb-2">Contact Information</p>
              {selectedClients.length > 0 ? (
                <div className="space-y-2">
                  {selectedClients.map((client) => (
                    <div key={client.id} className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                      <p><span className="font-medium">Name:</span> {client.first_name} {client.last_name}</p>
                      <p><span className="font-medium">Email:</span> {client.email}</p>
                      {client.phone && <p><span className="font-medium">Phone:</span> {formatPhoneNumber(client.phone)}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts added</p>
              )}
            </div>


            {/* Notification Settings */}
            <div className="pb-3">
              <p className="text-sm font-semibold text-foreground mb-2">Notifications</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium">Agent:</span> {notifyAgent ? "Enabled" : "Disabled"}</p>
                {clientId && <p><span className="font-medium">Client:</span> {notifyClient ? "Enabled" : "Disabled"}</p>}
                <p><span className="font-medium">Schedule:</span> {notificationSchedule === "immediately" ? "Immediately" : notificationSchedule === "daily" ? "Daily" : "Weekly"}</p>
              </div>
            </div>

            {matchingListingsCount > 0 && (
              <div className="bg-secondary p-3 rounded-md">
                <p className="text-sm font-medium text-primary">
                  {matchingListingsCount} {matchingListingsCount === 1 ? "property currently matches" : "properties currently match"} these criteria
                </p>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate}>
              Confirm & Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Contact Dialog */}
      <AlertDialog open={showCreateClientDialog} onOpenChange={setShowCreateClientDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this contact to your contacts list?</AlertDialogTitle>
            <AlertDialogDescription>
              This contact will be added to the hot sheet. Would you also like to save them as a permanent contact?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 my-4 p-4 bg-muted rounded-md">
            <p className="text-sm"><span className="font-medium">Name:</span> {clientFirstName} {clientLastName}</p>
            <p className="text-sm"><span className="font-medium">Email:</span> {clientEmail}</p>
            {clientPhone && <p className="text-sm"><span className="font-medium">Phone:</span> {clientPhone}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleAddClientWithoutSaving}>
              No
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateClient} disabled={creatingClient}>
              {creatingClient ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Yes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Another Contact Modal */}
      <AlertDialog open={showAddAnotherContactModal} onOpenChange={setShowAddAnotherContactModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Would you like to add another contact to this same Hot Sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              You can add more contacts who will receive alerts for this Hot Sheet, or finish and view your results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowAddAnotherContactModal(false);
                if (createdHotSheetId) {
                  onSuccess(createdHotSheetId);
                }
                onOpenChange(false);
                resetForm();
              }}
            >
              Continue
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowAddAnotherContactModal(false);
                setClientInfoOpen(true);
              }}
              className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600"
            >
              Add Another Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}