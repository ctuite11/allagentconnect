import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { FormattedInput } from "@/components/ui/formatted-input";
import { toast } from "sonner";
import { Loader2, Save, Eye, Upload, X, Image as ImageIcon, FileText, GripVertical, CalendarIcon, Home } from "lucide-react";
import { z } from "zod";
import listingIcon from "@/assets/listing-creation-icon.png";
import { PhotoManagementDialog } from "@/components/PhotoManagementDialog";
import { getAreasForCity } from "@/data/usNeighborhoodsData";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format").optional().or(z.literal("")),
  price: z.number().min(1000, "Price must be at least $1,000").max(100000000, "Price must be less than $100,000,000"),
  property_type: z.string().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more").max(50, "Bedrooms must be 50 or less").optional(),
  bathrooms: z.number().min(0, "Bathrooms must be 0 or more").max(50, "Bathrooms must be 50 or less").optional(),
  square_feet: z.number().int().min(1, "Square feet must be at least 1").max(100000, "Square feet must be less than 100,000").optional(),
  year_built: z.number().int().min(1800, "Year built must be 1800 or later").max(new Date().getFullYear() + 1, "Year built cannot be in the future").optional(),
  lot_size: z.number().min(0, "Lot size must be 0 or more").max(10000, "Lot size must be less than 10,000 acres").optional(),
  description: z.string().max(5000, "Description must be less than 5,000 characters").optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

const AddListing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
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

  // Store fetched property data
  const [attomData, setAttomData] = useState<any>(null);
  const [walkScoreData, setWalkScoreData] = useState<any>(null);
  const [schoolsData, setSchoolsData] = useState<any>(null);
  const [valueEstimate, setValueEstimate] = useState<any>(null);

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

  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);
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
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAddressSelect = useCallback(async (place: any) => {
    console.log("=== [AddListing] handleAddressSelect CALLED ===");
    console.log("[AddListing] Address selected - raw place data:", place);
    console.log("[AddListing] Place keys:", place ? Object.keys(place) : "NO PLACE");
    
    // Normalize address components between legacy Autocomplete and new PlaceAutocompleteElement
    const legacyComponents = place.address_components;
    const newComponents = place.addressComponents?.map((c: any) => ({
      long_name: c.longText,
      short_name: c.shortText,
      types: c.types || [],
    }));
    const addressComponents = legacyComponents || newComponents || [];
    
    console.log("[AddListing] Normalized address components:", addressComponents);

    const getComponent = (type: string) => {
      const component = addressComponents.find((c: any) => c.types?.includes(type));
      return component?.long_name || "";
    };

    const getComponentShort = (type: string) => {
      const component = addressComponents.find((c: any) => c.types?.includes(type));
      return component?.short_name || "";
    };

    const formattedAddress = place.formatted_address || place.formattedAddress || place.name || "";
    const streetAddress = formattedAddress.split(",")[0] || "";
    const city = getComponent("locality") || getComponent("sublocality") || getComponent("postal_town");
    const stateShort = getComponentShort("administrative_area_level_1") || getComponent("administrative_area_level_1");
    const zip_code = getComponent("postal_code");
    const county = getComponent("administrative_area_level_2");
    const neighborhood = getComponent("neighborhood") || getComponent("sublocality_level_1");
    
    console.log("[AddListing] Extracted data:", { streetAddress, city, state: stateShort, zip_code, county, neighborhood });

    // Normalize location
    let latitude: number | null = null;
    let longitude: number | null = null;
    const loc = place.geometry?.location || place.location;
    try {
      if (typeof loc?.lat === "function") {
        latitude = loc.lat();
        longitude = loc.lng();
      } else if (typeof loc?.lat === "number") {
        latitude = loc.lat;
        longitude = loc.lng;
      }
    } catch {}
    
    console.log("[AddListing] Extracted location:", { latitude, longitude });

    setFormData(prev => ({
      ...prev,
      // Store the FULL formatted address so the input shows the complete selection
      address: formattedAddress,
      city,
      state: stateShort,
      zip_code,
      county,
      neighborhood,
      latitude,
      longitude,
    }));

    console.log("[AddListing] About to call fetchPropertyData:", { 
      hasLatLng: !!(latitude && longitude),
      latitude, 
      longitude, 
      address: formattedAddress,
      city,
      state: stateShort,
      zip: zip_code
    });

    if (latitude && longitude) {
      await fetchPropertyData(latitude, longitude, formattedAddress, city, stateShort, zip_code);
    } else {
      console.warn("[AddListing] Skipping fetchPropertyData - missing coordinates");
      toast.error("Could not extract coordinates from address. Please try again.");
    }
  }, []);
  const fetchPropertyData = async (lat: number, lng: number, address: string, city: string, state: string, zip: string) => {
    console.log("[AddListing] fetchPropertyData called with:", { lat, lng, address, city, state, zip });
    setSubmitting(true);
    try {
      console.log("[AddListing] Invoking fetch-property-data edge function...");
      const { data, error } = await supabase.functions.invoke("fetch-property-data", {
        body: { latitude: lat, longitude: lng, address, city, state, zip_code: zip },
      });

      console.log("[AddListing] Edge function response:", { data, error });
      setDebugInfo({ source: 'fetch-property-data', payload: { lat, lng, address, city, state, zip }, data, error });

      if (error) throw error;

      if (data) {
        // Store all fetched data in state
        if (data.attom) {
          setAttomData(data.attom);
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
            property_type: data.attom.property_type || prev.property_type,
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
        
        toast.success("Property data loaded successfully");
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
        await fetchPropertyData(latitude, longitude, address, city, state, zip_code);
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
        return prev.filter(f => f.id !== id);
      });
    } else if (type === 'floorplans') {
      setFloorPlans(prev => {
        const file = prev.find(f => f.id === id);
        if (file?.preview) URL.revokeObjectURL(file.preview);
        return prev.filter(f => f.id !== id);
      });
    } else {
      setDocuments(prev => prev.filter(f => f.id !== id));
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

  const uploadFiles = async (): Promise<{ photos: any[], floorPlans: any[], documents: any[] }> => {
    const uploadedPhotos: any[] = [];
    const uploadedFloorPlans: any[] = [];
    const uploadedDocuments: any[] = [];

    // Upload photos
    for (const photo of photos) {
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

    // Upload floor plans
    for (const plan of floorPlans) {
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

    // Upload documents
    for (const doc of documents) {
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

  const handleSaveDraft = async () => {
    try {
      await handleSubmit(new Event('submit') as any, false);
      navigate("/agent-dashboard");
    } catch (error) {
      // Error already handled in handleSubmit
    }
  };

  const handlePreview = () => {
    toast.info("Preview functionality coming soon");
    navigate("/agent-dashboard");
  };

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = true) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare data for validation
      const dataToValidate = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code.trim() || "",
        price: parseFloat(formData.price),
        property_type: formData.property_type || undefined,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : undefined,
        year_built: formData.year_built ? parseInt(formData.year_built) : undefined,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : undefined,
        description: formData.description || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      // Validate data with Zod
      const validatedData = listingSchema.parse(dataToValidate);

      // Upload files first
      toast.info("Uploading files...");
      const uploadedFiles = await uploadFiles();

      const { error } = await supabase.from("listings").insert({
        agent_id: user.id,
        status: publishNow ? formData.status : "draft",
        listing_type: formData.listing_type,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zip_code: validatedData.zip_code,
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
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: disclosures,
        property_features: propertyFeatures,
        amenities: amenities,
        additional_notes: formData.additional_notes || null,
        photos: uploadedFiles.photos,
        floor_plans: uploadedFiles.floorPlans,
        documents: uploadedFiles.documents,
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
        total_parking_spaces: parkingSpaces ? parseInt(parkingSpaces) : null,
        construction_features: constructionFeatures.length > 0 ? constructionFeatures : null,
        roof_materials: roofMaterials.length > 0 ? roofMaterials : null,
        exterior_features_list: exteriorFeatures.length > 0 ? exteriorFeatures : null,
        heating_types: heatingTypes.length > 0 ? heatingTypes : null,
        cooling_types: coolingTypes.length > 0 ? coolingTypes : null,
        green_features: greenFeatures.length > 0 ? greenFeatures : null,
      });

      if (error) throw error;

      toast.success("Listing created successfully!");
      navigate("/agent-dashboard");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-4xl font-bold">Create a new listing for sale.</h1>
            <img src={listingIcon} alt="Listing creation" className="w-16 h-16" />
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 mb-8">
            <div className="flex flex-wrap gap-4">
              <Button variant="default" size="lg" onClick={handleSaveDraft} type="button" className="gap-2">
                <Save className="w-5 h-5" />
                Save as Draft
              </Button>
              <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
                <Eye className="w-5 h-5" />
                Preview Listing
              </Button>
              <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
                <Upload className="w-5 h-5" />
                {submitting ? "Publishing..." : "Publish Listing"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => {
                  setOpenHouseDialogType('public');
                  setOpenHouseDialogOpen(true);
                }} 
                className="gap-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                <span className="text-2xl">🎈</span>
                Schedule Open House
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => {
                  setOpenHouseDialogType('broker');
                  setOpenHouseDialogOpen(true);
                }} 
                className="gap-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                <span className="text-2xl">🚗</span>
                Schedule Broker Open House
              </Button>
            </div>
          </div>

          {/* Form Card */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Listing Details</h2>
              
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
                {/* Row 1: Listing Type, Property Type, Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="listing_type">Listing Type *</Label>
                    <Select
                      value={formData.listing_type}
                      onValueChange={(value) => setFormData({ ...formData, listing_type: value })}
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
                      onValueChange={(value) => setFormData({ ...formData, property_type: value })}
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
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">New</SelectItem>
                        <SelectItem value="coming_soon">Coming Soon</SelectItem>
                        <SelectItem value="off_market">Off Market</SelectItem>
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
                            setFormData({ 
                              ...formData, 
                              activation_date: date ? date.toISOString().split('T')[0] : "" 
                            })
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

                {/* Row 2: Enter Address, List Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Enter Address *</Label>
                    <AddressAutocomplete
                      onPlaceSelect={handleAddressSelect}
                      placeholder="Full property address"
                      value={formData.address}
                      onChange={(val) => setFormData({ ...formData, address: val })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">List Price *</Label>
                    <FormattedInput
                      id="price"
                      format="currency"
                      placeholder="500000"
                      value={formData.price}
                      onChange={(value) => setFormData({ ...formData, price: value })}
                      required
                    />
                  </div>
                </div>

                {/* Row 3: County, Neighborhood */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Select
                      value={formData.county}
                      onValueChange={(value) => setFormData({ ...formData, county: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select county" />
                      </SelectTrigger>
                      <SelectContent>
                        {MA_COUNTIES.map((county) => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Area/Neighborhood</Label>
                    <Select
                      value={formData.neighborhood}
                      onValueChange={(value) => setFormData({ ...formData, neighborhood: value })}
                      disabled={!
                        ((formData.city && formData.state && getAreasForCity(formData.city, formData.state).length > 0) ||
                         (formData.county ?? '').toLowerCase().includes('suffolk'))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          ((formData.city && formData.state && getAreasForCity(formData.city, formData.state).length > 0) ||
                           (formData.county ?? '').toLowerCase().includes('suffolk'))
                            ? 'Select area'
                            : 'Enter address or set county first'
                        } />
                      </SelectTrigger>
                      {(
                        (formData.city && formData.state && getAreasForCity(formData.city, formData.state).length > 0) ||
                        (formData.county ?? '').toLowerCase().includes('suffolk')
                      ) && (
                        <SelectContent className="max-h-[300px]">
                          {(getAreasForCity(formData.city, formData.state).length > 0
                            ? getAreasForCity(formData.city, formData.state)
                            : getAreasForCity('Boston', 'MA')
                          ).map((area) => (
                            <SelectItem key={area} value={area}>
                              {area}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      )}
                    </Select>
                  </div>
                </div>

                {/* Hidden fields for state and zip (auto-populated from address) */}
                <input type="hidden" name="state" value={formData.state} />
                <input type="hidden" name="zip_code" value={formData.zip_code} />

                {/* Property Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      step="0.5"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="square_feet">Sq Ft</Label>
                    <Input
                      id="square_feet"
                      type="number"
                      value={formData.square_feet}
                      onChange={(e) => setFormData({ ...formData, square_feet: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year_built">Year Built</Label>
                    <Input
                      id="year_built"
                      type="number"
                      value={formData.year_built}
                      onChange={(e) => setFormData({ ...formData, year_built: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lot_size">Lot Size (sq ft)</Label>
                  <FormattedInput
                    id="lot_size"
                    format="number"
                    decimals={0}
                    value={formData.lot_size}
                    onChange={(value) => setFormData({ ...formData, lot_size: value })}
                  />
                </div>

                {/* List Date and Expiration Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="list_date">List Date</Label>
                    <Input
                      id="list_date"
                      type="date"
                      value={formData.list_date}
                      onChange={(e) => setFormData({ ...formData, list_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration_date">Expiration Date</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    />
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Property Tax Information */}
                <div className="space-y-6">
                  <Label className="text-xl font-semibold">Property Tax Information</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="annual_property_tax">Annual Property Tax</Label>
                      <FormattedInput
                        id="annual_property_tax"
                        format="currency"
                        decimals={2}
                        value={formData.annual_property_tax}
                        onChange={(value) => setFormData({ ...formData, annual_property_tax: value })}
                        placeholder="$0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_year">Tax Year</Label>
                      <Input
                        id="tax_year"
                        type="number"
                        value={formData.tax_year}
                        onChange={(e) => setFormData({ ...formData, tax_year: e.target.value })}
                        placeholder={new Date().getFullYear().toString()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_assessment_value">Tax Assessment Value</Label>
                      <FormattedInput
                        id="tax_assessment_value"
                        format="currency"
                        decimals={2}
                        value={formData.tax_assessment_value}
                        onChange={(value) => setFormData({ ...formData, tax_assessment_value: value })}
                        placeholder="$0.00"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Property Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Property Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    placeholder="Describe the property features, location highlights, and any special details..."
                  />
                </div>

                <Separator className="my-6" />

                {/* Sale Listing Criteria Section */}
                <div className="space-y-6 border-t pt-6">
                  <Label className="text-2xl font-semibold">Sale Listing Criteria</Label>

                  {/* Listing Agreement Types */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Type of Listing Agreement</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        "A-Exclusive Right to Sell",
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
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <label className="text-sm font-medium">Water View</label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={waterView === true ? "default" : "outline"}
                            onClick={() => setWaterView(waterView === true ? null : true)}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={waterView === false ? "default" : "outline"}
                            onClick={() => setWaterView(waterView === false ? null : false)}
                          >
                            No
                          </Button>
                        </div>
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

                  {/* Interior Features & Parking */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Interior Features</Label>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="minFireplaces">Number of Fireplaces</Label>
                          <Input
                            id="minFireplaces"
                            type="number"
                            value={minFireplaces}
                            onChange={(e) => setMinFireplaces(e.target.value)}
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <label className="text-sm font-medium">Basement</label>
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
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Parking</Label>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="garageSpaces">Garage Spaces</Label>
                          <Input
                            id="garageSpaces"
                            type="number"
                            value={garageSpaces}
                            onChange={(e) => setGarageSpaces(e.target.value)}
                            placeholder="e.g., 2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="parkingSpaces">Total Parking Spaces</Label>
                          <Input
                            id="parkingSpaces"
                            type="number"
                            value={parkingSpaces}
                            onChange={(e) => setParkingSpaces(e.target.value)}
                            placeholder="e.g., 3"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Construction Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Construction Features</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Insulated Concrete Form", "Structural Insulated Panels", "Conventional", "Adobe", "Cork", "Rammed Earth"].map((feat) => (
                        <div key={feat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`construction-${feat}`}
                            checked={constructionFeatures.includes(feat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setConstructionFeatures([...constructionFeatures, feat]);
                              } else {
                                setConstructionFeatures(constructionFeatures.filter((f) => f !== feat));
                              }
                            }}
                          />
                          <label htmlFor={`construction-${feat}`} className="text-sm cursor-pointer">
                            {feat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Roof Material */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Roof Material</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Asphalt/Composition Shingles", "Wood Shingles", "Tile", "Slate", "Metal", "Solar Shingles", "Reflective Roofing"].map((mat) => (
                        <div key={mat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`roof-${mat}`}
                            checked={roofMaterials.includes(mat)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setRoofMaterials([...roofMaterials, mat]);
                              } else {
                                setRoofMaterials(roofMaterials.filter((m) => m !== mat));
                              }
                            }}
                          />
                          <label htmlFor={`roof-${mat}`} className="text-sm cursor-pointer">
                            {mat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exterior Features */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Exterior Features</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Deck", "Patio", "Pool", "Professional Landscaping", "Irrigation", "Solar Powered Area Lighting", "Drought Tolerant Landscaping", "Cistern Water Storage"].map((feat) => (
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

                {/* Commission Information Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Commission Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="commission_type">Commission Type</Label>
                      <Select
                        value={formData.commission_type}
                        onValueChange={(value) => setFormData({ ...formData, commission_type: value })}
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
                      <FormattedInput
                        id="commission_rate"
                        format={formData.commission_type === 'percentage' ? 'percentage' : 'currency'}
                        decimals={2}
                        placeholder={formData.commission_type === 'percentage' ? '2.5' : '5000'}
                        value={formData.commission_rate}
                        onChange={(value) => setFormData({ ...formData, commission_rate: value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="commission_notes">Commission Notes</Label>
                      <Input
                        id="commission_notes"
                        placeholder="Additional commission details"
                        value={formData.commission_notes}
                        onChange={(e) => setFormData({ ...formData, commission_notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

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
                        onChange={(e) => setFormData({ ...formData, showing_instructions: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lockbox_code">Lockbox Code</Label>
                        <Input
                          id="lockbox_code"
                          type="password"
                          placeholder="1234"
                          value={formData.lockbox_code}
                          onChange={(e) => setFormData({ ...formData, lockbox_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_name">Contact Name</Label>
                        <Input
                          id="showing_contact_name"
                          placeholder="John Doe"
                          value={formData.showing_contact_name}
                          onChange={(e) => setFormData({ ...formData, showing_contact_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                        <Input
                          id="showing_contact_phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.showing_contact_phone}
                          onChange={(e) => setFormData({ ...formData, showing_contact_phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="appointment_required"
                        checked={formData.appointment_required}
                        onChange={(e) => setFormData({ ...formData, appointment_required: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                        Appointment required for showing
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Open House Scheduling Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Open House Days</Label>
                  
                  <Card className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Public Open Houses */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🎈</span>
                          <h3 className="font-semibold">For Public:</h3>
                        </div>
                        
                        {openHouses.filter(oh => oh.type === 'public').length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            There are no future open house dates for the public.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {openHouses.filter(oh => oh.type === 'public').map((openHouse, idx) => {
                              const originalIndex = openHouses.findIndex(oh => oh === openHouse);
                              return (
                                <Card key={originalIndex} className="p-3 bg-muted/50">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1">
                                      <div className="font-medium">
                                        {openHouse.date ? format(new Date(openHouse.date), "PPP") : "Date not set"}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {openHouse.start_time && openHouse.end_time 
                                          ? `${openHouse.start_time} - ${openHouse.end_time}`
                                          : "Time not set"}
                                      </div>
                                      {openHouse.notes && (
                                        <p className="text-sm text-muted-foreground mt-1">{openHouse.notes}</p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setOpenHouses(openHouses.filter((_, i) => i !== originalIndex))}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => setOpenHouses([...openHouses, {
                            type: 'public',
                            date: '',
                            start_time: '',
                            end_time: '',
                            notes: ''
                          }])}
                        >
                          Schedule Open House
                        </Button>
                      </div>
                      
                      {/* Broker Open Houses */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🚗</span>
                          <h3 className="font-semibold">For Broker:</h3>
                        </div>
                        
                        {openHouses.filter(oh => oh.type === 'broker').length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            There are no future open house dates for the brokers.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {openHouses.filter(oh => oh.type === 'broker').map((openHouse, idx) => {
                              const originalIndex = openHouses.findIndex(oh => oh === openHouse);
                              return (
                                <Card key={originalIndex} className="p-3 bg-muted/50">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1">
                                      <div className="font-medium">
                                        {openHouse.date ? format(new Date(openHouse.date), "PPP") : "Date not set"}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {openHouse.start_time && openHouse.end_time 
                                          ? `${openHouse.start_time} - ${openHouse.end_time}`
                                          : "Time not set"}
                                      </div>
                                      {openHouse.notes && (
                                        <p className="text-sm text-muted-foreground mt-1">{openHouse.notes}</p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setOpenHouses(openHouses.filter((_, i) => i !== originalIndex))}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => setOpenHouses([...openHouses, {
                            type: 'broker',
                            date: '',
                            start_time: '',
                            end_time: '',
                            notes: ''
                          }])}
                        >
                          Schedule Broker Open House
                        </Button>
                      </div>
                    </div>
                  </Card>
                  
                  {/* Edit Dialog for Open Houses */}
                  {openHouses.some(oh => !oh.date || !oh.start_time || !oh.end_time) && (
                    <div className="space-y-4">
                      {openHouses.map((openHouse, index) => {
                        if (openHouse.date && openHouse.start_time && openHouse.end_time) return null;
                        
                        return (
                          <Card key={index} className="p-4 border-primary">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">
                                  {openHouse.type === 'public' ? 'Public' : 'Broker'} Open House Details
                                </h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOpenHouses(openHouses.filter((_, i) => i !== index))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label>Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-start text-left font-normal",
                                          !openHouse.date && "text-muted-foreground"
                                        )}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {openHouse.date ? (
                                          format(new Date(openHouse.date), "PPP")
                                        ) : (
                                          <span>Pick a date</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={openHouse.date ? new Date(openHouse.date) : undefined}
                                        onSelect={(date) => {
                                          const updated = [...openHouses];
                                          updated[index].date = date ? date.toISOString().split('T')[0] : '';
                                          setOpenHouses(updated);
                                        }}
                                        disabled={(date) => date < new Date()}
                                        initialFocus
                                        className="pointer-events-auto"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                
                                <div className="space-y-2">
                                  <Label>Start Time</Label>
                                  <Input
                                    type="time"
                                    value={openHouse.start_time}
                                    onChange={(e) => {
                                      const updated = [...openHouses];
                                      updated[index].start_time = e.target.value;
                                      setOpenHouses(updated);
                                    }}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label>End Time</Label>
                                  <Input
                                    type="time"
                                    value={openHouse.end_time}
                                    onChange={(e) => {
                                      const updated = [...openHouses];
                                      updated[index].end_time = e.target.value;
                                      setOpenHouses(updated);
                                    }}
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Notes (Optional)</Label>
                                <Textarea
                                  placeholder="Refreshments will be served. Park in the driveway..."
                                  value={openHouse.notes}
                                  onChange={(e) => {
                                    const updated = [...openHouses];
                                    updated[index].notes = e.target.value;
                                    setOpenHouses(updated);
                                  }}
                                  rows={2}
                                />
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Disclosures Section */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-xl font-semibold">Disclosures</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'Lead-based paint',
                      'Asbestos',
                      'Radon',
                      'Flood zone',
                      'HOA restrictions',
                      'Previous damage/repairs',
                      'Environmental hazards',
                      'Easements',
                      'Pending litigation',
                      'Property liens'
                    ].map((disclosure) => (
                      <div key={disclosure} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={disclosure}
                          checked={disclosures.includes(disclosure)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDisclosures([...disclosures, disclosure]);
                            } else {
                              setDisclosures(disclosures.filter(d => d !== disclosure));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={disclosure} className="font-normal cursor-pointer">
                          {disclosure}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

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
                  <Label className="text-xl font-semibold">Amenities</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      'Pool',
                      'Hot tub',
                      'Tennis court',
                      'Gym/Fitness center',
                      'Playground',
                      'Clubhouse',
                      'Pet friendly',
                      'Gated community',
                      'Security system',
                      'Concierge',
                      'Elevator',
                      'Storage units',
                      'Bike storage',
                      'EV charging',
                      'Package room'
                    ].map((amenity) => (
                      <div key={amenity} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={amenity}
                          checked={amenities.includes(amenity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAmenities([...amenities, amenity]);
                            } else {
                              setAmenities(amenities.filter(a => a !== amenity));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={amenity} className="font-normal cursor-pointer">
                          {amenity}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="space-y-2 border-t pt-6">
                  <Label htmlFor="additional_notes">Additional Notes</Label>
                  <Textarea
                    id="additional_notes"
                    placeholder="Any other important information about the property..."
                    value={formData.additional_notes}
                    onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                    rows={4}
                  />
                </div>

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
                <div className="flex gap-4 mt-8 pt-6 border-t">
                  <Button variant="default" size="lg" onClick={handleSaveDraft} type="button" className="gap-2">
                    <Save className="w-5 h-5" />
                    Save as Draft
                  </Button>
                  <Button variant="default" size="lg" onClick={handlePreview} type="button" className="gap-2">
                    <Eye className="w-5 h-5" />
                    Preview Listing
                  </Button>
                  <Button variant="default" size="lg" onClick={(e) => handleSubmit(e, true)} type="button" disabled={submitting} className="gap-2">
                    <Upload className="w-5 h-5" />
                    {submitting ? "Publishing..." : "Publish Listing"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
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
