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
  
  // Validation errors
  const [errors, setErrors] = useState<{
    hotSheetName?: string;
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

  // Collapsible sections - All open by default for better visibility
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  // Fetch hot sheet data on mount if editing
  useEffect(() => {
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
      // Normalize loaded state to 2-letter code, default to MA
      const loadedState = criteria.state as string | undefined;
      const normalizedState = loadedState && loadedState.length > 2
        ? (US_STATES.find(s => s.name === loadedState)?.code ?? loadedState)
        : (loadedState || "MA");
      setState(normalizedState);
      setClientFirstName(criteria.clientFirstName || "");
      setClientLastName(criteria.clientLastName || "");
      setClientEmail(criteria.clientEmail || "");
      setClientPhone(criteria.clientPhone ? formatPhoneNumber(criteria.clientPhone) : "");
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

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  const selectAllTowns = () => {
    setSelectedCities(townsList);
    toast.success(`Selected all ${townsList.length} towns`);
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
        let query = supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");

        // Property types - map to database values
        const propertyTypeMap: Record<string, string> = {
          'single_family': 'Single Family',
          'condo': 'Condominium',
          'multi_family': 'Multi Family',
          'townhouse': 'Townhouse',
          'land': 'Land',
          'commercial': 'Commercial',
          'business_opp': 'Business Opportunity'
        };
        
        if (propertyTypes.length > 0) {
          const mappedTypes = propertyTypes.map(type => propertyTypeMap[type] || type);
          query = query.in("property_type", mappedTypes);
        }
        
        // Location filters
        if (state) {
          query = query.eq("state", state);
        }
        if (selectedCities.length > 0) {
          // Handle both city-only and city-neighborhood formats
          const cityFilters = selectedCities.map((cityStr: string) => {
            const parts = cityStr.split(',');
            const cityPart = parts[0].trim();
            
            // Check if it's a city-neighborhood format (e.g., "Boston-Charlestown")
            if (cityPart.includes('-')) {
              const [city, neighborhood] = cityPart.split('-').map(s => s.trim());
              return { city, neighborhood };
            }
            
            return { city: cityPart, neighborhood: null };
  });

  // Reset search input when state or county changes
  useEffect(() => {
    setCitySearch("");
  }, [state, selectedCountyId]);
          
          // Group by cities that have neighborhoods vs just cities
          const citiesWithNeighborhoods = cityFilters.filter(f => f.neighborhood);
          const citiesOnly = cityFilters.filter(f => !f.neighborhood).map(f => f.city);
          
          // Build complex filter: (city in citiesOnly) OR (city=X AND neighborhood=Y) OR ...
          if (citiesWithNeighborhoods.length > 0 && citiesOnly.length > 0) {
            // Need to use OR logic with multiple conditions
            query = query.or(
              `city.in.(${citiesOnly.join(',')}),` +
              citiesWithNeighborhoods.map(f => `and(city.eq.${f.city},neighborhood.eq.${f.neighborhood})`).join(',')
            );
          } else if (citiesWithNeighborhoods.length > 0) {
            // Only neighborhoods specified
            query = query.or(
              citiesWithNeighborhoods.map(f => `and(city.eq.${f.city},neighborhood.eq.${f.neighborhood})`).join(',')
            );
          } else if (citiesOnly.length > 0) {
            // Only cities specified (no neighborhoods)
            query = query.in("city", citiesOnly);
          }
        }
        if (zipCode) {
          query = query.eq("zip_code", zipCode);
        }
        
        // Price filters
        if (minPrice) {
          query = query.gte("price", parseFloat(minPrice));
        }
        if (maxPrice) {
          query = query.lte("price", parseFloat(maxPrice));
        }
        
        // Size filters
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
        
        // Lot size
        if (minLotSize) {
          query = query.gte("lot_size", parseFloat(minLotSize));
        }
        if (maxLotSize) {
          query = query.lte("lot_size", parseFloat(maxLotSize));
        }
        
        // Year built
        if (minYearBuilt) {
          query = query.gte("year_built", parseInt(minYearBuilt));
        }
        if (maxYearBuilt) {
          query = query.lte("year_built", parseInt(maxYearBuilt));
        }
        
        // Waterfront features
        if (waterfront !== null) {
          query = query.eq("waterfront", waterfront);
        }
        if (waterView !== null) {
          query = query.eq("water_view", waterView);
        }
        if (beachNearby !== null) {
          query = query.eq("beach_nearby", beachNearby);
        }
        
        // Garage and parking
        if (minGarageSpaces) {
          query = query.gte("garage_spaces", parseInt(minGarageSpaces));
        }
        if (minParkingSpaces) {
          query = query.gte("total_parking_spaces", parseInt(minParkingSpaces));
        }
        
        // Basement
        if (basement !== null) {
          query = query.eq("has_basement", basement);
        }
        
        // Parking (includes garage)
        if (hasParking !== null) {
          if (hasParking) {
            query = query.or("garage_spaces.gt.0,total_parking_spaces.gt.0");
          }
        }
        
        // Fireplaces
        if (minFireplaces) {
          query = query.gte("num_fireplaces", parseInt(minFireplaces));
        }

        const { count } = await query;
        setMatchingListingsCount(count || 0);
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
    minLotSize,
    maxLotSize,
    minYearBuilt,
    maxYearBuilt,
    waterfront,
    waterView,
    beachNearby,
    minGarageSpaces,
    minParkingSpaces,
    basement,
    hasParking,
    minFireplaces
  ]);

  // Validation schema
  const hotSheetSchema = z.object({
    hotSheetName: z.string()
      .trim()
      .min(1, "Hot sheet name is required")
      .max(100, "Hot sheet name must be less than 100 characters"),
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
    
    // Validate form
    const validation = hotSheetSchema.safeParse({
      hotSheetName,
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
      toast.error("Please fix the validation errors");
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
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

        toast.success("Hot sheet created successfully!");
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess(createdHotSheet.id);
          onOpenChange(false);
          resetForm();
        }, 1500);
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
          <div className="mt-2 p-3 bg-primary/10 rounded-md">
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
                  placeholder="(555) 123-4567"
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

                  {/* Search by Address Section */}
                  <Collapsible open={addressOpen} onOpenChange={setAddressOpen} className="border-t pt-4">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-3 rounded-md border-2 border-border">
                        <Label className="text-sm font-semibold uppercase cursor-pointer">Search by Address</Label>
                        {addressOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 pt-4">
                        {/* Address Mode Radio Buttons */}
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="street-address"
                              name="address-mode"
                              checked={addressMode === "street"}
                              onChange={() => setAddressMode("street")}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="street-address" className="text-sm">Street Address</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="my-location"
                              name="address-mode"
                              checked={addressMode === "mylocation"}
                              onChange={() => setAddressMode("mylocation")}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="my-location" className="text-sm">My Location</Label>
                          </div>
                        </div>

                        {/* Address Fields */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="street-number" className="text-sm">Street #</Label>
                            <Input
                              id="street-number"
                              placeholder=""
                              value={streetNumber}
                              onChange={(e) => setStreetNumber(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="street-name" className="text-sm">Street Name</Label>
                            <Input
                              id="street-name"
                              placeholder=""
                              value={streetName}
                              onChange={(e) => setStreetName(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="zip-code" className="text-sm">Zip Code</Label>
                            <Input
                              id="zip-code"
                              placeholder=""
                              value={zipCode}
                              onChange={(e) => setZipCode(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2 relative">
                            <Label htmlFor="radius" className="text-sm">Radius</Label>
                            <div className="relative">
                              <Input
                                id="radius"
                                placeholder=""
                                value={radiusMiles}
                                onChange={(e) => setRadiusMiles(e.target.value)}
                                className="text-sm pr-12"
                              />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                                Miles
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Towns Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold uppercase">Towns</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="text-sm text-green-600 p-0 h-auto"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      >
                        BACK TO TOP ↑
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-sm">State</Label>
                        <Select value={state} onValueChange={setState}>
                          <SelectTrigger id="state" className="bg-background text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50 max-h-[300px]">
                            {US_STATES.map((stateItem) => (
                              <SelectItem key={stateItem.code} value={stateItem.code} className="text-sm">
                                {stateItem.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coverage-areas" className="text-sm">Coverage Areas</Label>
                        <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
                          <SelectTrigger id="coverage-areas" className="bg-background text-sm">
                            <SelectValue placeholder="All Counties" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50 max-h-[300px]">
                            <SelectItem value="all" className="text-sm">
                              All Counties
                            </SelectItem>
                            {countiesForState.map((county) => (
                              <SelectItem key={county.id} value={county.id} className="text-sm">
                                {county.name} County
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Show Areas</Label>
                        <div className="flex gap-4 mt-2">
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Input
                          placeholder="Type Full or Partial Name"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          className="text-sm"
                        />
                        <div className="border rounded-md bg-background max-h-60 overflow-y-auto p-2">
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
                            variant="checkbox"
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
                        <div className="border rounded-md p-3 bg-background min-h-[200px] max-h-60 overflow-y-auto">
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
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type Towns/Areas"
                          className="text-sm flex-1"
                        />
                        <Button type="button" className="bg-blue-500 hover:bg-blue-600 text-white px-4 text-sm">
                          Add
                        </Button>
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-price">Max Price</Label>
                        <FormattedInput
                          id="max-price"
                          format="currency"
                          placeholder="1000000"
                          value={maxPrice}
                          onChange={(value) => setMaxPrice(value)}
                        />
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleValidateAndShowConfirmation} 
              disabled={saving}
              className="relative min-w-[180px]"
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

            {/* Client Information */}
            <div className="border-b pb-3">
              <p className="text-sm font-semibold text-foreground mb-2">Client Information</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium">Name:</span> {clientFirstName} {clientLastName}</p>
                <p><span className="font-medium">Email:</span> {clientEmail}</p>
                {clientPhone && <p><span className="font-medium">Phone:</span> {clientPhone}</p>}
              </div>
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
              <div className="bg-primary/10 p-3 rounded-md">
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
    </Dialog>
  );
}