import React, { useState, useEffect, useRef, useMemo } from "react";
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
import {
  ChevronDown,
  ChevronUp,
  Check,
  CircleDot,
  DollarSign,
  AlertCircle,
  Home,
  ListFilter,
  Loader2,
  MapPin,
  Ruler,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES, COUNTIES_BY_STATE } from "@/data/usStatesCountiesData";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { useTownsPicker } from "@/hooks/useTownsPicker";
import { TownsPicker } from "@/components/TownsPicker";
import { getAreasForCity, hasNeighborhoodData } from "@/data/usNeighborhoodsData";
import { buildListingsQuery } from "@/lib/buildListingsQuery";
import { fetchAllAgentContacts, searchClientContacts, invalidateAgentContactsCache } from "@/lib/contactSearch";
import { isValidShareRecipientEmail } from "@/lib/shareRecipientUtils";
import { DuplicateContactDialog, type DuplicateExistingClient } from "@/components/hot-sheets/DuplicateContactDialog";
import {
  DEFAULT_HOT_SHEET_CRITERIA,
  fromCriteriaPayload,
  normalizeStatusSelection,
  parkingToOption,
  toCriteriaPayload,
} from "@/lib/hotSheetCriteriaCore";
import { formatTownSelectionLabel, normalizeTownSelections, toggleTownSelection } from "@/lib/townSelection";
import { HOT_SHEET_FILTER_STATUSES, PROPERTY_TYPES as STATUS_PROPERTY_TYPES } from "@/constants/status";
import { cn } from "@/lib/utils";

/** Nested cards in this dialog — keep white surface and subtle shadow (override global Card lift). */
const HS_DIALOG_CARD =
  "!shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:!translate-y-0 hover:!shadow-[0_1px_3px_rgba(0,0,0,0.06)] rounded-xl border-neutral-200";

const HS_SECTION_ICON = "h-4 w-4 shrink-0 text-neutral-400";

function HsSectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className={HS_SECTION_ICON} aria-hidden />;
}

function normalizeClientEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDuplicateClientEmailError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "23505" || String(e?.message ?? "").includes("clients_agent_email_unique");
}

interface CreateHotSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  clientName?: string;
  userId: string;
  onSuccess: (hotSheetId: string, updatedHotSheet?: { id: string; name: string; criteria: Record<string, unknown> | null }) => void | Promise<void>;
  hotSheetId?: string;
  editMode?: boolean;
  preSelectedClients?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
  }>;
  lockedToClient?: boolean;
  hideNotificationSettings?: boolean;
  /** When set with `editMode`, shows delete controls (used from agent `/agent/hot-sheets` edit only). */
  allowDeleteFromEdit?: boolean;
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
  preSelectedClients,
  lockedToClient = false,
  hideNotificationSettings = false,
  allowDeleteFromEdit = false,
}: CreateHotSheetDialogProps) {
  const [hotSheetName, setHotSheetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDeleteHotSheetDialog, setShowDeleteHotSheetDialog] = useState(false);
  const [deletingHotSheet, setDeletingHotSheet] = useState(false);

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
  const [addingManualContact, setAddingManualContact] = useState(false);
  const [duplicateExistingClient, setDuplicateExistingClient] =
    useState<DuplicateExistingClient | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const wasClientPickerOpenRef = useRef(false);
  const dismissedDuplicateEmailRef = useRef<string | null>(null);
  const lastAutoOpenedDuplicateEmailRef = useRef<string | null>(null);
  
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
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_HOT_SHEET_CRITERIA.statuses);
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
  const [state, setState] = useState(DEFAULT_HOT_SHEET_CRITERIA.state);
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
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [notificationSchedule, setNotificationSchedule] = useState("immediately");

  // Collapsible sections - Towns, Property Type, Status collapsed by default
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  /** Prevents duplicate submissions from the confirm dialog firing twice in quick succession. */
  const createInFlightRef = useRef(false);
  const creatingClientRef = useRef(false);
  const addingManualContactRef = useRef(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showManualClientEntry, setShowManualClientEntry] = useState(false);
  const [townsOpen, setTownsOpen] = useState(false);
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  
  const resetDialogState = () => {
    setShowCreateClientDialog(false);
    setShowDuplicateDialog(false);
    setDuplicateExistingClient(null);
    setShowConfirmDialog(false);
    setShowClientPicker(false);
    setShowManualClientEntry(false);
    setShowClientDropdown(false);
    setClientSearchQuery("");
    setClientSearchResults([]);
    clearManualContactForm();
  };

  const clearManualContactForm = () => {
    setClientFirstName("");
    setClientLastName("");
    setClientEmail("");
    setClientPhone("");
    setExistingClient(null);
    dismissedDuplicateEmailRef.current = null;
    lastAutoOpenedDuplicateEmailRef.current = null;
    setErrors((prev) => ({
      ...prev,
      clientFirstName: undefined,
      clientLastName: undefined,
      clientEmail: undefined,
      clientPhone: undefined,
    }));
  };

  const fetchAgentClientByEmail = async (email: string) => {
    const normalizedEmail = normalizeClientEmail(email);
    if (!normalizedEmail || !userId) return null;
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone")
      .eq("agent_id", userId)
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  };

  const validateManualContactForm = () => {
    const nextErrors: typeof errors = {};
    const first = clientFirstName.trim();
    const last = clientLastName.trim();
    const normalizedEmail = normalizeClientEmail(clientEmail);

    if (!first) nextErrors.clientFirstName = "First name is required";
    if (!last) nextErrors.clientLastName = "Last name is required";
    if (!normalizedEmail) {
      nextErrors.clientEmail = "Email is required";
    } else if (!isValidShareRecipientEmail(normalizedEmail)) {
      nextErrors.clientEmail = "Enter a valid email address";
    }

    return {
      valid: Object.keys(nextErrors).length === 0,
      errors: nextErrors,
      normalizedEmail,
      firstName: first,
      lastName: last,
    };
  };

  const openClientPicker = () => {
    clearManualContactForm();
    setShowClientPicker(true);
  };

  // Initialize from preSelectedClients when dialog opens (only once on open)
  useEffect(() => {
    if (open && preSelectedClients && preSelectedClients.length > 0 && selectedClients.length === 0) {
      setSelectedClients(preSelectedClients);
    }
  }, [open, preSelectedClients]);

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

  useEffect(() => {
    if (showClientPicker && userId) {
      void fetchAllAgentContacts(userId).catch((error) => {
        console.error("Error preloading contacts for hot sheet picker:", error);
      });
    }
  }, [showClientPicker, userId]);

  // Search clients as user types
  useEffect(() => {
    const searchClients = async () => {
      if (!clientSearchQuery || clientSearchQuery.length < 2 || !open) {
        setClientSearchResults([]);
        setShowClientDropdown(false);
        return;
      }
      
      try {
        const data = await searchClientContacts({
          agentId: userId,
          query: clientSearchQuery,
          select: "*",
          limit: 10,
        });
        setClientSearchResults(data);
        setShowClientDropdown(data.length > 0);
      } catch (error: any) {
        console.error("Error searching clients:", error);
        setClientSearchResults([]);
      }
    };
    
    // Debounce the search
    const timer = setTimeout(searchClients, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, userId, open]);

  useEffect(() => {
    if (showClientPicker) {
      wasClientPickerOpenRef.current = true;
      setTimeout(() => {
        clientSearchInputRef.current?.focus();
      }, 0);
      return;
    }
    if (wasClientPickerOpenRef.current) {
      wasClientPickerOpenRef.current = false;
      setShowManualClientEntry(false);
      clearManualContactForm();
    }
  }, [showClientPicker]);

  // Falling-edge guard: any time the dialog closes, clear transient contact-entry state
  // so reopening always starts on the search + blue "Or add a new contact manually" link.
  useEffect(() => {
    if (!open) {
      resetDialogState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!showManualClientEntry || !userId || !open) return;
    const normalizedEmail = normalizeClientEmail(clientEmail);
    if (!isValidShareRecipientEmail(normalizedEmail)) {
      setExistingClient(null);
      setDuplicateExistingClient(null);
      setShowDuplicateDialog(false);
      dismissedDuplicateEmailRef.current = null;
      lastAutoOpenedDuplicateEmailRef.current = null;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchAgentClientByEmail(normalizedEmail)
        .then((row) => {
          if (cancelled) return;
          setExistingClient(row);
          if (!row) {
            setDuplicateExistingClient(null);
            if (lastAutoOpenedDuplicateEmailRef.current === normalizedEmail) {
              lastAutoOpenedDuplicateEmailRef.current = null;
            }
            return;
          }
          if (
            dismissedDuplicateEmailRef.current !== normalizedEmail &&
            lastAutoOpenedDuplicateEmailRef.current !== normalizedEmail
          ) {
            setDuplicateExistingClient(row as DuplicateExistingClient);
            setShowDuplicateDialog(true);
            lastAutoOpenedDuplicateEmailRef.current = normalizedEmail;
          }
        })
        .catch((error) => {
          console.error("Error looking up contact by email:", error);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientEmail, showManualClientEntry, userId, open]);

  const handleSelectClient = async (client: any) => {
    // Check if client is already selected
    if (selectedClients.some(c => c.id === client.id)) {
      toast.error("This person is already added");
      return;
    }

    // Check if client is already registered with another agent
    const email = (client.email || "").trim();
    if (email) {
      const { data, error } = await supabase.rpc("check_client_has_other_agent", {
        p_client_email: email,
      });
      if (!error && data === true) {
        toast.error("This person is already registered with another agent.");
        return;
      }
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
    setShowClientPicker(false);
    setShowManualClientEntry(false);
    
    toast.success(`Added contact: ${client.first_name} ${client.last_name}`);
  };

  const handleRemoveClient = (clientId: string) => {
    setSelectedClients(prev => prev.filter(c => c.id !== clientId));
    toast.success("Contact removed");
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
      const coreCriteria = fromCriteriaPayload(criteria);
      
      // Load all the criteria fields
      setListingNumbers(criteria.listingNumbers || "");
      setAddress(criteria.address || "");
      setPropertyTypes(coreCriteria.propertyTypes || []);
      setStatuses(normalizeStatusSelection(coreCriteria.statuses || []));
      setMinPrice(coreCriteria.minPrice);
      setMaxPrice(coreCriteria.maxPrice);
      setHasNoMin(coreCriteria.hasNoMin);
      setHasNoMax(coreCriteria.hasNoMax);
      setBedrooms(criteria.bedrooms?.toString() || "");
      setBathrooms(criteria.bathrooms?.toString() || "");
      setRooms(criteria.rooms?.toString() || "");
      setAcres(criteria.acres?.toString() || "");
      setMinSqft(criteria.minSqft?.toString() || "");
      setMaxSqft(criteria.maxSqft?.toString() || "");
      setPricePerSqft(criteria.pricePerSqft?.toString() || "");
      setZipCode(criteria.zipCode || "");
      setSelectedCities(normalizeTownSelections(coreCriteria.cities || []));
      // Load county
      setSelectedCountyId(coreCriteria.selectedCountyId || "all");
      // Normalize loaded state to 2-letter code, default to MA
      const loadedState = coreCriteria.state as string | undefined;
      const normalizedState = loadedState && loadedState.length > 2
        ? (US_STATES.find(s => s.name === loadedState)?.code ?? loadedState)
        : (loadedState || "MA");
      setState(normalizedState);
      
      // Notification settings — client match emails implied when contacts are linked
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
    { value: "residential_rental", label: "Residential Rental (RR)" },
  ];

  // Use centralized status options from constants
  const statusOptions = HOT_SHEET_FILTER_STATUSES;

  const togglePropertyType = (value: string) => {
    setPropertyTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  const toggleStatus = (value: string) => {
    setStatuses(prev =>
      normalizeStatusSelection(prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => toggleTownSelection(prev, city));
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
      
      const normalizedSelections = normalizeTownSelections(allSelections);
      setSelectedCities(normalizedSelections);
      toast.success(`Selected all ${normalizedSelections.length} towns and neighborhoods`);
    } else {
      const normalizedSelections = normalizeTownSelections(allSelections);
      setSelectedCities(normalizedSelections);
      toast.success(`Selected all ${normalizedSelections.length} towns`);
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
      setSelectedCities((prev) => normalizeTownSelections([...prev, ...addedTowns]));
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

  const locationSummary = useMemo(() => {
    const stateLabel = US_STATES.find((stateItem) => stateItem.code === state)?.name ?? state;
    const countyName = countiesForState.find((county) => county.id === selectedCountyId)?.name;
    const countyLabel = selectedCountyId === "all" ? "All Counties" : `${countyName ?? "Selected"} County`;

    if (selectedCities.length === 0) {
      return `${stateLabel} • ${countyLabel} • 0 towns selected`;
    }

    const preview = selectedCities.slice(0, 2).map((city) => formatTownSelectionLabel(city)).join(", ");
    const townsLabel = selectedCities.length > 2 ? `${preview} +${selectedCities.length - 2}` : preview;
    return `${stateLabel} • ${countyLabel} • ${townsLabel}`;
  }, [countiesForState, selectedCities, selectedCountyId, state]);

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
          minPrice: hasNoMin ? undefined : (minPrice ? parseFloat(minPrice) : undefined),
          maxPrice: hasNoMax ? undefined : (maxPrice ? parseFloat(maxPrice) : undefined),
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
    hasNoMin,
    hasNoMax,
    bedrooms,
    bathrooms,
    minSqft,
    maxSqft,
  ]);

  // Reset search input when state or county changes
  useEffect(() => {
    setCitySearch("");
  }, [state, selectedCountyId]);

  const handleValidateAndShowConfirmation = async () => {
    // Clear previous errors
    setErrors({});

    // Validate hot sheet name
    if (!hotSheetName || hotSheetName.trim().length === 0) {
      setErrors({ hotSheetName: "Hot sheet name is required" });
      toast.error("Hot sheet name is required");
      return;
    }

    // Validate search criteria quality
    const criteriaValidation = validateCriteriaInputs();
    if (!criteriaValidation.valid) {
      toast.error(criteriaValidation.message);
      return;
    }

    if (editMode) {
      await handleUpdateHotSheet();
      return;
    }

    // Show confirmation dialog for new hot sheets only
    setShowConfirmDialog(true);
  };

  const buildCriteriaPayload = () => ({
    ...toCriteriaPayload({
      ...DEFAULT_HOT_SHEET_CRITERIA,
      state,
      selectedCountyId,
      cities: selectedCities,
      showAreas,
      propertyTypes,
      statuses,
      minPrice,
      maxPrice,
      hasNoMin,
      hasNoMax,
      bedrooms,
      bathrooms,
      rooms,
      acres,
      minSqft,
      maxSqft,
      pricePerSqft,
      hasParking: parkingToOption(hasParking),
    }),
    listingNumbers: listingNumbers || null,
    address: address || null,
    zipCode: zipCode || null,
    clientFirstName: clientFirstName || null,
    clientLastName: clientLastName || null,
    clientEmail: clientEmail || null,
    clientPhone: clientPhone ? formatPhoneNumber(clientPhone) : null,
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
  });

  const validateCriteriaInputs = () => {
    if (selectedCities.length === 0 && !zipCode && !state) {
      return { valid: false, message: "Please select at least one location filter." };
    }

    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;
    if (min !== null && max !== null && min > max) {
      return { valid: false, message: "Min Price cannot be greater than Max Price." };
    }

    const minArea = minSqft ? parseFloat(minSqft) : null;
    const maxArea = maxSqft ? parseFloat(maxSqft) : null;
    if (minArea !== null && maxArea !== null && minArea > maxArea) {
      return { valid: false, message: "Min SqFt cannot be greater than Max SqFt." };
    }

    if ((statuses?.length || 0) === 0) {
      return { valid: false, message: "Select at least one listing status." };
    }

    return { valid: true, message: "ok" };
  };

  const handleAddClientWithoutSaving = () => {
    const validation = validateManualContactForm();
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, ...validation.errors }));
      toast.error("Please complete all required contact fields.");
      return;
    }

    setSelectedClients(prev => [...prev, {
      id: `temp-${Date.now()}`,
      first_name: validation.firstName,
      last_name: validation.lastName,
      email: validation.normalizedEmail,
      phone: clientPhone ? formatPhoneNumber(clientPhone) : null
    }]);
    
    setShowCreateClientDialog(false);
    toast.success("Contact added to this hot sheet (not saved to your contacts list)");
    
    clearManualContactForm();
    setClientSearchQuery("");
    setShowClientPicker(false);
    setShowManualClientEntry(false);
  };

  const handleAddManualContactClick = async () => {
    if (addingManualContactRef.current || creatingClientRef.current) return;

    const validation = validateManualContactForm();
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, ...validation.errors }));
      toast.error("Please complete all required contact fields.");
      return;
    }

    addingManualContactRef.current = true;
    setAddingManualContact(true);
    try {
      const existing =
        existingClient?.email &&
        normalizeClientEmail(existingClient.email) === validation.normalizedEmail
          ? existingClient
          : await fetchAgentClientByEmail(validation.normalizedEmail);

      if (existing) {
        setDuplicateExistingClient(existing as DuplicateExistingClient);
        setShowDuplicateDialog(true);
        return;
      }

      setShowCreateClientDialog(true);
    } catch (error: unknown) {
      console.error("Error preparing manual contact:", error);
      toast.error("Could not look up this contact. Please try again.");
    } finally {
      addingManualContactRef.current = false;
      setAddingManualContact(false);
    }
  };

  const handleCreateClient = async () => {
    if (creatingClientRef.current) return;

    const validation = validateManualContactForm();
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, ...validation.errors }));
      toast.error("Please complete all required contact fields.");
      return;
    }

    creatingClientRef.current = true;
    setCreatingClient(true);
    try {
      const normalizedEmail = validation.normalizedEmail;

      const existingBeforeInsert =
        existingClient?.email &&
        normalizeClientEmail(existingClient.email) === normalizedEmail
          ? existingClient
          : await fetchAgentClientByEmail(normalizedEmail);

      if (existingBeforeInsert) {
        setShowCreateClientDialog(false);
        setDuplicateExistingClient(existingBeforeInsert as DuplicateExistingClient);
        setShowDuplicateDialog(true);
        return;
      }

      // Block if this email already belongs to an AAC account.
      const { data: alreadyRegistered, error: regCheckErr } = await supabase.rpc(
        "is_email_registered_with_aac" as any,
        { p_email: normalizedEmail }
      );
      if (regCheckErr) throw regCheckErr;
      if (alreadyRegistered === true) {
        toast.error(
          "This email is already registered with AAC. They already have an account — share your AAC profile link instead."
        );
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          agent_id: userId,
          first_name: validation.firstName,
          last_name: validation.lastName,
          email: normalizedEmail,
          phone: clientPhone ? formatPhoneNumber(clientPhone) : null,
        })
        .select()
        .single();

      if (error) {
        if (isDuplicateClientEmailError(error)) {
          const existing = await fetchAgentClientByEmail(normalizedEmail);
          if (existing) {
            setShowCreateClientDialog(false);
            setDuplicateExistingClient(existing as DuplicateExistingClient);
            setShowDuplicateDialog(true);
            return;
          }
          toast.error("A contact with this email already exists in your list.");
          return;
        }
        throw error;
      }

      if (data) {
        setSelectedClients(prev => [...prev, {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone
        }]);
      }
      setShowCreateClientDialog(false);
      invalidateAgentContactsCache();
      toast.success("Contact saved and added to this hot sheet");
      
      clearManualContactForm();
      setClientSearchQuery("");
      setShowClientPicker(false);
      setShowManualClientEntry(false);
    } catch (error: unknown) {
      console.error("Error creating client:", error);
      const message = error instanceof Error ? error.message : "Could not save this person to your contacts";
      if (isDuplicateClientEmailError(error)) {
        try {
          const existing = await fetchAgentClientByEmail(validation.normalizedEmail);
          if (existing) {
            setShowCreateClientDialog(false);
            setDuplicateExistingClient(existing as DuplicateExistingClient);
            setShowDuplicateDialog(true);
            return;
          }
        } catch (lookupError) {
          console.error("Error recovering duplicate contact:", lookupError);
        }
        toast.error("A contact with this email already exists in your list.");
        return;
      }
      toast.error(message);
    } finally {
      creatingClientRef.current = false;
      setCreatingClient(false);
    }
  };

  const handleUpdateHotSheet = async () => {
    if (!hotSheetId) {
      toast.error("Failed to update hot sheet");
      return;
    }

    const trimmedName = hotSheetName.trim();
    if (!trimmedName) {
      toast.error("Please enter a hot sheet name");
      return;
    }

    try {
      setSaving(true);

      const criteria = buildCriteriaPayload();

      const { data, error } = await supabase
        .from("hot_sheets")
        .update({
          name: trimmedName,
          criteria,
          updated_at: new Date().toISOString(),
          notify_client_email: true,
        })
        .eq("id", hotSheetId)
        .select("id, name, criteria");

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.error("Update failed — no rows returned", { hotSheetId });
        throw new Error("Hot sheet update returned no rows. Check RLS update policy or ownership.");
      }

      const updated = data[0];

      await onSuccess?.(hotSheetId, {
        id: updated.id,
        name: updated.name,
        criteria: (updated.criteria as Record<string, unknown> | null) ?? null,
      });

      toast.success("Hot sheet updated");
      setShowSuccess(false);
      resetDialogState();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to update hot sheet", { hotSheetId, error });
      toast.error(error?.message || "Failed to update hot sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setShowConfirmDialog(false);

    if (editMode) {
      await handleUpdateHotSheet();
      return;
    }

    if (createInFlightRef.current) return;
    createInFlightRef.current = true;

    try {
      setSaving(true);

      const criteria = buildCriteriaPayload();

      // Create new hot sheet
        const { data: createdHotSheet, error } = await supabase
          .from("hot_sheets")
          .insert({
            user_id: userId,
            client_id: clientId || null,
            name: hotSheetName,
            criteria,
            is_active: true,
            notify_client_email: true,
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

        window.localStorage.removeItem(`aac:hotsheet:draft:${userId}:new`);

        if (lockedToClient && createdHotSheet && selectedClients.length > 0) {
          toast.success(
            "Hot sheet created. Review the matches and send the invite when ready.",
          );
        } else {
          toast.success("Hot sheet created");
        }

        resetDialogState();
        onOpenChange(false);
        onSuccess(createdHotSheet.id);
        resetForm();
    } catch (error: any) {
      console.error("Error creating hot sheet:", error);
      toast.error(error?.message ? `Failed to create hot sheet: ${error.message}` : "Failed to create hot sheet");
    } finally {
      createInFlightRef.current = false;
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
    setShowClientPicker(false);
    setShowManualClientEntry(false);
    setSelectedClients([]);
    setShowCreateClientDialog(false);
    setCreatingClient(false);
    setAddingManualContact(false);
    setErrors({});
    setShowConfirmDialog(false);
    setShowSuccess(false);
    setListingNumbers("");
    setAddress("");
    setPropertyTypes([]);
    setStatuses([...DEFAULT_HOT_SHEET_CRITERIA.statuses]);
    setMinPrice("");
    setMaxPrice("");
    setHasNoMin(false);
    setHasNoMax(false);
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
    setState(DEFAULT_HOT_SHEET_CRITERIA.state);
    setSelectedCountyId(DEFAULT_HOT_SHEET_CRITERIA.selectedCountyId);
    setShowAreas(DEFAULT_HOT_SHEET_CRITERIA.showAreas);
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
    setNotifyAgent(true);
    setNotificationSchedule("immediately");
  };

  const handleConfirmDeleteHotSheet = async () => {
    if (!hotSheetId || !allowDeleteFromEdit) return;
    setDeletingHotSheet(true);
    try {
      const { error: clientsError } = await supabase
        .from("hot_sheet_clients")
        .delete()
        .eq("hot_sheet_id", hotSheetId);
      if (clientsError) throw clientsError;
      const { error: sheetError } = await supabase
        .from("hot_sheets")
        .delete()
        .eq("id", hotSheetId)
        .eq("user_id", userId);
      if (sheetError) throw sheetError;
      toast.success("Hot sheet deleted.");
      setShowDeleteHotSheetDialog(false);
      resetForm();
      onOpenChange(false);
      await onSuccess(hotSheetId);
    } catch (e: unknown) {
      console.error("Delete hot sheet failed:", e);
      toast.error(e instanceof Error ? e.message : "Could not delete hot sheet.");
    } finally {
      setDeletingHotSheet(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Reset contact-entry slice on every dismissal path (X, Esc, backdrop)
          // so the blue "Or add a new contact manually" link reappears on next open.
          resetDialogState();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100%-1.25rem)] max-w-3xl gap-0 overflow-y-auto border border-neutral-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.07)] sm:w-full sm:max-h-[90vh] sm:rounded-xl sm:p-5 sm:gap-4">
        <DialogHeader className="space-y-2 pb-2 text-left sm:pb-3">
          <DialogTitle className="text-lg font-semibold tracking-tight text-neutral-900">
            {editMode ? "Edit hot sheet" : "Create hot sheet"}
            {clientName ? (
              <span className="font-normal text-neutral-500"> · {clientName}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-snug text-neutral-500">
            {lockedToClient
              ? "Set criteria for this buyer. We'll save the hot sheet and open the review page so you can confirm the matches and remove any before sending the invite."
              : "Set criteria and contacts. Invites and listing sends run from the hot sheet review screen."}
          </DialogDescription>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-medium text-neutral-700">Match preview</span>
              {loadingCount ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" aria-hidden />
                  <span className="text-[13px] text-neutral-500">Updating count…</span>
                </div>
              ) : (
                <span className="tabular-nums text-[15px] font-semibold text-neutral-900">
                  {matchingListingsCount} {matchingListingsCount === 1 ? "listing" : "listings"}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 sm:space-y-6">
          {/* Hot Sheet Name */}
          <div className="space-y-2">
            {editMode && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUpdateHotSheet}
                  disabled={saving}
                  className="h-7 border-neutral-200 px-2.5 text-[11px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50/90 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save name & criteria"
                  )}
                </Button>
              </div>
            )}
            <Label htmlFor="name" className="text-[13px] font-medium text-neutral-800">
              Hot sheet name <span className="text-neutral-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Downtown condos under $500k"
              value={hotSheetName}
              onChange={(e) => {
                setHotSheetName(e.target.value);
                if (errors.hotSheetName) {
                  setErrors(prev => ({ ...prev, hotSheetName: undefined }));
                }
              }}
              maxLength={100}
              className={cn(
                "h-9 border-neutral-200 text-sm focus-visible:ring-2 focus-visible:ring-neutral-300/40 focus-visible:ring-offset-2",
                errors.hotSheetName && "border-destructive",
              )}
            />
            {errors.hotSheetName && (
              <p className="text-[13px] text-destructive">{errors.hotSheetName}</p>
            )}
          </div>

          {/* Contact Information */}
          <Card className={cn("border", HS_DIALOG_CARD)}>
            <CardHeader className="space-y-2 p-4 pb-3 sm:p-5 sm:pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-neutral-900">
                  <HsSectionIcon icon={Users} />
                  <span>
                    Contacts <span className="font-normal text-neutral-500">*</span>
                  </span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {!lockedToClient && selectedClients.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-neutral-200 px-2.5 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
                      onClick={openClientPicker}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Add another
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              {selectedClients.length > 0 ? (
                <div className="space-y-2">
                  <Label>Selected Contacts</Label>
                  <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-2">
                    {selectedClients.map((client) => {
                      const isLocked = lockedToClient && client.id === clientId;
                      return (
                        <div
                          key={client.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10"
                              aria-hidden
                            >
                              <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{client.first_name} {client.last_name}</div>
                              <div className="text-xs text-muted-foreground">{client.email}</div>
                              {client.phone && (
                                <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                              )}
                            </div>
                          </div>
                          {!isLocked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveClient(client.id)}
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add your buyer's name and email to invite them to this hot sheet.
                </p>
              )}

              {(showClientPicker || selectedClients.length === 0) && !lockedToClient && (
                <>
                  <div className="space-y-2 relative">
                    <Label htmlFor="client-search">Search Existing Contact</Label>
                    <Input
                      id="client-search"
                      ref={clientSearchInputRef}
                      placeholder="Search by name or email..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (clientSearchResults.length > 0) {
                          setShowClientDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowClientDropdown(false), 200);
                      }}
                    />
                    {showClientDropdown && clientSearchResults.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
                        {clientSearchResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className="w-full border-b border-neutral-100 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-neutral-50/90 last:border-b-0"
                          >
                            <div className="font-medium text-sm">{client.first_name} {client.last_name}</div>
                            <div className="text-xs text-muted-foreground">{client.email}</div>
                            {client.phone && (
                              <div className="text-xs text-muted-foreground">{formatPhoneNumber(client.phone)}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {existingClient && (
                      <p className="text-sm text-muted-foreground">Found existing contact - fields auto-filled</p>
                    )}
                  </div>

                  <Separator />

                  {!showManualClientEntry ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearManualContactForm();
                        setShowManualClientEntry(true);
                      }}
                      className="text-left text-[13px] font-medium text-[#0E56F5] transition-colors hover:text-[#0B46CC]"
                    >
                      Or add a new contact manually
                    </button>
                  ) : (
                    <>
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
                        const nextEmail = e.target.value;
                        setClientEmail(nextEmail);
                        const normalizedNextEmail = normalizeClientEmail(nextEmail);
                        if (dismissedDuplicateEmailRef.current !== normalizedNextEmail) {
                          dismissedDuplicateEmailRef.current = null;
                        }
                        if (lastAutoOpenedDuplicateEmailRef.current !== normalizedNextEmail) {
                          lastAutoOpenedDuplicateEmailRef.current = null;
                        }
                        if (errors.clientEmail) {
                          setErrors(prev => ({ ...prev, clientEmail: undefined }));
                        }
                      }}
                      className={errors.clientEmail ? "border-destructive" : ""}
                    />
                    {errors.clientEmail && (
                      <p className="text-sm text-destructive">{errors.clientEmail}</p>
                    )}
                    {existingClient && !errors.clientEmail && (
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicateExistingClient(existingClient as DuplicateExistingClient);
                          setShowDuplicateDialog(true);
                          lastAutoOpenedDuplicateEmailRef.current = normalizeClientEmail(clientEmail);
                        }}
                        className="flex items-center gap-1 text-left text-sm text-amber-600 transition-colors hover:text-amber-700"
                      >
                        <AlertCircle className="h-4 w-4" />
                        This email is already in your contacts.
                      </button>
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

                  {(clientFirstName || clientLastName || clientEmail || clientPhone) && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={addingManualContact || creatingClient}
                      onClick={() => void handleAddManualContactClick()}
                      className="w-full"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {addingManualContact || creatingClient ? "Adding…" : "Add This Contact"}
                    </Button>
                  )}

                  {selectedClients.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowClientPicker(false)}
                    >
                      Done
                    </Button>
                  )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Search Criteria */}
          <Collapsible open={criteriaOpen} onOpenChange={setCriteriaOpen}>
            <Card className={cn("border", HS_DIALOG_CARD)}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-4 pb-3 hover:bg-neutral-50/80 sm:p-5 sm:pb-3">
                  <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                    <HsSectionIcon icon={SlidersHorizontal} />
                    Search criteria
                  </CardTitle>
                  {criteriaOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                  {/* Unified Location section */}
                  <Collapsible open={townsOpen} onOpenChange={setTownsOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50/80">
                        <div className="flex min-w-0 items-start gap-2 text-left">
                          <HsSectionIcon icon={MapPin} />
                          <div className="min-w-0 space-y-1">
                            <Label className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-700">
                              Location
                            </Label>
                            <p className="text-xs text-neutral-500">{locationSummary}</p>
                          </div>
                        </div>
                        {townsOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="state" className="text-sm font-semibold">State</Label>
                            <Select value={state} onValueChange={setState}>
                              <SelectTrigger
                                id="state"
                                className="h-9 border-neutral-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-neutral-300/35 focus-visible:ring-offset-2"
                              >
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
                              <SelectTrigger
                                id="county"
                                className="h-9 border-neutral-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-neutral-300/35 focus-visible:ring-offset-2"
                              >
                                <SelectValue placeholder="All Counties" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50 max-h-[300px]">
                                <SelectItem value="all">All Counties</SelectItem>
                                {countiesForState.map((county) => (
                                  <SelectItem key={county.id} value={county.id}>
                                    {county.name} County
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

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
                                className="w-4 h-4 accent-emerald-600"
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
                                className="w-4 h-4 accent-emerald-600"
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
                                  className="mb-2 w-full rounded-md border-b border-neutral-200 px-2 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-neutral-50/90"
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
                              <Label className="text-sm font-medium">
                                Selected Towns
                                {selectedCities.length > 0 && (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">({selectedCities.length})</span>
                                )}
                              </Label>
                              {selectedCities.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCities([])}
                                  className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
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
                                  <div
                                    key={city}
                                    className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-neutral-300"
                                  >
                                    <span className="truncate font-medium text-neutral-800">{formatTownSelectionLabel(city)}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleCity(city)}
                                      aria-label={`Remove ${formatTownSelectionLabel(city)}`}
                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
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
                              variant="outline"
                              onClick={handleAddMultipleTowns}
                              className="h-9 shrink-0 border-neutral-200 px-4 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90"
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
                      <div className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50/80">
                        <div className="flex min-w-0 items-center gap-2">
                          <HsSectionIcon icon={Home} />
                          <Label className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-700">
                            Property type
                            {propertyTypes.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-neutral-500">
                                ({propertyTypes.length} selected)
                              </span>
                            )}
                          </Label>
                        </div>
                        {propertyTypeOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
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
                      <div className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50/80">
                        <div className="flex min-w-0 items-center gap-2">
                          <HsSectionIcon icon={CircleDot} />
                          <Label className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-700">
                            Status
                            {statuses.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-neutral-500">
                                ({statuses.length} selected)
                              </span>
                            )}
                          </Label>
                        </div>
                        {statusOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="st-select-all"
                            checked={statuses.length === statusOptions.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setStatuses(normalizeStatusSelection(statusOptions.map((opt) => opt.value)));
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
                    <Label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <HsSectionIcon icon={DollarSign} />
                      Price Range
                    </Label>
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
                    <Label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-900">
                      <HsSectionIcon icon={ListFilter} />
                      Standard Search Criteria
                    </Label>
                    
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
                      {/* Rooms is intentionally not offered: there is no
                          listings.rooms column, so the Hot Sheet matcher cannot
                          enforce it. Existing saved Rooms criteria fail closed
                          (zero matches) server-side. */}
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
                      <Label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <HsSectionIcon icon={Ruler} />
                        Living Area Total (SqFt)
                      </Label>
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

          {!hideNotificationSettings && (
            <Collapsible open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <Card className={cn("border", HS_DIALOG_CARD)}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-4 pb-3 hover:bg-neutral-50/80 sm:p-5 sm:pb-3">
                    <CardTitle className="text-[15px] font-semibold text-neutral-900">Notifications</CardTitle>
                    {notificationsOpen ? <ChevronUp className="h-4 w-4 text-neutral-600" /> : <ChevronDown className="h-4 w-4 text-neutral-600" />}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
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
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 rounded-md border-neutral-200 bg-white px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:bg-neutral-50/90 disabled:opacity-50"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleValidateAndShowConfirmation}
              disabled={saving}
              className="h-9 flex-1 gap-1.5 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2 disabled:opacity-50"
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

          {editMode && hotSheetId && allowDeleteFromEdit ? (
            <div className="border-t border-neutral-200 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-2 text-[13px] font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteHotSheetDialog(true)}
                disabled={saving}
              >
                Delete hot sheet…
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-h-[min(90dvh,640px)] w-[calc(100%-1.25rem)] max-w-2xl gap-4 overflow-y-auto border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:rounded-xl">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="text-lg font-semibold text-neutral-900">
              Review & confirm
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-snug text-neutral-500">
              Double-check contacts and criteria before saving.
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
                    <div key={client.id} className="rounded-lg border border-neutral-200 bg-white p-2.5 text-[13px] text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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


            {!hideNotificationSettings && (
              <div className="pb-3">
                <p className="text-sm font-semibold text-foreground mb-2">Notifications</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><span className="font-medium">Agent:</span> {notifyAgent ? "Enabled" : "Disabled"}</p>
                  {selectedClients.length > 0 && (
                    <p className="text-muted-foreground">
                      {lockedToClient
                        ? "After you create this sheet, we'll open the review page so you can confirm matches and send the invite from there."
                        : "Contacts on this sheet receive invitations and listing emails when you send from the review screen."}
                    </p>
                  )}
                  <p><span className="font-medium">Schedule:</span> {notificationSchedule === "immediately" ? "Immediately" : notificationSchedule === "daily" ? "Daily" : "Weekly"}</p>
                </div>
              </div>
            )}

            {matchingListingsCount > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[13px] font-medium text-neutral-800">
                  {matchingListingsCount}{" "}
                  {matchingListingsCount === 1 ? "listing matches" : "listings match"} these criteria
                </p>
              </div>
            )}
          </div>

          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel className="mt-0 h-9 rounded-md border-neutral-200 px-3 text-[13px] font-medium hover:bg-neutral-50/90">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2"
              onClick={handleCreate}
            >
              Confirm & Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Contact Dialog */}
      <AlertDialog open={showCreateClientDialog} onOpenChange={setShowCreateClientDialog}>
        <AlertDialogContent className="border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:rounded-xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-lg font-semibold text-neutral-900">
              Save to contacts?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-snug text-neutral-500">
              This person will be on the hot sheet. Also save them to your CRM contacts?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 space-y-2 rounded-lg border border-neutral-200 bg-white p-4 text-[13px] text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <p className="text-sm"><span className="font-medium">Name:</span> {clientFirstName} {clientLastName}</p>
            <p className="text-sm"><span className="font-medium">Email:</span> {clientEmail}</p>
            {clientPhone && <p className="text-sm"><span className="font-medium">Phone:</span> {clientPhone}</p>}
          </div>

          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel
              className="mt-0 h-9 rounded-md border-neutral-200 px-3 text-[13px] font-medium hover:bg-neutral-50/90"
              onClick={handleAddClientWithoutSaving}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 rounded-md border border-[#0B46CC]/20 bg-[#0E56F5] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#0B46CC] focus-visible:ring-2 focus-visible:ring-neutral-400/55 focus-visible:ring-offset-2"
              disabled={creatingClient}
              onClick={(e) => {
                e.preventDefault();
                void handleCreateClient();
              }}
            >
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

      <AlertDialog open={showDeleteHotSheetDialog} onOpenChange={setShowDeleteHotSheetDialog}>
        <AlertDialogContent className="border border-neutral-200 bg-white sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this hot sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the hot sheet and its client links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingHotSheet}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingHotSheet}
              onClick={() => void handleConfirmDeleteHotSheet()}
            >
              {deletingHotSheet ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateContactDialog
        open={showDuplicateDialog}
        onOpenChange={(next) => {
          setShowDuplicateDialog(next);
          if (!next) {
            dismissedDuplicateEmailRef.current = normalizeClientEmail(clientEmail);
            setDuplicateExistingClient(null);
          }
        }}
        existingClient={duplicateExistingClient}
        typedName={`${clientFirstName} ${clientLastName}`.trim()}
        onAddToSheet={async (client) => {
          setShowDuplicateDialog(false);
          dismissedDuplicateEmailRef.current = normalizeClientEmail(clientEmail);
          setDuplicateExistingClient(null);
          setShowCreateClientDialog(false);
          await handleSelectClient(client);
        }}
        onDeleted={async () => {
          setShowDuplicateDialog(false);
          setDuplicateExistingClient(null);
          dismissedDuplicateEmailRef.current = null;
          lastAutoOpenedDuplicateEmailRef.current = null;
          // Drop any stale "existingClient" hint so the next add doesn't short-circuit.
          setExistingClient(null);
          invalidateAgentContactsCache();
          // The old CRM row is gone — keep typed values and immediately retry the manual
          // add so the agent doesn't have to click "Add This Contact" again.
          setShowCreateClientDialog(false);
          await handleAddManualContactClick();
        }}
      />

    </Dialog>
  );
}
