import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedInput } from "@/components/ui/formatted-input";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, CalendarIcon, Home, CheckCircle2, Cloud, AlertCircle, ArrowLeft, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { bostonNeighborhoods, bostonNeighborhoodsWithAreas } from "@/data/bostonNeighborhoods";
import { z } from "zod";
import listingIcon from "@/assets/listing-creation-icon.png";
import { PhotoManagementDialog } from "@/components/PhotoManagementDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { US_STATES, getCountiesForState } from "@/data/usStatesCountiesData";
import { usCitiesByState } from "@/data/usCitiesData";
import { getCitiesForCounty, hasCountyCityMapping } from "@/data/countyToCities";
import { getZipCodesForCity, hasZipCodeData } from "@/data/usZipCodesByCity";

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  uploaded?: boolean;
  url?: string;
}

// Massachusetts counties
const MA_COUNTIES = [
  "Barnstable", "Berkshire", "Bristol", "Dukes", "Essex", "Franklin", 
  "Hampden", "Hampshire", "Middlesex", "Nantucket", "Norfolk", "Plymouth", 
  "Suffolk", "Worcester"
];

// Zod validation schema for listing data
const listingSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(500, "Address must be less than 500 characters"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  zip_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "ZIP code is required and must be valid (e.g., 02134 or 02134-5678)"),
  price: z.number().min(1000, "Price must be at least $1,000").max(100000000, "Price must be less than $100,000,000"),
  property_type: z.string().min(1, "Property type is required"),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more").max(50, "Bedrooms must be 50 or less").optional(),
  bathrooms: z.number().min(0, "Bathrooms must be 0 or more").max(50, "Bathrooms must be 50 or less").optional(),
  square_feet: z.number().int().min(1, "Square feet must be at least 1").max(100000, "Square feet must be less than 100,000").optional(),
  year_built: z.number().int().min(1800, "Year built must be 1800 or later").max(new Date().getFullYear() + 1, "Year built cannot be in the future").optional(),
  lot_size: z.number().min(0, "Lot size must be 0 or more").optional(),
  description: z.string().max(5000, "Description must be less than 5,000 characters").optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
});

const toTitleCase = (value: string) => {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const AddListing = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    status: "active",
    listing_type: "for_sale",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    county: "",
    town: "",
    neighborhood: "",
    latitude: null as number | null,
    longitude: null as number | null,
    property_type: "Single Family",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    lot_size: "",
    year_built: "",
    price: "",
    list_date: new Date().toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    activation_date: "",
    description: "",
    commission_rate: "",
    commission_type: "percentage",
    commission_notes: "",
    showing_instructions: "",
    lockbox_code: "",
    virtual_tour_url: "",
    appointment_required: false,
    showing_contact_name: "",
    showing_contact_phone: "",
    additional_notes: "",
    annual_property_tax: "",
    tax_year: new Date().getFullYear().toString(),
    tax_assessment_value: "",
  });

  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Store fetched property data
  const [attomData, setAttomData] = useState<any>(null);
  const [walkScoreData, setWalkScoreData] = useState<any>(null);
  const [schoolsData, setSchoolsData] = useState<any>(null);
  const [valueEstimate, setValueEstimate] = useState<any>(null);
  
  // Address dropdown state
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [availableCounties, setAvailableCounties] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableZips, setAvailableZips] = useState<string[]>([]);
  const [suggestedZips, setSuggestedZips] = useState<string[]>([]);
  const [suggestedZipsLoading, setSuggestedZipsLoading] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [fetchingData, setFetchingData] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showCityList, setShowCityList] = useState(true);
  const [waterViewType, setWaterViewType] = useState<string | null>(null);
  const [addressLocked, setAddressLocked] = useState(false);
  const suppressLocationEffects = useRef(false);

  // Normalize state to 2-letter code for neighborhood lookups
  const rawState = (selectedState || "").trim();
  const stateKey = rawState && rawState.length > 2
    ? (US_STATES.find(s => s.name.toLowerCase() === rawState.toLowerCase())?.code ?? rawState)
    : rawState.toUpperCase();

  // Sale listing criteria
  const [listingAgreementTypes, setListingAgreementTypes] = useState<string[]>([]);
  const [entryOnly, setEntryOnly] = useState<boolean | null>(null);
  const [lenderOwned, setLenderOwned] = useState<boolean | null>(null);
  const [shortSale, setShortSale] = useState<boolean | null>(null);
  const [propertyStyles, setPropertyStyles] = useState<string[]>([]);
  const [waterfront, setWaterfront] = useState<boolean | null>(null);
  const [waterView, setWaterView] = useState<boolean | null>(null);
  const [beachNearby, setBeachNearby] = useState<boolean | null>(null);
  const [facingDirection, setFacingDirection] = useState<string[]>([]);
  const [minFireplaces, setMinFireplaces] = useState("");
  const [basement, setBasement] = useState<boolean | null>(null);
  const [garageSpaces, setGarageSpaces] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [constructionFeatures, setConstructionFeatures] = useState<string[]>([]);
  const [roofMaterials, setRoofMaterials] = useState<string[]>([]);
  const [exteriorFeatures, setExteriorFeatures] = useState<string[]>([]);
  const [heatingTypes, setHeatingTypes] = useState<string[]>([]);
  const [coolingTypes, setCoolingTypes] = useState<string[]>([]);
  const [greenFeatures, setGreenFeatures] = useState<string[]>([]);

  // Unit number - for Condominiums, Townhouses, Multi-Family, and Rentals
  const [unitNumber, setUnitNumber] = useState("");
  
  // Condominium-specific fields
  const [condoUnitNumber, setCondoUnitNumber] = useState("");
  const [condoFloorLevel, setCondoFloorLevel] = useState("");
  const [condoHoaFee, setCondoHoaFee] = useState("");
  const [condoHoaFeeFrequency, setCondoHoaFeeFrequency] = useState("monthly");
  const [condoBuildingAmenities, setCondoBuildingAmenities] = useState<string[]>([]);
  const [condoPetPolicy, setCondoPetPolicy] = useState("");
  const [condoPetPolicyComments, setCondoPetPolicyComments] = useState("");
  const [condoTotalUnits, setCondoTotalUnits] = useState("");
  const [condoYearBuilt, setCondoYearBuilt] = useState("");

  // Multi-family specific fields
  const [multiFamilyUnits, setMultiFamilyUnits] = useState("");
  const [multiFamilyUnitBreakdown, setMultiFamilyUnitBreakdown] = useState("");
  const [multiFamilyCurrentIncome, setMultiFamilyCurrentIncome] = useState("");
  const [multiFamilyPotentialIncome, setMultiFamilyPotentialIncome] = useState("");
  const [multiFamilyOccupancyStatus, setMultiFamilyOccupancyStatus] = useState("");
  const [multiFamilyLaundryType, setMultiFamilyLaundryType] = useState("");
  const [multiFamilySeparateUtilities, setMultiFamilySeparateUtilities] = useState<string[]>([]);
  const [multiFamilyParkingPerUnit, setMultiFamilyParkingPerUnit] = useState("");

  // Commercial property specific fields
  const [commercialSpaceType, setCommercialSpaceType] = useState("");
  const [commercialLeaseType, setCommercialLeaseType] = useState("");
  const [commercialLeaseRate, setCommercialLeaseRate] = useState("");
  const [commercialLeaseRatePer, setCommercialLeaseRatePer] = useState("sqft_year");
  const [commercialLeaseTermMin, setCommercialLeaseTermMin] = useState("");
  const [commercialLeaseTermMax, setCommercialLeaseTermMax] = useState("");
  const [commercialZoning, setCommercialZoning] = useState("");
  const [commercialBusinessTypes, setCommercialBusinessTypes] = useState<string[]>([]);
  const [commercialTenantResponsibilities, setCommercialTenantResponsibilities] = useState<string[]>([]);
  const [commercialCurrentTenant, setCommercialCurrentTenant] = useState("");
  const [commercialLeaseExpiration, setCommercialLeaseExpiration] = useState("");
  const [commercialCeilingHeight, setCommercialCeilingHeight] = useState("");
  const [commercialLoadingDocks, setCommercialLoadingDocks] = useState("");
  const [commercialPowerAvailable, setCommercialPowerAvailable] = useState("");
  const [commercialAdditionalFeatures, setCommercialAdditionalFeatures] = useState<string[]>([]);

  // Additional property detail fields
  const [assessedValue, setAssessedValue] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [residentialExemption, setResidentialExemption] = useState("Unknown");
  const [floors, setFloors] = useState("");
  const [basementType, setBasementType] = useState<string[]>([]);
  const [basementFeatures, setBasementFeatures] = useState<string[]>([]);
  const [basementFloorType, setBasementFloorType] = useState<string[]>([]);
  const [leadPaint, setLeadPaint] = useState("Unknown");
  const [handicapAccess, setHandicapAccess] = useState("Unknown");
  const [foundation, setFoundation] = useState<string[]>([]);
  const [parkingComments, setParkingComments] = useState("");
  const [parkingFeatures, setParkingFeatures] = useState<string[]>([]);
  const [garageComments, setGarageComments] = useState("");
  const [garageFeatures, setGarageFeatures] = useState<string[]>([]);
  const [garageAdditionalFeatures, setGarageAdditionalFeatures] = useState<string[]>([]);
  const [lotSizeSource, setLotSizeSource] = useState<string[]>([]);
  const [lotDescription, setLotDescription] = useState<string[]>([]);
  const [sellerDisclosure, setSellerDisclosure] = useState("No");
  const [disclosuresText, setDisclosuresText] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [brokerComments, setBrokerComments] = useState("");

  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [floorPlanUrls, setFloorPlanUrls] = useState<string[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const [openHouses, setOpenHouses] = useState<Array<{
    type: 'public' | 'broker';
    date: string;
    start_time: string;
    end_time: string;
    notes: string;
  }>>([]);
  
  const [openHouseDialogOpen, setOpenHouseDialogOpen] = useState(false);
  const [openHouseDialogType, setOpenHouseDialogType] = useState<'public' | 'broker'>('public');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dialogStartTime, setDialogStartTime] = useState('');
  const [dialogEndTime, setDialogEndTime] = useState('');
  const [dialogComments, setDialogComments] = useState('');

  // Progress tracking
  const calculateSectionProgress = () => {
    const sections = {
      listingBasics: {
        name: 'Listing Basics',
        fields: [formData.listing_type, formData.property_type, formData.status],
        completed: 0,
        total: 3
      },
      propertyLocation: {
        name: 'Property Location',
        fields: [formData.address, formData.city, formData.state, formData.zip_code, formData.price],
        completed: 0,
        total: 5
      },
      coreDetails: {
        name: 'Core Property Details',
        fields: [formData.bedrooms, formData.bathrooms, formData.square_feet, formData.year_built],
        completed: 0,
        total: 4
      },
      typeSpecific: {
        name: 'Property Type Details',
        fields: formData.property_type === 'Condominium' 
          ? [condoHoaFee, condoBuildingAmenities.length > 0]
          : formData.property_type === 'Multi Family'
          ? [multiFamilyUnits, multiFamilyUnitBreakdown]
          : formData.property_type === 'Commercial'
          ? [commercialSpaceType, commercialLeaseType]
          : [true],
        completed: 0,
        total: formData.property_type === 'Condominium' || formData.property_type === 'Multi Family' || formData.property_type === 'Commercial' ? 2 : 1
      },
      photosMedia: {
        name: 'Photos & Media',
        fields: [photos.length > 0],
        completed: 0,
        total: 1
      },
      description: {
        name: 'Property Description',
        fields: [formData.description],
        completed: 0,
        total: 1
      },
      saleCriteria: {
        name: 'Sale Criteria & Features',
        fields: [listingAgreementTypes.length > 0, propertyStyles.length > 0],
        completed: 0,
        total: 2
      },
      features: {
        name: 'Features & Amenities',
        fields: [propertyFeatures.length > 0, amenities.length > 0],
        completed: 0,
        total: 2
      },
      financial: {
        name: 'Financial Information',
        fields: [formData.commission_rate, formData.commission_type],
        completed: 0,
        total: 2
      },
      showing: {
        name: 'Showing & Access',
        fields: [formData.showing_instructions, formData.showing_contact_name],
        completed: 0,
        total: 2
      },
      buildingDetails: {
        name: 'Building Details',
        fields: [formData.annual_property_tax, formData.tax_year],
        completed: 0,
        total: 2
      },
      openHouses: {
        name: 'Open Houses',
        fields: [openHouses.length > 0],
        completed: 0,
        total: 1
      },
      disclosures: {
        name: 'Disclosures & Legal',
        fields: [disclosures.length > 0, sellerDisclosure],
        completed: 0,
        total: 2
      }
    };

    // Calculate completion for each section
    Object.keys(sections).forEach((key) => {
      const section = sections[key as keyof typeof sections];
      section.completed = section.fields.filter((field) => {
        if (typeof field === 'boolean') return field;
        if (typeof field === 'string') return field.trim().length > 0;
        if (typeof field === 'number') return field > 0;
        return false;
      }).length;
    });

    return sections;
  };

  const sectionProgress = calculateSectionProgress();
  const totalCompleted = Object.values(sectionProgress).reduce((sum, section) => sum + section.completed, 0);
  const totalFields = Object.values(sectionProgress).reduce((sum, section) => sum + section.total, 0);
  const overallProgress = Math.round((totalCompleted / totalFields) * 100);

  // Track form changes for unsaved changes warning
  useEffect(() => {
    // Skip if it's the initial mount (no changes yet)
    if (!user) return;
    
    const hasContent = formData.address || formData.city || formData.price || 
                       formData.bedrooms || formData.description;
    if (hasContent) {
      setHasUnsavedChanges(true);
    }
  }, [formData, user]);

  // Auto-save functionality
  useEffect(() => {
    if (!user || !hasUnsavedChanges) return;

    const autoSaveInterval = setInterval(() => {
      handleSaveDraft(true);
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [user, hasUnsavedChanges, formData]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Update available counties when state changes
  useEffect(() => {
    if (suppressLocationEffects.current) return;
    if (selectedState) {
      const counties = getCountiesForState(selectedState);
      setAvailableCounties(counties);
      setSelectedCounty("all");
      setSelectedCity("");
      setAvailableCities([]);
      setAvailableZips([]);
      setFormData(prev => ({ ...prev, city: "", state: selectedState, zip_code: "" }));
    }
  }, [selectedState]);
 
  // Update available cities when county changes
  useEffect(() => {
    if (suppressLocationEffects.current) return;
    if (selectedState && selectedCounty) {
      const hasCountyData = hasCountyCityMapping(selectedState);
      let cities: string[] = [];
      
      if (hasCountyData && selectedCounty !== "all") {
        cities = getCitiesForCounty(selectedState, selectedCounty);
      } else {
        cities = usCitiesByState[selectedState] || [];
      }
      
      setAvailableCities(cities);
      setSelectedCity("");
      setAvailableZips([]);
      setFormData(prev => ({ ...prev, city: "", zip_code: "" }));
    }
  }, [selectedState, selectedCounty]);

  // Fetch ZIP codes when city changes
  useEffect(() => {
    if (suppressLocationEffects.current) return;
    const fetchZipCodes = async () => {
      if (selectedState && selectedCity) {
        setSuggestedZipsLoading(true);
        try {
          let zips: string[] = [];
          // Try static data first
          if (hasZipCodeData(selectedCity, selectedState)) {
            const staticZips = getZipCodesForCity(selectedCity, selectedState);
            zips = staticZips;
          } else {
            // Fallback to edge function
            const { data, error } = await supabase.functions.invoke('get-city-zips', {
              body: { state: selectedState, city: selectedCity }
            });
            if (error) throw error;
            zips = data?.zips || [];
          }

          setSuggestedZips(zips);
          setAvailableZips(zips);
          setFormData(prev => {
            const keepExistingZip =
              prev.city === selectedCity &&
              prev.zip_code &&
              zips.includes(prev.zip_code);
            return {
              ...prev,
              city: selectedCity,
              zip_code: keepExistingZip ? prev.zip_code : "",
            };
          });
        } catch (error) {
          console.error("Error fetching ZIP codes:", error);
          toast.error("Could not load ZIP codes for this city");
          setSuggestedZips([]);
          setAvailableZips([]);
        } finally {
          setSuggestedZipsLoading(false);
        }
      } else {
        setSuggestedZips([]);
        setFormData(prev => ({ ...prev, zip_code: "" }));
      }
    };
 
    fetchZipCodes();
  }, [selectedState, selectedCity]);

  // Auto-expand cities with neighborhoods
  useEffect(() => {
    if (selectedState && availableCities.length > 0) {
      const citiesToExpand = new Set<string>();

      availableCities.forEach((city) => {
        if (city.includes("-")) return; // skip neighborhood-like entries

        const hasNeighborhoodsFromData =
          getAreasForCity(city, stateKey || selectedState).length > 0;

        const hasHyphenatedAreas = availableCities.some((t) =>
          t.startsWith(`${city}-`)
        );

        if (hasNeighborhoodsFromData || hasHyphenatedAreas) {
          citiesToExpand.add(city);
        }
      });

      // Also ensure the currently selected city is expanded, if it has areas
      if (selectedCity && availableCities.includes(selectedCity)) {
        const hasNeighborhoodsForSelected =
          getAreasForCity(selectedCity, stateKey || selectedState).length > 0 ||
          availableCities.some((t) => t.startsWith(`${selectedCity}-`));
        if (hasNeighborhoodsForSelected) {
          citiesToExpand.add(selectedCity);
        }
      }

      setExpandedCities(citiesToExpand);
    } else {
      setExpandedCities(new Set());
    }
  }, [selectedState, stateKey, availableCities.length, selectedCity]);

  const toggleCityExpansion = (city: string) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(city)) {
        newSet.delete(city);
      } else {
        newSet.add(city);
      }
      return newSet;
    });
  };

  const handleCitySelect = (value: string) => {
    // User is actively changing location; enable location effects
    suppressLocationEffects.current = false;
    if (value.includes('-')) {
      // It's a neighborhood selection
      const [city, neighborhood] = value.split('-');
      setSelectedCity(city);
      setFormData(prev => ({ 
        ...prev, 
        city: toTitleCase(city),
        neighborhood: toTitleCase(neighborhood),
        zip_code: '' // Clear ZIP when changing location
      }));
    } else {
      // It's a city selection
      setSelectedCity(value);
      setFormData(prev => ({ 
        ...prev, 
        city: toTitleCase(value),
        neighborhood: '',
        zip_code: ''
      }));
    }
    setShowCityList(false);
    setValidationErrors([]);
  };

  const handleNeighborhoodSelect = (neighborhood: string) => {
    setFormData(prev => ({ ...prev, neighborhood: toTitleCase(neighborhood) }));
  };

  const handleZipSelect = (zip: string) => {
    setFormData(prev => ({ ...prev, zip_code: zip }));
    setValidationErrors([]);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load existing listing if in edit mode
  useEffect(() => {
    if (id && user?.id) {
      loadExistingListing(id);
    }
  }, [id, user?.id]);

  const loadExistingListing = async (listingId: string) => {
    suppressLocationEffects.current = true;
    setIsLoadingExisting(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        toast.error("Listing not found");
        navigate("/add-listing");
        return;
      }
      
      // Check ownership
      if (data.agent_id !== user.id) {
        toast.error("You don't have permission to edit this listing");
        navigate("/agent-dashboard");
        return;
      }
      
      // Store original status for comparison
      setOriginalStatus(data.status || "active");
      
      // Populate form data from loaded listing
      setFormData({
        status: data.status || "active",
        listing_type: data.listing_type || "for_sale",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        zip_code: data.zip_code || "",
        county: "",
        town: "",
        neighborhood: data.neighborhood || "",
        latitude: data.latitude,
        longitude: data.longitude,
        property_type: data.property_type || "Single Family",
        bedrooms: data.bedrooms?.toString() || "",
        bathrooms: data.bathrooms?.toString() || "",
        square_feet: data.square_feet?.toString() || "",
        lot_size: data.lot_size?.toString() || "",
        year_built: data.year_built?.toString() || "",
        price: data.price?.toString() || "",
        list_date: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        activation_date: data.activation_date || "",
        description: data.description || "",
        commission_rate: data.commission_rate?.toString() || "",
        commission_type: data.commission_type || "percentage",
        commission_notes: data.commission_notes || "",
        showing_instructions: data.showing_instructions || "",
        lockbox_code: data.lockbox_code || "",
        virtual_tour_url: data.virtual_tour_url || "",
        appointment_required: data.appointment_required || false,
        showing_contact_name: data.showing_contact_name || "",
        showing_contact_phone: data.showing_contact_phone || "",
        additional_notes: data.additional_notes || "",
        annual_property_tax: data.annual_property_tax?.toString() || "",
        tax_year: data.tax_year?.toString() || new Date().getFullYear().toString(),
        tax_assessment_value: data.tax_assessment_value?.toString() || "",
      });
      
      // Set location state variables without triggering clearing side effects
      if (data.state) {
        setSelectedState(data.state);
        const counties = getCountiesForState(data.state);
        setAvailableCounties(counties);
      }
      if (data.city) {
        setSelectedCity(data.city);
        const hasCountyData = data.state ? hasCountyCityMapping(data.state) : false;
        let cities: string[] = [];
        if (data.state) {
          if (hasCountyData && selectedCounty !== "all") {
            cities = getCitiesForCounty(data.state, selectedCounty);
          } else {
            cities = usCitiesByState[data.state] || [];
          }
        }
        setAvailableCities(cities);
 
        if (data.state && hasZipCodeData(data.city, data.state)) {
          const zips = getZipCodesForCity(data.city, data.state);
          setSuggestedZips(zips);
          setAvailableZips(zips);
        }
      }
      
      // Set features and amenities
      if (Array.isArray(data.property_features)) setPropertyFeatures(data.property_features as string[]);
      if (Array.isArray(data.amenities)) setAmenities(data.amenities as string[]);
      if (Array.isArray(data.disclosures)) setDisclosures(data.disclosures as string[]);
      
      // Load existing media and hydrate UI states
      const extractMediaUrls = (items: any): string[] => {
        if (!Array.isArray(items)) return [];
        return items
          .map((item) => (typeof item === "string" ? item : item?.url))
          .filter((url): url is string => Boolean(url));
      };

      const loadedPhotoUrls = extractMediaUrls(data.photos);
      const loadedFloorPlanUrls = extractMediaUrls(data.floor_plans);
      const loadedDocumentUrls = extractMediaUrls(data.documents);

      if (loadedPhotoUrls.length > 0) {
        setPhotoUrls(loadedPhotoUrls);
        setPhotos(
          loadedPhotoUrls.map((url, index) => ({
            file: new File([], `photo-${index + 1}`),
            preview: url,
            id: `${Date.now()}-photo-${index}`,
            uploaded: true,
            url,
          }))
        );
      }

      if (loadedFloorPlanUrls.length > 0) {
        setFloorPlanUrls(loadedFloorPlanUrls);
        setFloorPlans(
          loadedFloorPlanUrls.map((url, index) => ({
            file: new File([], `floorplan-${index + 1}`),
            preview: url,
            id: `${Date.now()}-floor-${index}`,
            uploaded: true,
            url,
          }))
        );
      }

      if (loadedDocumentUrls.length > 0) {
        setDocumentUrls(loadedDocumentUrls);
        setDocuments(
          loadedDocumentUrls.map((url, index) => ({
            file: new File([], `document-${index + 1}`),
            preview: "",
            id: `${Date.now()}-doc-${index}`,
            uploaded: true,
            url,
          }))
        );
      }
      
      // Multi-family details
      if (data.multi_family_details && typeof data.multi_family_details === 'object') {
        const multi = data.multi_family_details as any;
        if (multi.number_of_units) setMultiFamilyUnits(multi.number_of_units.toString());
        if (multi.unit_breakdown) setMultiFamilyUnitBreakdown(multi.unit_breakdown);
        if (multi.current_monthly_income) setMultiFamilyCurrentIncome(multi.current_monthly_income.toString());
        if (multi.potential_monthly_income) setMultiFamilyPotentialIncome(multi.potential_monthly_income.toString());
        if (multi.occupancy_status) setMultiFamilyOccupancyStatus(multi.occupancy_status);
        if (multi.laundry_type) setMultiFamilyLaundryType(multi.laundry_type);
        if (Array.isArray(multi.separate_utilities)) setMultiFamilySeparateUtilities(multi.separate_utilities);
        if (multi.parking_per_unit) setMultiFamilyParkingPerUnit(multi.parking_per_unit.toString());
      }
      
      // Commercial details
      if (data.commercial_details && typeof data.commercial_details === 'object') {
        const comm = data.commercial_details as any;
        if (comm.space_type) setCommercialSpaceType(comm.space_type);
        if (comm.lease_type) setCommercialLeaseType(comm.lease_type);
        if (comm.lease_rate) setCommercialLeaseRate(comm.lease_rate.toString());
        if (comm.lease_rate_per) setCommercialLeaseRatePer(comm.lease_rate_per);
        if (comm.lease_term_min) setCommercialLeaseTermMin(comm.lease_term_min.toString());
        if (comm.lease_term_max) setCommercialLeaseTermMax(comm.lease_term_max.toString());
        if (comm.zoning) setCommercialZoning(comm.zoning);
        if (Array.isArray(comm.allowed_business_types)) setCommercialBusinessTypes(comm.allowed_business_types);
        if (Array.isArray(comm.tenant_responsibilities)) setCommercialTenantResponsibilities(comm.tenant_responsibilities);
      }
      
      toast.success("Listing loaded for editing");
      
    } catch (error) {
      console.error("Error loading listing:", error);
      toast.error("Failed to load listing");
      navigate("/add-listing");
    } finally {
      setIsLoadingExisting(false);
    }
  };

  // Parse unit from a street line like "123 Main St Apt 4B" or "123 Main St #4B"
  const extractUnitFromAddress = (streetLine: string) => {
    const pattern = /(.*?)(?:\s+(?:#|Unit|Apt|Apartment|Suite|Ste)\s*([A-Za-z0-9-]+))$/i;
    const match = streetLine.match(pattern);
    if (match) {
      return { street: match[1].trim(), unit: match[2].trim() };
    }
    return { street: streetLine.trim(), unit: "" };
  };

  const handleFetchPropertyData = useCallback(async () => {
    const { address, city, state, zip_code } = formData;
    
    if (!address || !city || !state || !zip_code) {
      toast.error("Please fill in all address fields before fetching property data");
      return;
    }

    // Validate ZIP format
    if (!/^\d{5}(-\d{4})?$/.test(zip_code)) {
      toast.error("Please enter a valid ZIP code (e.g., 02134 or 02134-5678)");
      return;
    }

    setFetchingData(true);
    toast.info("Fetching property data...");
    
    // Extract unit number if present in address
    const { street, unit } = extractUnitFromAddress(address);
    if (unit && !unitNumber) {
      setUnitNumber(unit);
    }

    // Try to geocode the address to get coordinates for Walk Score and Schools
    const fullAddress = `${address}, ${city}, ${state} ${zip_code}`;
    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === "OK" && geocodeData.results?.[0]?.geometry?.location) {
        latitude = geocodeData.results[0].geometry.location.lat;
        longitude = geocodeData.results[0].geometry.location.lng;
        console.log("[AddListing] Geocoded address:", { latitude, longitude });
        
        // Update form with coordinates
        setFormData(prev => ({ ...prev, latitude, longitude }));
      } else {
        console.warn("[AddListing] Geocoding failed:", geocodeData.status);
        toast.warning("Could not verify exact coordinates, but will still fetch available property data");
      }
    } catch (error) {
      console.error("[AddListing] Geocoding error:", error);
      toast.warning("Could not verify coordinates, but will still fetch available property data");
    }

    // Fetch property data with whatever we have
    await fetchPropertyData(
      latitude, 
      longitude, 
      address, 
      city, 
      state, 
      zip_code, 
      unit || unitNumber, 
      formData.property_type
    );
    
    setFetchingData(false);
  }, [formData, unitNumber]);
  
  const fetchPropertyData = async (lat: number | undefined, lng: number | undefined, address: string, city: string, state: string, zip: string, unit_number?: string, property_type?: string) => {
    // For Boston neighborhoods, always use "Boston" as the city for Attom API
    const attomCity = formData.neighborhood && bostonNeighborhoods.includes(formData.neighborhood as any) ? "Boston" : city;
    
    console.log("[AddListing] fetchPropertyData called with:", { lat, lng, address, city: attomCity, state, zip, unit_number, property_type });
    setSubmitting(true);
    try {
      console.log("[AddListing] Invoking fetch-property-data edge function...");
      const { data, error } = await supabase.functions.invoke("fetch-property-data", {
        body: { latitude: lat, longitude: lng, address, city: attomCity, state, zip_code: zip, unit_number, property_type },
      });

      console.log("[AddListing] Edge function response:", { data, error });
      setDebugInfo({ source: 'fetch-property-data', payload: { lat, lng, address, city: attomCity, state, zip, unit_number, property_type }, data, error });

      if (error) throw error;

      if (data) {
        // Store all fetched data in state
        if (data.attom) {
          setAttomData(data.attom);
          
          // Update separate state variables for assessed value and fiscal year
          if (data.attom.tax_assessment_value !== undefined && data.attom.tax_assessment_value !== null) {
            setAssessedValue(data.attom.tax_assessment_value.toString());
          }
          if (data.attom.tax_year !== undefined && data.attom.tax_year !== null) {
            setFiscalYear(data.attom.tax_year.toString());
          }
          
          setFormData(prev => ({
            ...prev,
            bedrooms: data.attom.bedrooms?.toString() || prev.bedrooms,
            bathrooms: data.attom.bathrooms?.toString() || prev.bathrooms,
            square_feet: data.attom.square_feet?.toString() || prev.square_feet,
            lot_size: (data.attom.lot_size !== undefined && data.attom.lot_size !== null)
              ? (typeof data.attom.lot_size === "number"
                  ? Math.round(data.attom.lot_size).toString()
                  : (!isNaN(Number(data.attom.lot_size)) ? Math.round(Number(data.attom.lot_size)).toString() : data.attom.lot_size?.toString()))
              : prev.lot_size,
            year_built: data.attom.year_built?.toString() || prev.year_built,
            // Only update property_type if user hasn't already selected one
            property_type: prev.property_type || data.attom.property_type || prev.property_type,
            annual_property_tax: (data.attom.annual_property_tax !== undefined && data.attom.annual_property_tax !== null)
              ? data.attom.annual_property_tax.toString()
              : prev.annual_property_tax,
            tax_year: (data.attom.tax_year !== undefined && data.attom.tax_year !== null)
              ? data.attom.tax_year.toString()
              : prev.tax_year,
            tax_assessment_value: (data.attom.tax_assessment_value !== undefined && data.attom.tax_assessment_value !== null)
              ? data.attom.tax_assessment_value.toString()
              : prev.tax_assessment_value,
          }));

          // If some key fields are missing, try a lightweight fallback call to enrich data
          const missingKeyFields = [
            data.attom.bathrooms,
            data.attom.square_feet,
            data.attom.lot_size,
            data.attom.year_built,
            data.attom.property_type,
          ].some((v) => v === null || v === undefined || v === "");

          if (missingKeyFields) {
            console.warn("[AddListing] Attom missing fields; attempting supplemental test-attom fetch...");
            try {
              const fallback = await supabase.functions.invoke("test-attom", {
                body: { address, city, state, zip },
              });
              console.log("[AddListing] Supplemental test-attom response:", fallback);
              const prop = (fallback.data as any)?.json?.property?.[0];
              if (prop) {
                const building = prop.building || {};
                const lot = prop.lot || {};
                const summary = prop.summary || {};
                const assessment = prop.assessment || {};
                const mapped = {
                  bedrooms: building.rooms?.beds || null,
                  bathrooms: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
                  square_feet: building.size?.bldgSize || building.size?.livingSize || null,
                  lot_size: lot.lotSize2 || lot.lotSize1 || null,
                  year_built: summary.yearBuilt || null,
                  property_type: summary.propType || null,
                  annual_property_tax: assessment.tax?.taxAmt || null,
                  tax_year: assessment.tax?.taxYear || null,
                  tax_assessment_value: assessment.assessed?.assdTtlValue || null,
                };
                
                // Update separate state variables for assessed value and fiscal year
                if (mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) {
                  setAssessedValue(String(mapped.tax_assessment_value));
                }
                if (mapped.tax_year !== null && mapped.tax_year !== undefined) {
                  setFiscalYear(String(mapped.tax_year));
                }
                
                setFormData(prev => ({
                  ...prev,
                  bedrooms: prev.bedrooms || (mapped.bedrooms?.toString() ?? prev.bedrooms),
                  bathrooms: prev.bathrooms || (mapped.bathrooms?.toString() ?? prev.bathrooms),
                  square_feet: prev.square_feet || (mapped.square_feet?.toString() ?? prev.square_feet),
                  lot_size: prev.lot_size || (
                    mapped.lot_size !== null && mapped.lot_size !== undefined
                      ? (typeof mapped.lot_size === "number"
                          ? Math.round(mapped.lot_size).toString()
                          : (!isNaN(Number(mapped.lot_size)) ? Math.round(Number(mapped.lot_size)).toString() : mapped.lot_size?.toString()))
                      : prev.lot_size
                  ),
                  year_built: prev.year_built || (mapped.year_built?.toString() ?? prev.year_built),
                  property_type: prev.property_type || (mapped.property_type ?? prev.property_type),
                  annual_property_tax: prev.annual_property_tax || ((mapped.annual_property_tax !== null && mapped.annual_property_tax !== undefined) ? String(mapped.annual_property_tax) : prev.annual_property_tax),
                  tax_year: prev.tax_year || ((mapped.tax_year !== null && mapped.tax_year !== undefined) ? String(mapped.tax_year) : prev.tax_year),
                  tax_assessment_value: prev.tax_assessment_value || ((mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) ? String(mapped.tax_assessment_value) : prev.tax_assessment_value),
                }));
                setDebugInfo((d:any) => ({ ...(d||{}), supplemental: { used: true, mapped } }));
              }
            } catch (fbErr) {
              console.error("[AddListing] Supplemental test-attom failed:", fbErr);
            }
          }
        } else {
          console.warn("[AddListing] No Attom data returned. Trying public test-attom fallback...");
          try {
            const fallback = await supabase.functions.invoke("test-attom", {
              body: { address, city, state, zip },
            });
            console.log("[AddListing] Fallback test-attom response:", fallback);
            const prop = (fallback.data as any)?.json?.property?.[0];
            if (prop) {
              const building = prop.building || {};
              const lot = prop.lot || {};
              const summary = prop.summary || {};
              const assessment = prop.assessment || {};
              const mapped = {
                bedrooms: building.rooms?.beds || null,
                bathrooms: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
                square_feet: building.size?.bldgSize || building.size?.livingSize || null,
                lot_size: lot.lotSize2 || lot.lotSize1 || null,
                year_built: summary.yearBuilt || null,
                property_type: summary.propType || null,
                annual_property_tax: assessment.tax?.taxAmt || null,
                tax_year: assessment.tax?.taxYear || null,
                tax_assessment_value: assessment.assessed?.assdTtlValue || null,
              };
              setAttomData(mapped as any);
              
              // Update separate state variables for assessed value and fiscal year
              if (mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) {
                setAssessedValue(String(mapped.tax_assessment_value));
              }
              if (mapped.tax_year !== null && mapped.tax_year !== undefined) {
                setFiscalYear(String(mapped.tax_year));
              }
              
              setFormData(prev => ({
                ...prev,
                bedrooms: mapped.bedrooms?.toString() || prev.bedrooms,
                bathrooms: mapped.bathrooms?.toString() || prev.bathrooms,
                square_feet: mapped.square_feet?.toString() || prev.square_feet,
                lot_size: (mapped.lot_size !== null && mapped.lot_size !== undefined)
                  ? (typeof mapped.lot_size === "number"
                      ? Math.round(mapped.lot_size).toString()
                      : (!isNaN(Number(mapped.lot_size)) ? Math.round(Number(mapped.lot_size)).toString() : mapped.lot_size?.toString()))
                  : prev.lot_size,
                year_built: mapped.year_built?.toString() || prev.year_built,
                property_type: mapped.property_type || prev.property_type,
                annual_property_tax: (mapped.annual_property_tax !== null && mapped.annual_property_tax !== undefined) ? String(mapped.annual_property_tax) : prev.annual_property_tax,
                tax_year: (mapped.tax_year !== null && mapped.tax_year !== undefined) ? String(mapped.tax_year) : prev.tax_year,
                tax_assessment_value: (mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) ? String(mapped.tax_assessment_value) : prev.tax_assessment_value,
              }));
              toast.success("Loaded property details from Attom (fallback)");
            }
          } catch (fbErr) {
            console.error("[AddListing] Fallback test-attom failed:", fbErr);
          }
        }
        
        if (data.walkScore) {
          setWalkScoreData(data.walkScore);
        }
        
        if (data.schools) {
          setSchoolsData(data.schools);
        }
        
        if (data.valueEstimate) {
          setValueEstimate(data.valueEstimate);
        }
        
        if (data.attom || data.walkScore || data.schools || data.valueEstimate) {
          toast.success("Property data loaded successfully");
        } else {
          toast.warning("No property data found for this address. You can continue by entering details manually.");
        }
      }
    } catch (error: any) {
      console.error("Error fetching property data:", error);
      toast.error("Could not fetch property data. Please enter details manually.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualFetch = async () => {
    console.log("[AddListing] Manual fetch clicked");
    const { address, city, state, zip_code, latitude, longitude } = formData as any;

    try {
      if (latitude && longitude && address) {
        await fetchPropertyData(latitude, longitude, address, city, state, zip_code, unitNumber, formData.property_type);
        return;
      }

      if (!address) {
        toast.error("Enter an address first");
        return;
      }

      console.log("[AddListing] Manual fetch using test-attom with:", { address, city, state, zip_code });

      // Try to derive city/state/zip from a single-line address if user typed it manually
      let derivedAddress1 = address?.trim() || "";
      let derivedCity = (city || "").trim();
      let derivedState = (state || "").trim();
      let derivedZip = (zip_code || "").trim();

      if (!derivedCity || !derivedState) {
        // Remove "USA" if present at the end
        let normalized = derivedAddress1.replace(/,\s*USA\s*$/i, "");
        const parts = normalized.split(",").map(p => p.trim()).filter(Boolean);
        
        // Expected format: "Street, City, ST ZIP" or "Street, City, ST"
        if (parts.length >= 3) {
          derivedAddress1 = parts[0];
          derivedCity = parts[1];
          const stateZipPart = parts[2];
          const sz = stateZipPart.split(/\s+/);
          derivedState = sz[0]?.toUpperCase() || "";
          derivedZip = sz[1] || "";
        } else if (parts.length === 2) {
          // Maybe "Street, City ST ZIP"
          derivedAddress1 = parts[0];
          const cityStateZip = parts[1].split(/\s+/);
          if (cityStateZip.length >= 3) {
            derivedCity = cityStateZip.slice(0, -2).join(" ");
            derivedState = cityStateZip[cityStateZip.length - 2].toUpperCase();
            derivedZip = cityStateZip[cityStateZip.length - 1];
          }
        }
      }

      if (!derivedCity || !derivedState) {
        toast.error("Please select an address from suggestions first.");
        setDebugInfo({ hint: 'missing city/state', input: address, parsed: { derivedAddress1, derivedCity, derivedState, derivedZip } });
        return;
      }

      const { data, error } = await supabase.functions.invoke("test-attom", {
        body: { address: derivedAddress1, city: derivedCity, state: derivedState, zip: derivedZip },
      });
      setDebugInfo({ source: 'manual-test-attom', req: { address: derivedAddress1, city: derivedCity, state: derivedState, zip: derivedZip }, data, error });
      if (error) throw error;
      const prop = (data as any)?.json?.property?.[0];
      if (!prop) {
        toast.error("No data found for this address");
        return;
      }
      const building = prop.building || {};
      const lot = prop.lot || {};
      const summary = prop.summary || {};
      const assessment = prop.assessment || {};
      const mapped = {
        bedrooms: building.rooms?.beds || null,
        bathrooms: building.rooms?.bathsTotal || building.rooms?.bathsFull || null,
        square_feet: building.size?.bldgSize || building.size?.livingSize || null,
        lot_size: lot.lotSize2 || lot.lotSize1 || null,
        year_built: summary.yearBuilt || null,
        property_type: summary.propType || null,
        annual_property_tax: assessment.tax?.taxAmt || null,
        tax_year: assessment.tax?.taxYear || null,
        tax_assessment_value: assessment.assessed?.assdTtlValue || null,
      };
      setAttomData(mapped as any);
      
      // Update separate state variables for assessed value and fiscal year
      if (mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) {
        setAssessedValue(String(mapped.tax_assessment_value));
      }
      if (mapped.tax_year !== null && mapped.tax_year !== undefined) {
        setFiscalYear(String(mapped.tax_year));
      }
      
      setFormData((prev: any) => ({
        ...prev,
        bedrooms: (mapped.bedrooms !== null && mapped.bedrooms !== undefined) ? String(mapped.bedrooms) : prev.bedrooms,
        bathrooms: (mapped.bathrooms !== null && mapped.bathrooms !== undefined) ? String(mapped.bathrooms) : prev.bathrooms,
        square_feet: (mapped.square_feet !== null && mapped.square_feet !== undefined) ? String(mapped.square_feet) : prev.square_feet,
        lot_size: (mapped.lot_size !== null && mapped.lot_size !== undefined)
          ? (typeof mapped.lot_size === "number"
              ? mapped.lot_size.toFixed(2)
              : (!isNaN(Number(mapped.lot_size)) ? Number(mapped.lot_size).toFixed(2) : mapped.lot_size?.toString()))
          : prev.lot_size,
        year_built: (mapped.year_built !== null && mapped.year_built !== undefined) ? String(mapped.year_built) : prev.year_built,
        property_type: mapped.property_type || prev.property_type,
        annual_property_tax: (mapped.annual_property_tax !== null && mapped.annual_property_tax !== undefined) ? String(mapped.annual_property_tax) : prev.annual_property_tax,
        tax_year: (mapped.tax_year !== null && mapped.tax_year !== undefined) ? String(mapped.tax_year) : prev.tax_year,
        tax_assessment_value: (mapped.tax_assessment_value !== null && mapped.tax_assessment_value !== undefined) ? String(mapped.tax_assessment_value) : prev.tax_assessment_value,
      }));
      toast.success("Property details loaded - " + [
        mapped.bedrooms && `${mapped.bedrooms} beds`,
        mapped.bathrooms && `${mapped.bathrooms} baths`,
        mapped.square_feet && `${mapped.square_feet} sqft`,
      ].filter(Boolean).join(", "));
    } catch (e) {
      console.error("[AddListing] Manual fetch failed:", e);
      toast.error("Fetch failed, please fill fields manually");
    }
  };

  const handleFileSelect = (files: FileList | null, type: 'photos' | 'floorplans' | 'documents') => {
    if (!files) return;

    const fileArray = Array.from(files);
    const newFiles: FileWithPreview[] = fileArray.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      id: Math.random().toString(36).substr(2, 9),
      uploaded: false,
    }));

    if (type === 'photos') {
      setPhotos(prev => [...prev, ...newFiles]);
    } else if (type === 'floorplans') {
      setFloorPlans(prev => [...prev, ...newFiles]);
    } else {
      setDocuments(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (id: string, type: 'photos' | 'floorplans' | 'documents') => {
    if (type === 'photos') {
      setPhotos(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        if (file?.url) {
          setPhotoUrls(urls => urls.filter(u => u !== file.url));
        }
        return prev.filter(f => f.id !== id);
      });
    } else if (type === 'floorplans') {
      setFloorPlans(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        if (file?.url) {
          setFloorPlanUrls(urls => urls.filter(u => u !== file.url));
        }
        return prev.filter(f => f.id !== id);
      });
    } else {
      setDocuments(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.url) {
          setDocumentUrls(urls => urls.filter(u => u !== file.url));
        }
        return prev.filter(f => f.id !== id);
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setPhotos(prev => {
      const newPhotos = [...prev];
      const draggedItem = newPhotos[draggedIndex];
      newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(index, 0, draggedItem);
      return newPhotos;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const uploadFiles = async (): Promise<{ photos: any[]; floorPlans: any[]; documents: any[] }> => {
    const uploadedPhotos: any[] = [];
    const uploadedFloorPlans: any[] = [];
    const uploadedDocuments: any[] = [];

    // Upload photos (only new ones)
    for (const photo of photos) {
      if (photo.uploaded) continue;
      const filePath = `${user.id}/${Date.now()}_${photo.file.name}`;
      const { error } = await supabase.storage
        .from('listing-photos')
        .upload(filePath, photo.file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(filePath);

      uploadedPhotos.push({ url: publicUrl, name: photo.file.name });
    }

    // Upload floor plans (only new ones)
    for (const plan of floorPlans) {
      if (plan.uploaded) continue;
      const filePath = `${user.id}/${Date.now()}_${plan.file.name}`;
      const { error } = await supabase.storage
        .from('listing-floorplans')
        .upload(filePath, plan.file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('listing-floorplans')
        .getPublicUrl(filePath);

      uploadedFloorPlans.push({ url: publicUrl, name: plan.file.name });
    }

    // Upload documents (only new ones)
    for (const doc of documents) {
      if (doc.uploaded) continue;
      const filePath = `${user.id}/${Date.now()}_${doc.file.name}`;
      const { error } = await supabase.storage
        .from('listing-documents')
        .upload(filePath, doc.file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('listing-documents')
        .getPublicUrl(filePath);

      uploadedDocuments.push({ url: publicUrl, name: doc.file.name });
    }

    return { photos: uploadedPhotos, floorPlans: uploadedFloorPlans, documents: uploadedDocuments };
  };

  const handleSaveDraft = async (isAutoSave = false) => {
    try {
      if (!user) {
        if (!isAutoSave) {
          toast.error("Please sign in to save drafts");
          navigate("/auth");
        }
        return;
      }
      
      if (isAutoSave) {
        setAutoSaving(true);
      } else {
        setSubmitting(true);
      }

      // Upload any new files before saving draft
      let uploadedPhotos: string[] = [...photoUrls];
      let uploadedFloorPlans: string[] = [...floorPlanUrls];
      let uploadedDocuments: string[] = [...documentUrls];

      if (photos.length > 0 || floorPlans.length > 0 || documents.length > 0) {
        const uploadResult = await uploadFiles();
        
        // Merge uploaded files with existing URLs
        uploadedPhotos = [...photoUrls, ...uploadResult.photos.map((p) => p.url)];
        uploadedFloorPlans = [...floorPlanUrls, ...uploadResult.floorPlans.map((f) => f.url)];
        uploadedDocuments = [...documentUrls, ...uploadResult.documents.map((d) => d.url)];
        
        // Update state with new URLs
        setPhotoUrls(uploadedPhotos);
        setFloorPlanUrls(uploadedFloorPlans);
        setDocumentUrls(uploadedDocuments);
        
        // Rebuild file arrays to reflect all uploaded media (marked as uploaded)
        setPhotos(
          uploadedPhotos.map((url, index) => ({
            file: new File([], `photo-${index + 1}`),
            preview: url,
            id: `${Date.now()}-photo-${index}`,
            uploaded: true,
            url,
          }))
        );
        setFloorPlans(
          uploadedFloorPlans.map((url, index) => ({
            file: new File([], `floorplan-${index + 1}`),
            preview: url,
            id: `${Date.now()}-floor-${index}`,
            uploaded: true,
            url,
          }))
        );
        setDocuments(
          uploadedDocuments.map((url, index) => ({
            file: new File([], `document-${index + 1}`),
            preview: "",
            id: `${Date.now()}-doc-${index}`,
            uploaded: true,
            url,
          }))
        );
      }

      const payload: any = {
        agent_id: user.id,
        status: (isEditMode && originalStatus && originalStatus !== "draft") 
          ? originalStatus 
          : "draft",
        listing_type: formData.listing_type,
        address: (formData.address || "Draft").trim(),
        city: formData.city?.trim() || "",
        state: formData.state?.trim() || "",
        zip_code: formData.zip_code?.trim() || "",
        town: formData.town?.trim() || null,
        neighborhood: formData.neighborhood?.trim() || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        price: formData.price ? parseFloat(formData.price) : 0,
        property_type: formData.property_type || null,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : null,
        year_built: formData.year_built ? parseInt(formData.year_built) : null,
        description: formData.description || null,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        virtual_tour_url: formData.virtual_tour_url || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        activation_date: formData.status === "coming_soon" && formData.activation_date ? formData.activation_date : null,
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        tax_assessment_value: formData.tax_assessment_value ? parseFloat(formData.tax_assessment_value) : null,
        photos: uploadedPhotos,
        floor_plans: uploadedFloorPlans,
        documents: uploadedDocuments,
        property_features: propertyFeatures,
        amenities: amenities,
        open_houses: openHouses,
        attom_data: attomData,
        walk_score_data: walkScoreData,
        schools_data: schoolsData,
        value_estimate: valueEstimate,
      };

      // Check if we're editing an existing listing (from URL) or using draftId
      const listingId = id || draftId;
      
      if (listingId) {
        // Update existing draft/listing
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", listingId);
        if (error) throw error;
        
        // Set draftId if not already set
        if (!draftId) setDraftId(listingId);
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("listings")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setDraftId(data.id);
      }

      setHasUnsavedChanges(false);
      setLastAutoSave(new Date());
      
      if (!isAutoSave) {
        const successMessage = (isEditMode && originalStatus && originalStatus !== "draft")
          ? "Changes saved successfully!"
          : "Draft saved successfully!";
        toast.success(successMessage);
        navigate("/agent-dashboard", { state: { reload: true } });
      }
    } catch (error: any) {
      console.error("Error saving draft:", error);
      if (!isAutoSave) {
        toast.error(error.message || "Failed to save draft");
      }
    } finally {
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSubmitting(false);
      }
    }
  };

  const handlePreview = () => {
    toast.info("Preview functionality coming soon");
    navigate("/agent-dashboard");
  };

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = true) => {
    e.preventDefault();
    setSubmitting(true);
    setValidationErrors([]);

    try {
      // Check required fields
      const missingFields: string[] = [];
      if (!formData.address.trim()) missingFields.push("Address");
      if (!formData.city.trim()) missingFields.push("City");
      if (!formData.state.trim()) missingFields.push("State");
      if (!formData.zip_code.trim()) missingFields.push("ZIP Code");
      if (!formData.price || parseFloat(formData.price) <= 0) missingFields.push("Price");
      if (publishNow && !formData.property_type) missingFields.push("Property Type");
      
      if (missingFields.length > 0) {
        setValidationErrors(missingFields);
        toast.error(`Missing required fields: ${missingFields.join(", ")}`);
        setSubmitting(false);
        // Scroll to top to see the highlighted fields
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Validate unit number for Condominium and Townhouse
      if ((formData.property_type === "Condominium" || formData.property_type === "Townhouse") && !unitNumber.trim()) {
        toast.error("Unit number is required for condominium and townhouse properties");
        setSubmitting(false);
        return;
      }

      // Prepare data for validation
      const dataToValidate = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code.trim() || "",
        price: parseFloat(formData.price),
        property_type: formData.property_type || "",
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : undefined,
        year_built: formData.year_built ? parseInt(formData.year_built) : undefined,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : undefined,
        description: formData.description || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        neighborhood: formData.neighborhood || undefined,
      };

      // Validate data with Zod
      const validatedData = listingSchema.parse(dataToValidate);

      // Upload files first (only new files if editing)
      toast.info("Uploading files...");
      const uploadedFiles = await uploadFiles();
      
      // Combine existing URLs with newly uploaded files
      const finalPhotos = [...photoUrls, ...uploadedFiles.photos.map((p) => p.url)];
      const finalFloorPlans = [...floorPlanUrls, ...uploadedFiles.floorPlans.map((f) => f.url)];
      const finalDocuments = [...documentUrls, ...uploadedFiles.documents.map((d) => d.url)];

      if (isEditMode && id) {
        // UPDATE existing listing
        const { error } = await supabase.from("listings").update({
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
        listing_type: formData.listing_type,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
        neighborhood: validatedData.neighborhood || null,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        property_type: validatedData.property_type || null,
        bedrooms: validatedData.bedrooms || null,
        bathrooms: validatedData.bathrooms || null,
        square_feet: validatedData.square_feet || null,
        lot_size: validatedData.lot_size || null,
        year_built: validatedData.year_built || null,
        price: validatedData.price,
        description: validatedData.description || null,
        activation_date: formData.status === "coming_soon" && formData.activation_date ? formData.activation_date : null,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        virtual_tour_url: formData.virtual_tour_url || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: [
          ...(sellerDisclosure === "Yes" ? ["Seller Disclosure"] : []),
          ...(disclosuresText ? [`Custom: ${disclosuresText}`] : []),
          ...(exclusions ? [`Exclusions: ${exclusions}`] : []),
          ...(brokerComments ? [`Broker Comments: ${brokerComments}`] : [])
        ],
        property_features: propertyFeatures,
        amenities: amenities,
        additional_notes: [
          formData.additional_notes || "",
          waterViewType ? `Water View Type: ${waterViewType}` : "",
          assessedValue ? `Assessed Value: ${assessedValue}` : "",
          fiscalYear ? `Fiscal Year: ${fiscalYear}` : "",
          residentialExemption !== "Unknown" ? `Residential Exemption: ${residentialExemption}` : "",
          floors ? `Floors: ${floors}` : "",
          leadPaint !== "Unknown" ? `Lead Paint: ${leadPaint}` : "",
          handicapAccess !== "Unknown" ? `Handicap Access: ${handicapAccess}` : "",
          foundation.length > 0 ? `Foundation: ${foundation.join(", ")}` : "",
          basementType.length > 0 ? `Basement Type: ${basementType.join(", ")}` : "",
          basementFeatures.length > 0 ? `Basement Features: ${basementFeatures.join(", ")}` : "",
          basementFloorType.length > 0 ? `Basement Floor: ${basementFloorType.join(", ")}` : "",
          parkingComments ? `Parking Comments: ${parkingComments}` : "",
          parkingFeatures.length > 0 ? `Parking Features: ${parkingFeatures.join(", ")}` : "",
          garageComments ? `Garage Comments: ${garageComments}` : "",
          garageFeatures.length > 0 ? `Garage Features: ${garageFeatures.join(", ")}` : "",
          garageAdditionalFeatures.length > 0 ? `Garage Additional: ${garageAdditionalFeatures.join(", ")}` : "",
          lotSizeSource.length > 0 ? `Lot Source: ${lotSizeSource.join(", ")}` : "",
          lotDescription.length > 0 ? `Lot Description: ${lotDescription.join(", ")}` : "",
        ].filter(Boolean).join("\n"),
        photos: finalPhotos,
        floor_plans: finalFloorPlans,
        documents: finalDocuments,
        open_houses: openHouses,
        // Property tax information
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        tax_assessment_value: formData.tax_assessment_value ? parseFloat(formData.tax_assessment_value) : null,
        // ATTOM and third-party data
        attom_data: attomData,
        walk_score_data: walkScoreData,
        schools_data: schoolsData,
        value_estimate: valueEstimate,
        // Sale listing criteria
        listing_agreement_types: listingAgreementTypes.length > 0 ? listingAgreementTypes : null,
        entry_only: entryOnly,
        lender_owned: lenderOwned,
        short_sale: shortSale,
        property_styles: propertyStyles.length > 0 ? propertyStyles : null,
        waterfront: waterfront,
        water_view: waterView,
        beach_nearby: beachNearby,
        facing_direction: facingDirection.length > 0 ? facingDirection : null,
        num_fireplaces: minFireplaces ? parseInt(minFireplaces) : null,
        has_basement: basement,
        garage_spaces: garageSpaces ? parseInt(garageSpaces) : null,
        total_parking_spaces: (parseInt(parkingSpaces) || 0) + (parseInt(garageSpaces) || 0),
        construction_features: constructionFeatures.length > 0 ? constructionFeatures : null,
        roof_materials: roofMaterials.length > 0 ? roofMaterials : null,
        exterior_features_list: exteriorFeatures.length > 0 ? exteriorFeatures : null,
        heating_types: heatingTypes.length > 0 ? heatingTypes : null,
        cooling_types: coolingTypes.length > 0 ? coolingTypes : null,
        green_features: greenFeatures.length > 0 ? greenFeatures : null,
        // Condominium-specific details
        condo_details: formData.property_type === "Condominium" ? {
          unit_number: unitNumber || condoUnitNumber || null,
          floor_level: condoFloorLevel ? parseInt(condoFloorLevel) : null,
          hoa_fee: condoHoaFee ? parseFloat(condoHoaFee) : null,
          hoa_fee_frequency: condoHoaFeeFrequency,
          building_amenities: condoBuildingAmenities.length > 0 ? condoBuildingAmenities : null,
          pet_policy: condoPetPolicy || null,
          pet_policy_comments: condoPetPolicyComments || null,
          total_units: condoTotalUnits ? parseInt(condoTotalUnits) : null,
        } : null,
        // Multi-family specific details
        multi_family_details: formData.property_type === "Multi-Family" ? {
          number_of_units: multiFamilyUnits ? parseInt(multiFamilyUnits) : null,
          unit_breakdown: multiFamilyUnitBreakdown || null,
          current_monthly_income: multiFamilyCurrentIncome ? parseFloat(multiFamilyCurrentIncome) : null,
          potential_monthly_income: multiFamilyPotentialIncome ? parseFloat(multiFamilyPotentialIncome) : null,
          occupancy_status: multiFamilyOccupancyStatus || null,
          laundry_type: multiFamilyLaundryType || null,
          separate_utilities: multiFamilySeparateUtilities.length > 0 ? multiFamilySeparateUtilities : null,
          parking_per_unit: multiFamilyParkingPerUnit ? parseFloat(multiFamilyParkingPerUnit) : null,
        } : null,
        // Commercial property specific details
        commercial_details: formData.property_type === "Commercial" ? {
          space_type: commercialSpaceType || null,
          lease_type: commercialLeaseType || null,
          lease_rate: commercialLeaseRate ? parseFloat(commercialLeaseRate) : null,
          lease_rate_per: commercialLeaseRatePer || null,
          lease_term_min: commercialLeaseTermMin ? parseInt(commercialLeaseTermMin) : null,
          lease_term_max: commercialLeaseTermMax ? parseInt(commercialLeaseTermMax) : null,
          zoning: commercialZoning || null,
          allowed_business_types: commercialBusinessTypes.length > 0 ? commercialBusinessTypes : null,
          tenant_responsibilities: commercialTenantResponsibilities.length > 0 ? commercialTenantResponsibilities : null,
        } : null,
      }).eq("id", id);

        if (error) throw error;

        toast.success("Listing updated successfully!");
        navigate(`/property/${id}`);
      } else {
        // INSERT new listing
        const { data: insertedListing, error } = await supabase.from("listings").insert({
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
        listing_type: formData.listing_type,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
        neighborhood: validatedData.neighborhood || null,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        property_type: validatedData.property_type || null,
        bedrooms: validatedData.bedrooms || null,
        bathrooms: validatedData.bathrooms || null,
        square_feet: validatedData.square_feet || null,
        lot_size: validatedData.lot_size || null,
        year_built: validatedData.year_built || null,
        price: validatedData.price,
        description: validatedData.description || null,
        activation_date: formData.status === "coming_soon" && formData.activation_date ? formData.activation_date : null,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        virtual_tour_url: formData.virtual_tour_url || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: [
          ...(sellerDisclosure === "Yes" ? ["Seller Disclosure"] : []),
          ...(disclosuresText ? [`Custom: ${disclosuresText}`] : []),
          ...(exclusions ? [`Exclusions: ${exclusions}`] : []),
          ...(brokerComments ? [`Broker Comments: ${brokerComments}`] : [])
        ],
        property_features: propertyFeatures,
        amenities: amenities,
        additional_notes: [
          formData.additional_notes || "",
          waterViewType ? `Water View Type: ${waterViewType}` : "",
          assessedValue ? `Assessed Value: ${assessedValue}` : "",
          fiscalYear ? `Fiscal Year: ${fiscalYear}` : "",
          residentialExemption !== "Unknown" ? `Residential Exemption: ${residentialExemption}` : "",
          floors ? `Floors: ${floors}` : "",
          leadPaint !== "Unknown" ? `Lead Paint: ${leadPaint}` : "",
          handicapAccess !== "Unknown" ? `Handicap Access: ${handicapAccess}` : "",
          foundation.length > 0 ? `Foundation: ${foundation.join(", ")}` : "",
          basementType.length > 0 ? `Basement Type: ${basementType.join(", ")}` : "",
          basementFeatures.length > 0 ? `Basement Features: ${basementFeatures.join(", ")}` : "",
          basementFloorType.length > 0 ? `Basement Floor: ${basementFloorType.join(", ")}` : "",
          parkingComments ? `Parking Comments: ${parkingComments}` : "",
          parkingFeatures.length > 0 ? `Parking Features: ${parkingFeatures.join(", ")}` : "",
          garageComments ? `Garage Comments: ${garageComments}` : "",
          garageFeatures.length > 0 ? `Garage Features: ${garageFeatures.join(", ")}` : "",
          garageAdditionalFeatures.length > 0 ? `Garage Additional: ${garageAdditionalFeatures.join(", ")}` : "",
          lotSizeSource.length > 0 ? `Lot Source: ${lotSizeSource.join(", ")}` : "",
          lotDescription.length > 0 ? `Lot Description: ${lotDescription.join(", ")}` : "",
        ].filter(Boolean).join("\n"),
        photos: finalPhotos,
        floor_plans: finalFloorPlans,
        documents: finalDocuments,
        open_houses: openHouses,
        // Property tax information
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        tax_assessment_value: formData.tax_assessment_value ? parseFloat(formData.tax_assessment_value) : null,
        // ATTOM and third-party data
        attom_data: attomData,
        walk_score_data: walkScoreData,
        schools_data: schoolsData,
        value_estimate: valueEstimate,
        // Sale listing criteria
        listing_agreement_types: listingAgreementTypes.length > 0 ? listingAgreementTypes : null,
        entry_only: entryOnly,
        lender_owned: lenderOwned,
        short_sale: shortSale,
        property_styles: propertyStyles.length > 0 ? propertyStyles : null,
        waterfront: waterfront,
        water_view: waterView,
        beach_nearby: beachNearby,
        facing_direction: facingDirection.length > 0 ? facingDirection : null,
        num_fireplaces: minFireplaces ? parseInt(minFireplaces) : null,
        has_basement: basement,
        garage_spaces: garageSpaces ? parseInt(garageSpaces) : null,
        total_parking_spaces: (parseInt(parkingSpaces) || 0) + (parseInt(garageSpaces) || 0),
        construction_features: constructionFeatures.length > 0 ? constructionFeatures : null,
        roof_materials: roofMaterials.length > 0 ? roofMaterials : null,
        exterior_features_list: exteriorFeatures.length > 0 ? exteriorFeatures : null,
        heating_types: heatingTypes.length > 0 ? heatingTypes : null,
        cooling_types: coolingTypes.length > 0 ? coolingTypes : null,
        green_features: greenFeatures.length > 0 ? greenFeatures : null,
        // Condominium-specific details
        condo_details: formData.property_type === "Condominium" ? {
          unit_number: unitNumber || condoUnitNumber || null,
          floor_level: condoFloorLevel ? parseInt(condoFloorLevel) : null,
          hoa_fee: condoHoaFee ? parseFloat(condoHoaFee) : null,
          hoa_fee_frequency: condoHoaFeeFrequency,
          building_amenities: condoBuildingAmenities.length > 0 ? condoBuildingAmenities : null,
          pet_policy: condoPetPolicy || null,
          pet_policy_comments: condoPetPolicyComments || null,
          total_units: condoTotalUnits ? parseInt(condoTotalUnits) : null,
        } : null,
        // Multi-family specific details
        multi_family_details: formData.property_type === "Multi-Family" ? {
          number_of_units: multiFamilyUnits ? parseInt(multiFamilyUnits) : null,
          unit_breakdown: multiFamilyUnitBreakdown || null,
          current_monthly_income: multiFamilyCurrentIncome ? parseFloat(multiFamilyCurrentIncome) : null,
          potential_monthly_income: multiFamilyPotentialIncome ? parseFloat(multiFamilyPotentialIncome) : null,
          occupancy_status: multiFamilyOccupancyStatus || null,
          laundry_type: multiFamilyLaundryType || null,
          separate_utilities: multiFamilySeparateUtilities.length > 0 ? multiFamilySeparateUtilities : null,
          parking_per_unit: multiFamilyParkingPerUnit ? parseFloat(multiFamilyParkingPerUnit) : null,
        } : null,
        // Commercial property specific details
        commercial_details: formData.property_type === "Commercial" ? {
          space_type: commercialSpaceType || null,
          lease_type: commercialLeaseType || null,
          lease_rate: commercialLeaseRate ? parseFloat(commercialLeaseRate) : null,
          lease_rate_per: commercialLeaseRatePer || null,
          lease_term_min: commercialLeaseTermMin ? parseInt(commercialLeaseTermMin) : null,
          lease_term_max: commercialLeaseTermMax ? parseInt(commercialLeaseTermMax) : null,
          zoning: commercialZoning || null,
          allowed_business_types: commercialBusinessTypes.length > 0 ? commercialBusinessTypes : null,
          tenant_responsibilities: commercialTenantResponsibilities.length > 0 ? commercialTenantResponsibilities : null,
        } : null,
      }).select('id').single();

        if (error) throw error;

        // Automatically fetch ATTOM data (walk score and schools) after listing is created
        if (insertedListing?.id) {
        try {
          console.log("[AddListing] Triggering auto-fetch-property-data for listing:", insertedListing.id);
          await supabase.functions.invoke('auto-fetch-property-data', {
            body: { listing_id: insertedListing.id }
          });
          console.log("[AddListing] ATTOM data fetch initiated successfully");
        } catch (fetchError) {
          console.error("[AddListing] Error fetching ATTOM data:", fetchError);
          // Don't fail the submission if ATTOM fetch fails
        }
      }

        toast.success("Listing created successfully!");
        navigate("/agent-dashboard", { state: { reload: true } });
      }
    } catch (error: any) {
      console.error("Error creating listing:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(error.message || "Failed to create listing");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isLoadingExisting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        {isLoadingExisting && <p className="ml-3">Loading listing...</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-4xl font-bold">{isEditMode ? "Edit Listing" : "Create a new listing for sale."}</h1>
          <img src={listingIcon} alt="Listing creation" className="w-16 h-16" />
        </div>

        {/* Action Buttons - Sticky */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-8 -mx-4 px-4 py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="ghost" size="lg" onClick={() => navigate("/agent-dashboard")} type="button" className="gap-2">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Button>
            <div className="flex-1 flex items-center gap-2">
              {autoSaving && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Auto-saving...</span>
                </div>
              )}
              {!autoSaving && lastAutoSave && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Last saved {lastAutoSave.toLocaleTimeString()}</span>
                </div>
              )}
              {!autoSaving && !lastAutoSave && hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Unsaved changes</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="lg" onClick={() => handleSaveDraft(false)} type="button" disabled={submitting || autoSaving} className="gap-2">
              <Save className="w-5 h-5" />
              {isEditMode ? "Save Changes" : "Save Draft"}
            </Button>
            <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
              <Eye className="w-5 h-5" />
              Preview
            </Button>
            <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
              <Upload className="w-5 h-5" />
              {submitting ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>

        {/* Form Card */}
        <Card>
            <CardContent className="pt-6">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold">Listing Details</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">{overallProgress}% Complete</span>
                  </div>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>
              
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
                {/* ========================================
                    SECTION 1: LISTING BASICS
                    ======================================== */}
                
                {/* Row 1: Listing Type, Property Type, Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="listing_type">Listing Type *</Label>
                    <Select
                      value={formData.listing_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, listing_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="for_sale">For Sale</SelectItem>
                        <SelectItem value="for_rent">For Rent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property_type">Property Type *</Label>
                    <Select
                      value={formData.property_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single Family">Single Family</SelectItem>
                        <SelectItem value="Condominium">Condominium</SelectItem>
                        <SelectItem value="Townhouse">Townhouse</SelectItem>
                        <SelectItem value="Multi Family">Multi Family</SelectItem>
                        <SelectItem value="Land">Land</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Business Opp.">Business Opp.</SelectItem>
                        <SelectItem value="Residential Rental">Residential Rental</SelectItem>
                        <SelectItem value="Mobile Home">Mobile Home</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">New</SelectItem>
                        <SelectItem value="coming_soon">Coming Soon</SelectItem>
                        <SelectItem value="off_market">Off Market</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Coming Soon Activation Date */}
                {formData.status === "coming_soon" && (
                  <div className="space-y-2">
                    <Label htmlFor="activation_date">Activation Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.activation_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.activation_date ? (
                            format(new Date(formData.activation_date), "PPP")
                          ) : (
                            <span>Pick a date when this listing will become active</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.activation_date ? new Date(formData.activation_date) : undefined}
                          onSelect={(date) => 
                            setFormData(prev => ({ 
                              ...prev, 
                              activation_date: date ? date.toISOString().split('T')[0] : "" 
                            }))
                          }
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-sm text-muted-foreground">
                      Select when this listing should automatically change to "Active" status
                    </p>
                  </div>
                )}

                {/* List Date and Expiration Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="list_date">List Date</Label>
                    <Input
                      id="list_date"
                      type="date"
                      value={formData.list_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, list_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration_date">Expiration Date</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* ========================================
                    SECTION 2: PROPERTY LOCATION  
                    ======================================== */}

                {/* Location Details Header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Location Details</Label>
                    <Button
                      type="button"
                      variant={addressLocked ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setAddressLocked(!addressLocked);
                        toast.success(addressLocked 
                          ? "Address unlocked - you can now edit location fields" 
                          : "✓ Address locked - fields are now protected"
                        );
                      }}
                      disabled={!formData.state || !formData.city || !formData.zip_code || !formData.address}
                    >
                      {addressLocked ? "🔒 Unlock Address" : "🔓 Lock In Address"}
                    </Button>
                  </div>
                </div>

                {/* Row 1: State, County, Open House */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state" className={validationErrors.includes("State") ? "text-destructive" : ""}>
                      State *
                    </Label>
                    <Select
                      value={selectedState}
                      onValueChange={(value) => {
                        // User is actively changing state; enable location effects
                        suppressLocationEffects.current = false;
                        setSelectedState(value);
                        setFormData(prev => ({ ...prev, state: value }));
                        setValidationErrors(errors => errors.filter(e => e !== "State"));
                      }}
                      disabled={addressLocked}
                    >
                      <SelectTrigger className={cn(
                        "bg-background",
                        validationErrors.includes("State") ? "border-destructive ring-2 ring-destructive" : ""
                      )}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50 max-h-[300px]">
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.includes("State") && (
                      <p className="text-sm text-destructive">State is required</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>County (Optional)</Label>
                    {!selectedState || availableCounties.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {!selectedState ? "Select a state first" : "No counties available"}
                      </p>
                    ) : (
                        <RadioGroup value={selectedCounty} onValueChange={(value) => {
                          // User changed county manually; enable location effects
                          suppressLocationEffects.current = false;
                          setSelectedCounty(value);
                        }} disabled={addressLocked}>
                          <div className="space-y-2 border rounded-lg p-3 max-h-[200px] overflow-y-auto bg-background">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="all" id="county-all" />
                              <Label htmlFor="county-all" className="cursor-pointer flex-1 font-normal">
                                All Counties
                              </Label>
                            </div>
                            {availableCounties.map((county) => (
                              <div key={county} className="flex items-center space-x-2">
                                <RadioGroupItem value={county} id={`county-${county}`} />
                                <Label htmlFor={`county-${county}`} className="cursor-pointer flex-1 font-normal">
                                  {county}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                    )}
                  </div>

                  {/* Open House Scheduling */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Open House Scheduling</Label>
                    
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOpenHouseDialogType('public');
                          setOpenHouseDialogOpen(true);
                        }}
                      >
                        🎈 Public Open House
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOpenHouseDialogType('broker');
                          setOpenHouseDialogOpen(true);
                        }}
                      >
                        🚗 Broker Open House
                      </Button>
                    </div>
                    
                    {openHouses.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <Label className="text-xs font-semibold">Scheduled ({openHouses.length})</Label>
                        <div className="space-y-1 max-h-[160px] overflow-y-auto">
                          {openHouses.map((oh, index) => (
                            <div key={index} className="flex items-start justify-between p-2 border rounded text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {oh.type === 'public' ? '🎈' : '🚗'} {format(new Date(oh.date), 'MMM d')}
                                </div>
                                <div className="text-muted-foreground truncate">
                                  {oh.start_time} - {oh.end_time}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => {
                                  setOpenHouses(openHouses.filter((_, i) => i !== index));
                                  toast.success('Open house removed');
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* City with Neighborhoods */}
                <div className="space-y-2">
                  <Label htmlFor="city" className={validationErrors.includes("City") ? "text-destructive" : ""}>
                    City/Town *
                  </Label>
                  
                  {/* Selected City Display */}
                  {selectedCity && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <Home className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-primary">
                          {selectedCity}
                          {formData.neighborhood && ` - ${formData.neighborhood}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedState && US_STATES.find(s => s.code === selectedState)?.name}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCity("");
                          setFormData(prev => ({ ...prev, city: "", neighborhood: "" }));
                          setCitySearch("");
                          setShowCityList(true);
                        }}
                        className="h-8 gap-1"
                        disabled={addressLocked}
                      >
                        <X className="h-3 w-3" />
                        Change
                      </Button>
                    </div>
                  )}
                  
                  {/* Search Input - Only show if no city selected */}
                  {!selectedCity && (
                    <div className="relative">
                      <Input
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Search cities..."
                        className="pr-8"
                      />
                      {citySearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                          onClick={() => setCitySearch("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {availableCities.length > 0 && !selectedCity ? (
                    <ScrollArea className="h-[300px] border rounded-lg p-3 bg-background">
                      <RadioGroup value={formData.neighborhood ? `${selectedCity}-${formData.neighborhood}` : selectedCity} onValueChange={handleCitySelect}>
                        <div className="space-y-2">
                          {availableCities
                            .filter(city => city.toLowerCase().includes(citySearch.toLowerCase()))
                            .map((city) => {
                              const neighborhoods = getAreasForCity(city, stateKey || selectedState);
                              
                              // Add fallback: check for hyphenated entries if no data from usNeighborhoodsData
                              let neighborhoodsList = neighborhoods;
                              if (!neighborhoods || neighborhoods.length === 0) {
                                // Derive neighborhoods from availableCities list (e.g., "Boston-Allston" format)
                                const derivedNeighborhoods = Array.from(new Set(
                                  availableCities
                                    .filter((t) => t.startsWith(`${city}-`))
                                    .map((t) => t.split('-').slice(1).join('-'))
                                ));
                                neighborhoodsList = derivedNeighborhoods;
                              }
                              
                              const hasNeighborhoods = neighborhoodsList.length > 0;
                              const isExpanded = expandedCities.has(city);
                              
                              return (
                                <div key={city} className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    {hasNeighborhoods && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleCityExpansion(city)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <ChevronDown 
                                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                        />
                                      </Button>
                                    )}
                                    <RadioGroupItem value={city} id={`city-${city}`} />
                                    <Label 
                                      htmlFor={`city-${city}`} 
                                      className={`cursor-pointer flex-1 font-normal ${!hasNeighborhoods ? 'ml-8' : ''}`}
                                    >
                                      {city}
                                    </Label>
                                  </div>
                                  
                                  {hasNeighborhoods && isExpanded && (
                                    <div className="ml-8 border-l-2 border-muted pl-3 space-y-2 bg-muted/30 rounded-r py-2">
                                      {neighborhoodsList.map((neighborhood) => (
                                        <div key={neighborhood} className="flex items-center space-x-2">
                                          <RadioGroupItem 
                                            value={`${city}-${neighborhood}`} 
                                            id={`neighborhood-${city}-${neighborhood}`}
                                          />
                                          <Label 
                                            htmlFor={`neighborhood-${city}-${neighborhood}`}
                                            className="cursor-pointer flex-1 text-sm text-muted-foreground font-normal"
                                          >
                                            {neighborhood}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </RadioGroup>
                    </ScrollArea>
                  ) : availableCities.length > 0 && selectedCity ? null : (
                    <p className="text-sm text-muted-foreground">
                      {selectedState ? "Select a county or state to see cities" : "Select a state first"}
                    </p>
                  )}
                  {validationErrors.includes("City") && (
                    <p className="text-sm text-destructive">City is required</p>
                  )}
                </div>

                {/* ZIP Code Picker */}
                <div className="space-y-2">
                  <Label htmlFor="zip_code" className={validationErrors.includes("ZIP Code") ? "text-destructive" : ""}>
                    ZIP Code *
                  </Label>
                  {suggestedZipsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading ZIP codes...
                    </div>
                  ) : suggestedZips.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Click a button below to select a ZIP code (required - even if there's only one option):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedZips.map((zip) => (
                          <Button
                            key={zip}
                            type="button"
                            variant={formData.zip_code === zip ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleZipSelect(zip)}
                            disabled={addressLocked}
                          >
                            {zip}
                          </Button>
                        ))}
                      </div>
                      {formData.zip_code && (
                        <p className="text-sm text-muted-foreground">
                          Selected: <span className="font-medium">{formData.zip_code}</span>
                        </p>
                      )}
                    </div>
                  ) : selectedCity ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No ZIP codes available for this city - enter manually below
                      </p>
                      <Input
                        id="zip_code_manual"
                        value={formData.zip_code}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, zip_code: e.target.value }));
                          setValidationErrors(errors => errors.filter(e => e !== "ZIP Code"));
                        }}
                        placeholder="02134"
                        className={cn(
                          validationErrors.includes("ZIP Code") ? "border-destructive ring-2 ring-destructive" : ""
                        )}
                        disabled={addressLocked}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a city to see available ZIP codes
                    </p>
                  )}
                  {validationErrors.includes("ZIP Code") && (
                    <p className="text-sm text-destructive">ZIP Code is required</p>
                  )}
                </div>

                {/* Row 2: Street Address and Unit Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="address" className={validationErrors.includes("Address") ? "text-destructive" : ""}>
                        Street Address *
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFetchPropertyData}
                        disabled={!formData.address || !formData.city || !formData.state || !formData.zip_code || fetchingData}
                        className="gap-2 h-7 text-xs"
                      >
                        {fetchingData ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <Cloud className="h-3 w-3" />
                            Fetch Property Data
                          </>
                        )}
                      </Button>
                    </div>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, address: e.target.value }));
                        setValidationErrors(errors => errors.filter(e => e !== "Address"));
                      }}
                      onBlur={(e) => {
                        const formatted = toTitleCase(e.target.value.trim());
                        setFormData(prev => ({ ...prev, address: formatted }));
                      }}
                      placeholder="123 Main Street"
                      className={cn(
                        validationErrors.includes("Address") ? "border-destructive ring-2 ring-destructive" : ""
                      )}
                      disabled={addressLocked}
                    />
                    {validationErrors.includes("Address") && (
                      <p className="text-sm text-destructive">Street address is required</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Complete all address fields above, then click "Fetch Property Data" to auto-fill property details
                    </p>
                  </div>
                  
                  {/* Unit Number - for properties with units */}
                  {(formData.property_type === "Condominium" || 
                    formData.property_type === "Townhouse" || 
                    formData.property_type === "Residential Rental" ||
                    formData.listing_type === "for_rent") && (
                    <div className="space-y-2">
                      <Label htmlFor="unit_number">
                        Unit/Apartment Number
                        {(formData.property_type === "Condominium" || formData.property_type === "Townhouse") && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      <Input
                        id="unit_number"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder="e.g., 3B, 205, Apt 4"
                        required={formData.property_type === "Condominium" || formData.property_type === "Townhouse"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {(formData.property_type === "Condominium" || formData.property_type === "Townhouse") 
                          ? "Required - Enter unit number for accurate property data"
                          : "Enter unit number for accurate property data lookup"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Info Alert */}
                {formData.address && formData.city && formData.state && formData.zip_code && !attomData && (
                  <Alert className="border-primary/50 bg-primary/5">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle>Ready to Fetch Property Data</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>Click "Fetch Property Data" to automatically import public records including:</p>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                        <li>Property details (bedrooms, bathrooms, square feet)</li>
                        <li>Tax assessment value and year</li>
                        <li>School ratings and walk scores</li>
                        <li>Property characteristics and features</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* List Price - placed after location */}
                <div className="space-y-2">
                  <Label htmlFor="price" className={validationErrors.includes("Price") ? "text-destructive" : ""}>
                    List Price *
                  </Label>
                  <FormattedInput
                    id="price"
                    format="currency"
                    placeholder="500000"
                    value={formData.price}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, price: value }));
                      setValidationErrors(errors => errors.filter(e => e !== "Price"));
                    }}
                    required
                    className={validationErrors.includes("Price") ? "border-destructive ring-2 ring-destructive" : ""}
                  />
                  {validationErrors.includes("Price") && (
                    <p className="text-sm text-destructive">Price is required</p>
                  )}
                </div>

                {/* Hidden fields for state and zip (auto-populated from address) */}
                <input type="hidden" name="state" value={formData.state} />
                <input type="hidden" name="zip_code" value={formData.zip_code} />

                {/* ========================================
                    SECTION 3: CORE PROPERTY DETAILS
                    ======================================== */}

                {/* Property Details */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      step="0.5"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="square_feet">Sq Ft</Label>
                    <FormattedInput
                      id="square_feet"
                      format="number"
                      placeholder="1234"
                      value={formData.square_feet}
                      onChange={(value) => setFormData(prev => ({ ...prev, square_feet: value }))}
                    />
                  </div>
                </div>

                {!(formData.property_type?.toLowerCase().includes("condo")) && (
                  <div className="space-y-2">
                    <Label htmlFor="lot_size">Lot Size (acres)</Label>
                    <Input
                      id="lot_size"
                      type="number"
                      step="0.01"
                      value={formData.lot_size}
                      onChange={(e) => setFormData(prev => ({ ...prev, lot_size: e.target.value }))}
                    />
                  </div>
                )}

                {/* ========================================
                    SECTION 4: PROPERTY TYPE-SPECIFIC DETAILS
                    ======================================== */}

                {/* Condominium-Specific Fields */}
                {formData.property_type === "Condominium" && (
                  <>
                    <Separator className="my-6" />
                    <div className="space-y-6">
                      <Label className="text-xl font-semibold">Condominium Information</Label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="condo_floor_level">Floor Level</Label>
                          <Input
                            id="condo_floor_level"
                            type="number"
                            value={condoFloorLevel}
                            onChange={(e) => setCondoFloorLevel(e.target.value)}
                            placeholder="e.g., 3"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="condo_total_units">Total Units in Building</Label>
                          <Input
                            id="condo_total_units"
                            type="number"
                            value={condoTotalUnits}
                            onChange={(e) => setCondoTotalUnits(e.target.value)}
                            placeholder="e.g., 48"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="condo_hoa_fee">HOA/Condo Fee</Label>
                          <FormattedInput
                            id="condo_hoa_fee"
                            format="currency"
                            decimals={0}
                            value={condoHoaFee}
                            onChange={(value) => setCondoHoaFee(value)}
                            placeholder="3000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="condo_hoa_fee_frequency">Fee Frequency</Label>
                          <Select
                            value={condoHoaFeeFrequency}
                            onValueChange={(value) => setCondoHoaFeeFrequency(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="condo_pet_policy">Pet Policy</Label>
                        <Select
                          value={condoPetPolicy}
                          onValueChange={(value) => setCondoPetPolicy(value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pet policy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allowed">Pets Allowed</SelectItem>
                            <SelectItem value="not_allowed">No Pets</SelectItem>
                            <SelectItem value="cats_only">Cats Only</SelectItem>
                            <SelectItem value="small_pets">Small Pets Only</SelectItem>
                            <SelectItem value="restrictions">Restrictions Apply</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {condoPetPolicy && (
                        <div className="space-y-2">
                          <Label htmlFor="condo_pet_policy_comments">Pet Policy Comments</Label>
                          <Textarea
                            id="condo_pet_policy_comments"
                            value={condoPetPolicyComments}
                            onChange={(e) => setCondoPetPolicyComments(e.target.value)}
                            placeholder="Additional details about pet policy (e.g., size limits, deposits, fees, breed restrictions)"
                            rows={3}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Building Amenities</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            "Elevator", "Fitness Center", "Pool", "Concierge", 
                            "Doorman", "Storage", "Garage Parking", "Guest Parking",
                            "Bike Room", "Common Roof Deck", "Laundry in Building", 
                            "Package Room", "Business Center", "Party Room"
                          ].map((amenity) => (
                            <div key={amenity} className="flex items-center space-x-2">
                              <Checkbox
                                id={`condo-amenity-${amenity}`}
                                checked={condoBuildingAmenities.includes(amenity)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCondoBuildingAmenities([...condoBuildingAmenities, amenity]);
                                  } else {
                                    setCondoBuildingAmenities(condoBuildingAmenities.filter(a => a !== amenity));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`condo-amenity-${amenity}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {amenity}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Multi-Family Specific Fields */}
                {formData.property_type === "Multi-Family" && (
                  <>
                    <Separator className="my-6" />
                    <div className="space-y-6">
                      <Label className="text-xl font-semibold">Multi-Family Information</Label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="multifamily_units">Number of Units</Label>
                          <Input
                            id="multifamily_units"
                            type="number"
                            value={multiFamilyUnits}
                            onChange={(e) => setMultiFamilyUnits(e.target.value)}
                            placeholder="e.g., 4"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="multifamily_parking_per_unit">Parking Spaces Per Unit</Label>
                          <Input
                            id="multifamily_parking_per_unit"
                            type="number"
                            value={multiFamilyParkingPerUnit}
                            onChange={(e) => setMultiFamilyParkingPerUnit(e.target.value)}
                            placeholder="e.g., 2"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="multifamily_unit_breakdown">Unit Breakdown</Label>
                        <Textarea
                          id="multifamily_unit_breakdown"
                          value={multiFamilyUnitBreakdown}
                          onChange={(e) => setMultiFamilyUnitBreakdown(e.target.value)}
                          placeholder="e.g., 2 units: 3BR/2BA, 2 units: 2BR/1BA"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="multifamily_current_income">Current Monthly Income</Label>
                          <FormattedInput
                            id="multifamily_current_income"
                            format="currency"
                            decimals={2}
                            value={multiFamilyCurrentIncome}
                            onChange={(value) => setMultiFamilyCurrentIncome(value)}
                             placeholder="0.00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="multifamily_potential_income">Potential Monthly Income</Label>
                          <FormattedInput
                            id="multifamily_potential_income"
                            format="currency"
                            decimals={2}
                            value={multiFamilyPotentialIncome}
                            onChange={(value) => setMultiFamilyPotentialIncome(value)}
                             placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="multifamily_occupancy_status">Occupancy Status</Label>
                          <Select
                            value={multiFamilyOccupancyStatus}
                            onValueChange={(value) => setMultiFamilyOccupancyStatus(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select occupancy status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fully_occupied">Fully Occupied</SelectItem>
                              <SelectItem value="partially_occupied">Partially Occupied</SelectItem>
                              <SelectItem value="vacant">Vacant</SelectItem>
                              <SelectItem value="owner_occupied">Owner Occupied</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="multifamily_laundry_type">Laundry</Label>
                          <Select
                            value={multiFamilyLaundryType}
                            onValueChange={(value) => setMultiFamilyLaundryType(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select laundry type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_unit">In-Unit</SelectItem>
                              <SelectItem value="shared">Shared/Common Area</SelectItem>
                              <SelectItem value="hookups">Hookups Only</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Separate Utilities</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {["Electric", "Gas", "Water", "Heat", "Hot Water", "Sewer"].map((utility) => (
                            <div key={utility} className="flex items-center space-x-2">
                              <Checkbox
                                id={`utility-${utility}`}
                                checked={multiFamilySeparateUtilities.includes(utility)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setMultiFamilySeparateUtilities([...multiFamilySeparateUtilities, utility]);
                                  } else {
                                    setMultiFamilySeparateUtilities(multiFamilySeparateUtilities.filter(u => u !== utility));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`utility-${utility}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {utility}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Commercial Property Specific Fields */}
                {formData.property_type === "Commercial" && (
                  <>
                    <Separator className="my-6" />
                    <div className="space-y-6">
                      <Label className="text-xl font-semibold">Commercial Property Information</Label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commercial_space_type">Space Type</Label>
                          <Select
                            value={commercialSpaceType}
                            onValueChange={(value) => setCommercialSpaceType(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select space type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="retail">Retail</SelectItem>
                              <SelectItem value="warehouse">Warehouse</SelectItem>
                              <SelectItem value="industrial">Industrial</SelectItem>
                              <SelectItem value="restaurant">Restaurant</SelectItem>
                              <SelectItem value="mixed_use">Mixed Use</SelectItem>
                              <SelectItem value="medical">Medical</SelectItem>
                              <SelectItem value="flex">Flex Space</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="commercial_lease_type">Lease Type</Label>
                          <Select
                            value={commercialLeaseType}
                            onValueChange={(value) => setCommercialLeaseType(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select lease type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gross">Gross Lease</SelectItem>
                              <SelectItem value="net">Net Lease</SelectItem>
                              <SelectItem value="triple_net">Triple Net (NNN)</SelectItem>
                              <SelectItem value="modified_gross">Modified Gross</SelectItem>
                              <SelectItem value="percentage">Percentage Lease</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commercial_lease_rate">Lease Rate</Label>
                          <div className="flex gap-2">
                            <FormattedInput
                              id="commercial_lease_rate"
                              format="currency"
                              decimals={2}
                              value={commercialLeaseRate}
                              onChange={(value) => setCommercialLeaseRate(value)}
                              placeholder="0.00"
                            />
                            <Select
                              value={commercialLeaseRatePer}
                              onValueChange={(value) => setCommercialLeaseRatePer(value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sqft_year">per sq ft/year</SelectItem>
                                <SelectItem value="sqft_month">per sq ft/month</SelectItem>
                                <SelectItem value="month">per month</SelectItem>
                                <SelectItem value="year">per year</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Lease Term (Months)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Min"
                              value={commercialLeaseTermMin}
                              onChange={(e) => setCommercialLeaseTermMin(e.target.value)}
                            />
                            <span className="flex items-center">to</span>
                            <Input
                              type="number"
                              placeholder="Max"
                              value={commercialLeaseTermMax}
                              onChange={(e) => setCommercialLeaseTermMax(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commercial_zoning">Zoning</Label>
                          <Input
                            id="commercial_zoning"
                            value={commercialZoning}
                            onChange={(e) => setCommercialZoning(e.target.value)}
                            placeholder="e.g., C-1, I-2, B-3"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="commercial_current_tenant">Current Tenant</Label>
                          <Input
                            id="commercial_current_tenant"
                            value={commercialCurrentTenant}
                            onChange={(e) => setCommercialCurrentTenant(e.target.value)}
                            placeholder="Leave blank if vacant"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Allowed Business Types</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            "Retail", "Restaurant", "Office", "Medical", 
                            "Fitness", "Salon/Spa", "Professional Services",
                            "Manufacturing", "Distribution", "Storage"
                          ].map((type) => (
                            <div key={type} className="flex items-center space-x-2">
                              <Checkbox
                                id={`business-${type}`}
                                checked={commercialBusinessTypes.includes(type)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCommercialBusinessTypes([...commercialBusinessTypes, type]);
                                  } else {
                                    setCommercialBusinessTypes(commercialBusinessTypes.filter(t => t !== type));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`business-${type}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {type}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Tenant Responsibilities</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            "Property Taxes", "Insurance", "Maintenance",
                            "Repairs", "Utilities", "Common Area Maintenance (CAM)"
                          ].map((responsibility) => (
                            <div key={responsibility} className="flex items-center space-x-2">
                              <Checkbox
                                id={`responsibility-${responsibility}`}
                                checked={commercialTenantResponsibilities.includes(responsibility)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCommercialTenantResponsibilities([...commercialTenantResponsibilities, responsibility]);
                                  } else {
                                    setCommercialTenantResponsibilities(commercialTenantResponsibilities.filter(r => r !== responsibility));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`responsibility-${responsibility}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {responsibility}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commercial_lease_expiration">Current Lease Expiration</Label>
                          <Input
                            id="commercial_lease_expiration"
                            type="date"
                            value={commercialLeaseExpiration}
                            onChange={(e) => setCommercialLeaseExpiration(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="commercial_ceiling_height">Ceiling Height (ft)</Label>
                          <Input
                            id="commercial_ceiling_height"
                            type="number"
                            step="0.1"
                            value={commercialCeilingHeight}
                            onChange={(e) => setCommercialCeilingHeight(e.target.value)}
                            placeholder="e.g., 12"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commercial_loading_docks">Number of Loading Docks</Label>
                          <Input
                            id="commercial_loading_docks"
                            type="number"
                            value={commercialLoadingDocks}
                            onChange={(e) => setCommercialLoadingDocks(e.target.value)}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="commercial_power_available">Power Available</Label>
                          <Input
                            id="commercial_power_available"
                            value={commercialPowerAvailable}
                            onChange={(e) => setCommercialPowerAvailable(e.target.value)}
                            placeholder="e.g., 200 amp, 3-phase"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Additional Features</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            "Drive-Through", "High Ceilings", "HVAC", 
                            "Loading Dock", "Sprinkler System", "Security System",
                            "Fiber Optic", "Backup Generator", "Outdoor Signage"
                          ].map((feature) => (
                            <div key={feature} className="flex items-center space-x-2">
                              <Checkbox
                                id={`commercial-feature-${feature}`}
                                checked={commercialAdditionalFeatures.includes(feature)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCommercialAdditionalFeatures([...commercialAdditionalFeatures, feature]);
                                  } else {
                                    setCommercialAdditionalFeatures(commercialAdditionalFeatures.filter(f => f !== feature));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`commercial-feature-${feature}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {feature}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Lot Size and Description */}
                {!(formData.property_type?.toLowerCase().includes("condo")) && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Lot Information</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lot_size">Lot Size - ft²</Label>
                        <FormattedInput
                          id="lot_size"
                          format="number"
                          decimals={0}
                          value={formData.lot_size}
                          onChange={(value) => setFormData(prev => ({ ...prev, lot_size: value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Measured", "Owner", "Public Record", "Appraiser"].map((source) => (
                            <div key={source} className="flex items-center space-x-2">
                              <Checkbox
                                id={`lot-source-${source}`}
                                checked={lotSizeSource.includes(source)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setLotSizeSource([...lotSizeSource, source]);
                                  } else {
                                    setLotSizeSource(lotSizeSource.filter((s) => s !== source));
                                  }
                                }}
                              />
                              <label htmlFor={`lot-source-${source}`} className="text-sm cursor-pointer">
                                {source}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Lot description</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {["Corner", "Wooded", "Underground Storage Tank", "Easements", "On Golf Course", "Additional Land Avail.", "Zero Lot Line"].map((desc) => (
                          <div key={desc} className="flex items-center space-x-2">
                            <Checkbox
                              id={`lot-desc-${desc}`}
                              checked={lotDescription.includes(desc)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setLotDescription([...lotDescription, desc]);
                                } else {
                                  setLotDescription(lotDescription.filter((d) => d !== desc));
                                }
                              }}
                            />
                            <label htmlFor={`lot-desc-${desc}`} className="text-sm cursor-pointer">
                              {desc}
                            </label>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {["Flood Plain", "Shared Driveway", "Cleared", "Fence/Enclosed", "Sloping", "Level", "Marsh"].map((desc) => (
                          <div key={desc} className="flex items-center space-x-2">
                            <Checkbox
                              id={`lot-desc2-${desc}`}
                              checked={lotDescription.includes(desc)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setLotDescription([...lotDescription, desc]);
                                } else {
                                  setLotDescription(lotDescription.filter((d) => d !== desc));
                                }
                              }}
                            />
                            <label htmlFor={`lot-desc2-${desc}`} className="text-sm cursor-pointer">
                              {desc}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <Separator className="my-6" />

                {/* ========================================
                    SECTION 11: ADDITIONAL BUILDING DETAILS
                    ======================================== */}

                {/* Property Tax Information */}
                <div className="space-y-6">
                  <Label className="text-xl font-semibold">Property Tax Information</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assessed_value">Assessed Value</Label>
                      <FormattedInput
                        id="assessed_value"
                        format="currency"
                        decimals={0}
                        value={assessedValue}
                        onChange={(value) => setAssessedValue(value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fiscal_year">Fiscal Year</Label>
                      <Input
                        id="fiscal_year"
                        type="number"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(e.target.value)}
                        placeholder={new Date().getFullYear().toString()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="annual_property_tax">Taxes-Yearly</Label>
                      <FormattedInput
                        id="annual_property_tax"
                        format="currency"
                        decimals={0}
                        value={formData.annual_property_tax}
                        onChange={(value) => setFormData(prev => ({ ...prev, annual_property_tax: value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="residential_exemption">Residential Exemption</Label>
                      <Select value={residentialExemption} onValueChange={setResidentialExemption}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Unit Features */}
                <div className="space-y-6">
                  <Label className="text-xl font-semibold">Unit Features</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="floors">Floors</Label>
                      <Input
                        id="floors"
                        type="number"
                        value={floors}
                        onChange={(e) => setFloors(e.target.value)}
                        placeholder="e.g., 2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fireplace">Fireplace</Label>
                      <Input
                        id="fireplace"
                        type="number"
                        value={minFireplaces}
                        onChange={(e) => setMinFireplaces(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year_built">Year Built</Label>
                      <Input
                        id="year_built"
                        type="number"
                        value={formData.year_built}
                        onChange={(e) => setFormData(prev => ({ ...prev, year_built: e.target.value }))}
                        placeholder="e.g., 1990"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* ========================================
                    SECTION 6: PROPERTY DESCRIPTION  
                    ======================================== */}

                {/* Property Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Property Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={6}
                    placeholder="Describe the property features, location highlights, and any special details..."
                  />
                </div>

                <Separator className="my-6" />

                {/* ========================================
                    SECTION 7: SALE CRITERIA & FEATURES
                    ======================================== */}

                <div className="space-y-6">
                  {/* Area Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Area Features</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Waterfront</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={waterfront === true ? "default" : "outline"}
                            onClick={() => setWaterfront(waterfront === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={waterfront === false ? "default" : "outline"}
                            onClick={() => setWaterfront(waterfront === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Water View</label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={waterView === true ? "default" : "outline"}
                              onClick={() => {
                                setWaterView(waterView === true ? null : true);
                                if (waterView === true) setWaterViewType(null);
                              }}
                            >
                              Yes
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={waterView === false ? "default" : "outline"}
                              onClick={() => {
                                setWaterView(waterView === false ? null : false);
                                setWaterViewType(null);
                              }}
                            >
                              No
                            </Button>
                          </div>
                        </div>
                        {waterView === true && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-medium">Type of Water View</Label>
                            <RadioGroup value={waterViewType || ""} onValueChange={setWaterViewType}>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Ocean" id="view-ocean" />
                                  <Label htmlFor="view-ocean" className="text-sm font-normal cursor-pointer">Ocean</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="River" id="view-river" />
                                  <Label htmlFor="view-river" className="text-sm font-normal cursor-pointer">River</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Lake" id="view-lake" />
                                  <Label htmlFor="view-lake" className="text-sm font-normal cursor-pointer">Lake</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Pond" id="view-pond" />
                                  <Label htmlFor="view-pond" className="text-sm font-normal cursor-pointer">Pond</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Bay" id="view-bay" />
                                  <Label htmlFor="view-bay" className="text-sm font-normal cursor-pointer">Bay</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Harbor" id="view-harbor" />
                                  <Label htmlFor="view-harbor" className="text-sm font-normal cursor-pointer">Harbor</Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Beach Nearby</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={beachNearby === true ? "default" : "outline"}
                            onClick={() => setBeachNearby(beachNearby === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={beachNearby === false ? "default" : "outline"}
                            onClick={() => setBeachNearby(beachNearby === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Facing Direction */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Facing Direction</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["North", "South", "East", "West", "Northeast", "Northwest", "Southeast", "Southwest"].map((dir) => (
                        <div key={dir} className="flex items-center space-x-2">
                          <Checkbox
                            id={`facing-${dir}`}
                            checked={facingDirection.includes(dir)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFacingDirection([...facingDirection, dir]);
                              } else {
                                setFacingDirection(facingDirection.filter((d) => d !== dir));
                              }
                            }}
                          />
                          <label htmlFor={`facing-${dir}`} className="text-sm cursor-pointer">
                            {dir}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Basement Details */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Basement</Label>
                    <div className="flex items-center justify-between p-3 border rounded-lg mb-3">
                      <label className="text-sm font-medium">Has Basement</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={basement === true ? "default" : "outline"}
                          onClick={() => setBasement(basement === true ? null : true)}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={basement === false ? "default" : "outline"}
                          onClick={() => setBasement(basement === false ? null : false)}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["Full", "Partial", "Finished", "Partially Finished", "Unfinished", "Walkout", "Bulkhead", "Plumbed"].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`basement-type-${type}`}
                            checked={basementType.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBasementType([...basementType, type]);
                              } else {
                                setBasementType(basementType.filter((t) => t !== type));
                              }
                            }}
                          />
                          <label htmlFor={`basement-type-${type}`} className="text-sm cursor-pointer">
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      {["Sump Pump", "French Drain", "Workshop", "Crawl Space", "Radon Remediation", "Interior Access"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`basement-feature-${feat}`}
                            checked={basementFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBasementFeatures([...basementFeatures, feat]);
                              } else {
                                setBasementFeatures(basementFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`basement-feature-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      {["Garage Access", "Exterior Access", "Dirt Floor", "Concrete Floor", "Slab"].map((floor) => (
                        <div key={floor} className="flex items-center space-x-2">
                          <Checkbox
                            id={`basement-floor-${floor}`}
                            checked={basementFloorType.includes(floor)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBasementFloorType([...basementFloorType, floor]);
                              } else {
                                setBasementFloorType(basementFloorType.filter((f) => f !== floor));
                              }
                            }}
                          />
                          <label htmlFor={`basement-floor-${floor}`} className="text-sm cursor-pointer">
                            {floor}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lead Paint, Handicap Access, Foundation */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lead_paint">Lead Paint</Label>
                      <Select value={leadPaint} onValueChange={setLeadPaint}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handicap_access">Handicap Access</Label>
                      <Select value={handicapAccess} onValueChange={setHandicapAccess}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Foundation</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Poured Concrete", "Concrete Block", "Fieldstone", "Brick", "Granite", "Slab"].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`foundation-${type}`}
                              checked={foundation.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFoundation([...foundation, type]);
                                } else {
                                  setFoundation(foundation.filter((f) => f !== type));
                                }
                              }}
                            />
                            <label htmlFor={`foundation-${type}`} className="text-sm cursor-pointer">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Parking Details */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Parking #</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Input
                          id="parkingSpaces"
                          type="number"
                          value={parkingSpaces}
                          onChange={(e) => setParkingSpaces(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["Included", "Deeded", "Assigned", "Off Street", "Paved", "Shared Driveway", "For Rent", "Street Permit", "For Sale"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`parking-${feat}`}
                            checked={parkingFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setParkingFeatures([...parkingFeatures, feat]);
                              } else {
                                setParkingFeatures(parkingFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`parking-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parking_comments">Comments and Remarks for Parking</Label>
                      <Textarea
                        id="parking_comments"
                        value={parkingComments}
                        onChange={(e) => setParkingComments(e.target.value)}
                        placeholder="Additional parking details..."
                      />
                    </div>
                  </div>

                  {/* Garage Details */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Garage #</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Input
                          id="garageSpaces"
                          type="number"
                          value={garageSpaces}
                          onChange={(e) => setGarageSpaces(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["Included", "Deeded", "Assigned", "Attached", "Detached", "Under", "Heated", "Carport", "Charging Station", "Wash Station"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`garage-${feat}`}
                            checked={garageFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGarageFeatures([...garageFeatures, feat]);
                              } else {
                                setGarageFeatures(garageFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`garage-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      {["Available to Purchase", "Valet", "For Rent", "Tandem"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`garage-additional-${feat}`}
                            checked={garageAdditionalFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGarageAdditionalFeatures([...garageAdditionalFeatures, feat]);
                              } else {
                                setGarageAdditionalFeatures(garageAdditionalFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`garage-additional-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="garage_comments">Comments and Remarks for Garage</Label>
                      <Textarea
                        id="garage_comments"
                        value={garageComments}
                        onChange={(e) => setGarageComments(e.target.value)}
                        placeholder="Additional garage details..."
                      />
                    </div>
                  </div>

                  {/* Total Parking - Auto-calculated */}
                  <div className="space-y-2">
                    <Label htmlFor="total_parking">Total Parking (Auto-calculated)</Label>
                    <Input
                      id="total_parking"
                      type="number"
                      value={((parseInt(parkingSpaces) || 0) + (parseInt(garageSpaces) || 0)).toString()}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Automatically calculated from Parking # ({parkingSpaces || 0}) + Garage # ({garageSpaces || 0})
                    </p>
                  </div>

                  {/* Exterior Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Exterior Features</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Pool, Inground", "Pool, Above Ground", "Cabana", "Sports Court", "Hot Tub", "Shed", "Paddock", "Sprinkler System"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exterior-${feat}`}
                            checked={exteriorFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExteriorFeatures([...exteriorFeatures, feat]);
                              } else {
                                setExteriorFeatures(exteriorFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`exterior-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                      {["Decorative Lighting", "Fenced Yard", "Gazebo", "Guest House", "Outdoor Shower"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exterior2-${feat}`}
                            checked={exteriorFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExteriorFeatures([...exteriorFeatures, feat]);
                              } else {
                                setExteriorFeatures(exteriorFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`exterior2-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Heating & Cooling */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Heating Type</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {["Central Heat", "Forced Air", "Heat Pump", "Active Solar", "Ground Source Heat Pump", "Geothermal Heat Source", "Passive Solar", "Wind"].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`heating-${type}`}
                              checked={heatingTypes.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setHeatingTypes([...heatingTypes, type]);
                                } else {
                                  setHeatingTypes(heatingTypes.filter((t) => t !== type));
                                }
                              }}
                            />
                            <label htmlFor={`heating-${type}`} className="text-sm cursor-pointer">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Cooling Type</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {["Central Air", "Window AC", "Wall AC", "Geothermal Heat Pump", "High Seer Heat Pump", "Active Solar", "Passive Cooling"].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`cooling-${type}`}
                              checked={coolingTypes.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCoolingTypes([...coolingTypes, type]);
                                } else {
                                  setCoolingTypes(coolingTypes.filter((t) => t !== type));
                                }
                              }}
                            />
                            <label htmlFor={`cooling-${type}`} className="text-sm cursor-pointer">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Green Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Green/Energy Features</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Smart Grid Meter", "Pre-Wired for Renewables", "Ready for Renewables", "Energy Star", "Solar PV", "Ground Source Heat Pump", "Geothermal/GSHP Hot Water"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`green-${feat}`}
                            checked={greenFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGreenFeatures([...greenFeatures, feat]);
                              } else {
                                setGreenFeatures(greenFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`green-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* ========================================
                    SECTION 9: FINANCIAL INFORMATION  
                    ======================================== */}

                {/* Commission Information Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Commission Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="commission_type">Commission Type</Label>
                      <Select
                        value={formData.commission_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, commission_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="flat_fee">Flat Fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission_rate">
                        {formData.commission_type === 'percentage' ? 'Rate' : 'Amount'}
                      </Label>
                      {formData.commission_type === 'percentage' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            id="commission_rate"
                            type="number"
                            step="0.01"
                            value={formData.commission_rate}
                            onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: e.target.value }))}
                            placeholder="2.5"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <FormattedInput
                          id="commission_rate"
                          format="currency"
                          decimals={0}
                          value={formData.commission_rate}
                          onChange={(value) => setFormData(prev => ({ ...prev, commission_rate: value }))}
                          placeholder="5000"
                        />
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="commission_notes">Commission Notes</Label>
                      <Input
                        id="commission_notes"
                        name="commission_notes"
                        placeholder="Additional commission details"
                        value={formData.commission_notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, commission_notes: e.target.value }))}
                        autoComplete="off"
                        data-lpignore="true"
                        data-form-type="other"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Sale Listing Criteria Section */}
                <div className="space-y-6">
                  <Label className="text-2xl font-semibold">Sale Listing Criteria</Label>

                  {/* Listing Agreement Types */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Type of Listing Agreement</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        "A-Exclusive Right to Sell",
                        "A-Exclusive Right to Sell with Variable Rate",
                        "B-ER w/ Named Exclusion",
                        "D-Exclusive Agency",
                        "G-Facilitation/ER to Sell",
                        "H-Facilitation/ER w/ Named Exclusion",
                        "I-Facilitation/Exclusive",
                        "L-Exclusive Right to Auction"
                      ].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agreement-${type}`}
                            checked={listingAgreementTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setListingAgreementTypes([...listingAgreementTypes, type]);
                              } else {
                                setListingAgreementTypes(listingAgreementTypes.filter((t) => t !== type));
                              }
                            }}
                          />
                          <label htmlFor={`agreement-${type}`} className="text-sm cursor-pointer">
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special Conditions */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Special Conditions</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Entry Only Listing</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={entryOnly === true ? "default" : "outline"}
                            onClick={() => setEntryOnly(entryOnly === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={entryOnly === false ? "default" : "outline"}
                            onClick={() => setEntryOnly(entryOnly === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Lender Owned</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={lenderOwned === true ? "default" : "outline"}
                            onClick={() => setLenderOwned(lenderOwned === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={lenderOwned === false ? "default" : "outline"}
                            onClick={() => setLenderOwned(lenderOwned === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Short Sale</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={shortSale === true ? "default" : "outline"}
                            onClick={() => setShortSale(shortSale === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={shortSale === false ? "default" : "outline"}
                            onClick={() => setShortSale(shortSale === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Property Style */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Property Style</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {["Colonial", "Contemporary", "Cape", "Ranch", "Victorian", "Farmhouse", "Cottage", "Split Entry"].map((style) => (
                        <div key={style} className="flex items-center space-x-2">
                          <Checkbox
                            id={`style-${style}`}
                            checked={propertyStyles.includes(style)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPropertyStyles([...propertyStyles, style]);
                              } else {
                                setPropertyStyles(propertyStyles.filter((s) => s !== style));
                              }
                            }}
                          />
                          <label htmlFor={`style-${style}`} className="text-sm cursor-pointer">
                            {style}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ========================================
                    SECTION 10: SHOWING & ACCESS
                    ======================================== */}

                {/* Showing Instructions Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Showing Instructions</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="showing_instructions">Instructions</Label>
                      <Textarea
                        id="showing_instructions"
                        placeholder="Please call 24 hours in advance. Remove shoes. Beware of dog..."
                        value={formData.showing_instructions}
                        onChange={(e) => setFormData(prev => ({ ...prev, showing_instructions: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lockbox_code">Lockbox Code</Label>
                        <Input
                          id="lockbox_code"
                          name="lockbox_code"
                          type="text"
                          placeholder="1234"
                          value={formData.lockbox_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, lockbox_code: e.target.value }))}
                          autoComplete="off"
                          data-lpignore="true"
                          data-form-type="other"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="virtual_tour_url">Virtual Tour URL</Label>
                        <Input
                          id="virtual_tour_url"
                          name="virtual_tour_url"
                          type="url"
                          placeholder="https://example.com/virtual-tour"
                          value={formData.virtual_tour_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, virtual_tour_url: e.target.value }))}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_name">Contact Name</Label>
                        <Input
                          id="showing_contact_name"
                          placeholder="John Doe"
                          value={formData.showing_contact_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, showing_contact_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                        <FormattedInput
                          id="showing_contact_phone"
                          format="phone"
                          placeholder="1234567890"
                          value={formData.showing_contact_phone}
                          onChange={(value) => setFormData(prev => ({ ...prev, showing_contact_phone: value }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="appointment_required"
                        checked={formData.appointment_required}
                        onChange={(e) => setFormData(prev => ({ ...prev, appointment_required: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                        Appointment required for showing
                      </Label>
                    </div>
                  </div>
                </div>




                {/* ========================================
                    SECTION 13: DISCLOSURES & LEGAL
                    ======================================== */}

                {/* Disclosures Section */}
                <div className="space-y-4 border-t pt-6">
                  
                  <div className="space-y-2">
                    <Label>Seller Disclosure</Label>
                    <RadioGroup value={sellerDisclosure} onValueChange={setSellerDisclosure}>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Yes" id="disclosure-yes" />
                          <Label htmlFor="disclosure-yes" className="font-normal cursor-pointer">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="No" id="disclosure-no" />
                          <Label htmlFor="disclosure-no" className="font-normal cursor-pointer">No</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disclosures_text">Disclosures</Label>
                    <Textarea
                      id="disclosures_text"
                      value={disclosuresText}
                      onChange={(e) => setDisclosuresText(e.target.value)}
                      placeholder="Enter any property disclosures..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="exclusions">Exclusions</Label>
                    <Textarea
                      id="exclusions"
                      value={exclusions}
                      onChange={(e) => setExclusions(e.target.value)}
                      placeholder="Items excluded from the sale..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="broker_comments">Broker Comments</Label>
                    <Textarea
                      id="broker_comments"
                      value={brokerComments}
                      onChange={(e) => setBrokerComments(e.target.value)}
                      placeholder="Additional broker comments..."
                      rows={4}
                    />
                  </div>
                </div>

                {/* ========================================
                    SECTION 8: PROPERTY FEATURES & AMENITIES
                    ======================================== */}

                {/* Property Features Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Property Features</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Hardwood floors',
                      'Granite countertops',
                      'Stainless appliances',
                      'Updated kitchen',
                      'Updated bathrooms',
                      'Fireplace',
                      'Central air',
                      'Forced air heating',
                      'Basement',
                      'Finished basement',
                      'Attic',
                      'Garage',
                      'Carport',
                      'Energy efficient',
                      'Smart home features'
                    ].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={feature}
                          checked={propertyFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPropertyFeatures([...propertyFeatures, feature]);
                            } else {
                              setPropertyFeatures(propertyFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={feature} className="font-normal cursor-pointer">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amenities Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Area Amenities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {["Public Transportation", "Shopping", "Marina", "Tennis Court", "Public School", "Private School", "University", "Hospital"].map(
                      (amenity) => (
                        <div key={amenity} className="flex items-center space-x-2">
                          <Checkbox
                            id={`amenity-${amenity}`}
                            checked={amenities.includes(amenity)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAmenities([...amenities, amenity]);
                              } else {
                                setAmenities(amenities.filter((a) => a !== amenity));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`amenity-${amenity}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {amenity}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {["Laundry/Dry Cleaning", "House of Worship", "Highway Access", "Swimming Pool", "Park", "Walk/Jog Trails", "Bike Path"].map(
                      (amenity) => (
                        <div key={amenity} className="flex items-center space-x-2">
                          <Checkbox
                            id={`amenity2-${amenity}`}
                            checked={amenities.includes(amenity)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAmenities([...amenities, amenity]);
                              } else {
                                setAmenities(amenities.filter((a) => a !== amenity));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`amenity2-${amenity}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {amenity}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {["Golf Course", "Beach"].map(
                      (amenity) => (
                        <div key={amenity} className="flex items-center space-x-2">
                          <Checkbox
                            id={`amenity3-${amenity}`}
                            checked={amenities.includes(amenity)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAmenities([...amenities, amenity]);
                              } else {
                                setAmenities(amenities.filter((a) => a !== amenity));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`amenity3-${amenity}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {amenity}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="space-y-2 border-t pt-6">
                  <Label htmlFor="additional_notes">Additional Notes</Label>
                  <Textarea
                    id="additional_notes"
                    placeholder="Any other important information about the property..."
                    value={formData.additional_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                    rows={4}
                  />
                </div>

                {/* ========================================
                    SECTION 5: PHOTOS & MEDIA
                    ======================================== */}

                {/* Property Photos Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-xl font-semibold">Property Photos</Label>
                    <PhotoManagementDialog
                      photos={photos}
                      onPhotosChange={setPhotos}
                    />
                  </div>
                  {photos.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {photos.length} {photos.length === 1 ? 'photo' : 'photos'} uploaded. First photo will be the main image.
                    </p>
                  )}
                </div>

                {/* Floor Plans Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold">Floor Plans</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload floor plan images or PDFs
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('floorplan-upload')?.click()}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Add Floor Plans
                    </Button>
                  </div>
                  <Input
                    id="floorplan-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'floorplans')}
                  />
                  
                  {floorPlans.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {floorPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="relative group border rounded-lg overflow-hidden bg-muted"
                        >
                          {plan.preview ? (
                            <img
                              src={plan.preview}
                              alt={plan.file.name}
                              className="w-full h-32 object-cover"
                            />
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-2 text-xs truncate">
                            {plan.file.name}
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveFile(plan.id, 'floorplans')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold">Documents</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload property documents (PDF, Word)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('document-upload')?.click()}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Add Documents
                    </Button>
                  </div>
                  <Input
                    id="document-upload"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files, 'documents')}
                  />
                  
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-muted"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm">{doc.file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(doc.file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(doc.id, 'documents')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons - Bottom */}
                <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t items-center">
                  <Button variant="ghost" size="lg" onClick={() => navigate("/agent-dashboard")} type="button" className="gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </Button>
                  <div className="flex-1 flex items-center gap-2">
                    {autoSaving && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Auto-saving...</span>
                      </div>
                    )}
                    {!autoSaving && lastAutoSave && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Last saved {lastAutoSave.toLocaleTimeString()}</span>
                      </div>
                    )}
                    {!autoSaving && !lastAutoSave && hasUnsavedChanges && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Unsaved changes</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="lg" onClick={() => handleSaveDraft(false)} type="button" disabled={submitting || autoSaving} className="gap-2">
                    <Save className="w-5 h-5" />
                    {isEditMode ? "Save Changes" : "Save Draft"}
                  </Button>
                  <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
                    <Eye className="w-5 h-5" />
                    Preview
                  </Button>
                  <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
                    <Upload className="w-5 h-5" />
                    {submitting ? (isEditMode ? "Saving..." : "Publishing...") : (isEditMode ? "Save Changes" : "Publish")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
      </div>
      
      {/* Open House Scheduling Dialog */}
      <Dialog open={openHouseDialogOpen} onOpenChange={setOpenHouseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Schedule {openHouseDialogType === 'public' ? 'Public 🎈' : 'Broker 🚗'} Open House
            </DialogTitle>
            <DialogDescription>
              Select multiple dates and set the time for your {openHouseDialogType === 'public' ? 'public' : 'broker'} open house.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Dates (click multiple dates)</Label>
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                disabled={(date) => date < new Date()}
                className="rounded-md border pointer-events-auto"
              />
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDates.map((date, idx) => (
                    <div key={idx} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {format(date, "MMM d, yyyy")}
                      <button
                        type="button"
                        onClick={() => setSelectedDates(selectedDates.filter((_, i) => i !== idx))}
                        className="hover:bg-primary/20 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Time Selection */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-semibold">Set Time for All Selected Dates</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Select value={dialogStartTime} onValueChange={setDialogStartTime}>
                    <SelectTrigger className="text-lg">
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2);
                        const minute = i % 2 === 0 ? '00' : '30';
                        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        const period = hour >= 12 ? 'PM' : 'AM';
                        return (
                          <SelectItem key={time} value={time}>
                            {displayHour}:{minute} {period}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Select value={dialogEndTime} onValueChange={setDialogEndTime}>
                    <SelectTrigger className="text-lg">
                      <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2);
                        const minute = i % 2 === 0 ? '00' : '30';
                        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        const period = hour >= 12 ? 'PM' : 'AM';
                        return (
                          <SelectItem key={time} value={time}>
                            {displayHour}:{minute} {period}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {dialogStartTime && dialogEndTime && (
                <p className="text-sm text-muted-foreground">
                  Open house will be from {dialogStartTime} to {dialogEndTime}
                </p>
              )}
            </div>
            
            {/* Comments */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Comments (Optional)</Label>
              <Textarea
                placeholder="Refreshments will be served. Park in the driveway..."
                value={dialogComments}
                onChange={(e) => setDialogComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenHouseDialogOpen(false);
                setSelectedDates([]);
                setDialogStartTime('');
                setDialogEndTime('');
                setDialogComments('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDates.length === 0) {
                  toast.error("Please select at least one date");
                  return;
                }
                if (!dialogStartTime || !dialogEndTime) {
                  toast.error("Please set start and end times");
                  return;
                }
                
                const newOpenHouses = selectedDates.map(date => ({
                  type: openHouseDialogType,
                  date: date.toISOString().split('T')[0],
                  start_time: dialogStartTime,
                  end_time: dialogEndTime,
                  notes: dialogComments
                }));
                
                setOpenHouses([...openHouses, ...newOpenHouses]);
                setOpenHouseDialogOpen(false);
                setSelectedDates([]);
                setDialogStartTime('');
                setDialogEndTime('');
                setDialogComments('');
                toast.success(`Added ${newOpenHouses.length} open house(s)`);
                navigate('/agent-dashboard');
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Add Open House(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddListing;
