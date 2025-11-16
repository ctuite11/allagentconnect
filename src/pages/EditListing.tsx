import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { Loader2, Cloud, Upload, FileText, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PhotoManagementDialog } from "@/components/PhotoManagementDialog";
import { getAreasForCity } from "@/data/usNeighborhoodsData";

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
  uploaded?: boolean;
  url?: string;
}

const listingSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "Zip code is required"),
  property_type: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  square_feet: z.number().nullable(),
  description: z.string().optional(),
  status: z.string(),
});

const EditListing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const addressSelectedRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [formData, setFormData] = useState({
    listing_type: "for_sale",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    neighborhood: "",
    property_type: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    description: "",
    status: "active",
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
    tax_assessment_value: "",
    tax_year: "",
    lot_size: "",
    year_built: "",
    num_fireplaces: "",
  });

  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [manualAddressDialogOpen, setManualAddressDialogOpen] = useState(false);
  
  // Unit number for condos, townhouses, rentals
  const [unitNumber, setUnitNumber] = useState("");
  const [hoaFee, setHoaFee] = useState("");
  const [hoaFeeFrequency, setHoaFeeFrequency] = useState("monthly");
  
  useEffect(() => {
    if (manualAddressDialogOpen) addressSelectedRef.current = false;
  }, [manualAddressDialogOpen]);
  
  // Parse unit from a street line like "123 Main St Apt 4B" or "123 Main St #4B"
  const extractUnitFromAddress = (streetLine: string) => {
    const pattern = /(.*?)(?:\s+(?:#|Unit|Apt|Apartment|Suite|Ste)\s*([A-Za-z0-9-]+))$/i;
    const match = streetLine.match(pattern);
    if (match) {
      return { street: match[1].trim(), unit: match[2].trim() };
    }
    return { street: streetLine.trim(), unit: "" };
  };
  
  // New comprehensive fields
  const [assessedValue, setAssessedValue] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [residentialExemption, setResidentialExemption] = useState("");
  const [floors, setFloors] = useState("");
  const [basementType, setBasementType] = useState("");
  const [basementFeatures, setBasementFeatures] = useState<string[]>([]);
  const [basementFloorType, setBasementFloorType] = useState<string[]>([]);
  const [leadPaint, setLeadPaint] = useState("");
  const [handicapAccess, setHandicapAccess] = useState("");
  const [foundation, setFoundation] = useState<string[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [parkingComments, setParkingComments] = useState("");
  const [parkingFeatures, setParkingFeatures] = useState<string[]>([]);
  const [garageSpaces, setGarageSpaces] = useState("");
  const [garageComments, setGarageComments] = useState("");
  const [garageFeatures, setGarageFeatures] = useState<string[]>([]);
  const [lotSizeSource, setLotSizeSource] = useState("");
  const [lotDescription, setLotDescription] = useState<string[]>([]);
  const [sellerDisclosure, setSellerDisclosure] = useState("");
  const [disclosuresText, setDisclosuresText] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [brokerComments, setBrokerComments] = useState("");
  
  // Photos, floor plans, and documents
  const [photos, setPhotos] = useState<FileWithPreview[]>([]);
  const [floorPlans, setFloorPlans] = useState<FileWithPreview[]>([]);
  const [documents, setDocuments] = useState<FileWithPreview[]>([]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Warn on browser/tab close if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Auto-save draft function using localStorage
  const saveDraft = useCallback(() => {
    if (!id) return;

    try {
      const draftData = {
        formData,
        disclosures,
        propertyFeatures,
        amenities,
        unitNumber,
        hoaFee,
        hoaFeeFrequency,
        assessedValue,
        fiscalYear,
        residentialExemption,
        floors,
        basementType,
        basementFeatures,
        basementFloorType,
        leadPaint,
        handicapAccess,
        foundation,
        parkingSpaces,
        parkingComments,
        parkingFeatures,
        garageSpaces,
        garageComments,
        garageFeatures,
        lotSizeSource,
        lotDescription,
        sellerDisclosure,
        disclosuresText,
        exclusions,
        brokerComments,
      };

      localStorage.setItem(`listing_draft_${id}`, JSON.stringify(draftData));
      setLastAutoSave(new Date());
      setIsDirty(false); // Reset dirty state after autosave
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [id, formData, disclosures, propertyFeatures, amenities, unitNumber, hoaFee, hoaFeeFrequency, 
      assessedValue, fiscalYear, residentialExemption, floors, basementType, basementFeatures, 
      basementFloorType, leadPaint, handicapAccess, foundation, parkingSpaces, parkingComments, 
      parkingFeatures, garageSpaces, garageComments, garageFeatures, lotSizeSource, lotDescription, 
      sellerDisclosure, disclosuresText, exclusions, brokerComments]);

  // Set up auto-save timer (every 10 seconds)
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      saveDraft();
    }, 10000); // 10 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [saveDraft]);

  // Save on blur helper
  const handleBlur = useCallback(() => {
    saveDraft();
  }, [saveDraft]);

  // Clear draft after successful save
  useEffect(() => {
    return () => {
      if (id && localStorage.getItem(`listing_draft_${id}`)) {
        // Keep draft until manual save
      }
    };
  }, [id]);

  useEffect(() => {
    const checkAuthAndLoadListing = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      if (id) {
        await loadListing(id, session.user.id);
      }
    };

    checkAuthAndLoadListing();
  }, [id, navigate]);

  const loadListing = async (listingId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("agent_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Listing not found or you don't have permission to edit it");
        navigate("/agent-dashboard");
        return;
      }

      if (data) {
        setFormData({
          listing_type: data.listing_type || "for_sale",
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          neighborhood: data.neighborhood || "",
          property_type: data.property_type || "",
          price: (data.price ?? "").toString(),
          bedrooms: data.bedrooms?.toString() || "",
          bathrooms: data.bathrooms?.toString() || "",
          square_feet: data.square_feet?.toString() || "",
          description: data.description || "",
          status: data.status,
          commission_rate: data.commission_rate?.toString() || "",
          commission_type: data.commission_type || "percentage",
          commission_notes: data.commission_notes || "",
          showing_instructions: data.showing_instructions || "",
          lockbox_code: data.lockbox_code || "",
          appointment_required: data.appointment_required || false,
          showing_contact_name: data.showing_contact_name || "",
          showing_contact_phone: data.showing_contact_phone || "",
          additional_notes: data.additional_notes || "",
          annual_property_tax: data.annual_property_tax?.toString() || "",
          tax_assessment_value: data.tax_assessment_value?.toString() || "",
          tax_year: data.tax_year?.toString() || "",
          lot_size: data.lot_size?.toString() || "",
          year_built: data.year_built?.toString() || "",
          num_fireplaces: data.num_fireplaces?.toString() || "",
        });
        setDisclosures(Array.isArray(data.disclosures) ? data.disclosures as string[] : []);
        setPropertyFeatures(Array.isArray(data.property_features) ? data.property_features as string[] : []);
        setAmenities(Array.isArray(data.amenities) ? data.amenities as string[] : []);
        
        // Extract unit number from condo_details if available
        if (data.property_type === "Condominium" && data.condo_details) {
          try {
            const condoDetails = typeof data.condo_details === 'string' 
              ? JSON.parse(data.condo_details) 
              : data.condo_details;
            if (condoDetails?.unit_number) {
              setUnitNumber(condoDetails.unit_number);
            }
            if (condoDetails?.hoa_fee) {
              setHoaFee(condoDetails.hoa_fee.toString());
            }
            if (condoDetails?.hoa_fee_frequency) {
              setHoaFeeFrequency(condoDetails.hoa_fee_frequency);
            }
          } catch (e) {
            console.error("Error parsing condo_details:", e);
          }
        }

        // Parse comprehensive fields from disclosures array
        const disclosuresArray = Array.isArray(data.disclosures) ? data.disclosures as string[] : [];
        disclosuresArray.forEach((d: string) => {
          if (d.startsWith('Residential Exemption:')) setResidentialExemption(d.replace('Residential Exemption: ', ''));
          if (d.startsWith('Floors:')) setFloors(d.replace('Floors: ', ''));
          if (d.startsWith('Basement Type:')) setBasementType(d.replace('Basement Type: ', ''));
          if (d.startsWith('Basement Features:')) setBasementFeatures(d.replace('Basement Features: ', '').split(', '));
          if (d.startsWith('Basement Floor Type:')) setBasementFloorType(d.replace('Basement Floor Type: ', '').split(', '));
          if (d.startsWith('Lead Paint:')) setLeadPaint(d.replace('Lead Paint: ', ''));
          if (d.startsWith('Handicap Access:')) setHandicapAccess(d.replace('Handicap Access: ', ''));
          if (d.startsWith('Foundation:')) setFoundation(d.replace('Foundation: ', '').split(', '));
          if (d.startsWith('Parking Comments:')) setParkingComments(d.replace('Parking Comments: ', ''));
          if (d.startsWith('Parking Features:')) setParkingFeatures(d.replace('Parking Features: ', '').split(', '));
          if (d.startsWith('Garage Comments:')) setGarageComments(d.replace('Garage Comments: ', ''));
          if (d.startsWith('Garage Features:')) setGarageFeatures(d.replace('Garage Features: ', '').split(', '));
          if (d.startsWith('Lot Size Source:')) setLotSizeSource(d.replace('Lot Size Source: ', ''));
          if (d.startsWith('Lot Description:')) setLotDescription(d.replace('Lot Description: ', '').split(', '));
          if (d.startsWith('Seller Disclosure:')) setSellerDisclosure(d.replace('Seller Disclosure: ', ''));
          if (d.startsWith('Disclosures:')) setDisclosuresText(d.replace('Disclosures: ', ''));
          if (d.startsWith('Exclusions:')) setExclusions(d.replace('Exclusions: ', ''));
        });
        
        // Load parking and garage spaces from total_parking_spaces and garage_spaces
        if (data.total_parking_spaces) {
          setParkingSpaces(data.total_parking_spaces.toString());
        }
        if (data.garage_spaces) {
          setGarageSpaces(data.garage_spaces.toString());
        }
        
        // Load existing photos, floor plans, and documents
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          const existingPhotos: FileWithPreview[] = data.photos.map((photo: any, index: number) => ({
            file: null as any, // No file object for existing photos
            preview: photo.url,
            id: `existing-${index}`,
            uploaded: true,
            url: photo.url
          }));
          setPhotos(existingPhotos);
        }
        
        if (Array.isArray(data.floor_plans) && data.floor_plans.length > 0) {
          const existingFloorPlans: FileWithPreview[] = data.floor_plans.map((plan: any, index: number) => ({
            file: null as any,
            preview: plan.url,
            id: `existing-fp-${index}`,
            uploaded: true,
            url: plan.url,
            name: plan.name || plan.url.split('/').pop() || 'floor-plan'
          } as any));
          setFloorPlans(existingFloorPlans);
        }
        
        if (Array.isArray(data.documents) && data.documents.length > 0) {
          const existingDocuments: FileWithPreview[] = data.documents.map((doc: any, index: number) => ({
            file: null as any,
            preview: '',
            id: `existing-doc-${index}`,
            uploaded: true,
            url: doc.url,
            name: doc.name || doc.url.split('/').pop() || 'document'
          } as any));
          setDocuments(existingDocuments);
        }
        
        // Parse broker comments from additional_notes
        if (data.additional_notes?.includes('Broker Comments:')) {
          const parts = data.additional_notes.split('Broker Comments:');
          setBrokerComments(parts[1]?.trim() || '');
        }
      }
    } catch (error: any) {
      toast.error("Error loading listing: " + error.message);
      navigate("/agent-dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = async (place: google.maps.places.PlaceResult) => {
    console.log("=== handleAddressSelect called ===", place);
    addressSelectedRef.current = true;
    const addressComponents = place.address_components || [];
    const getComponent = (type: string) => {
      const component = addressComponents.find((c) => c.types.includes(type));
      return component?.long_name || component?.short_name || "";
    };

    const fullStreetLine = place.formatted_address?.split(",")[0] || "";
    const streetNumber = getComponent("street_number");
    const route = getComponent("route");
    const composedStreetLine = (streetNumber && route) ? `${streetNumber} ${route}` : fullStreetLine;
    const city = getComponent("locality") || getComponent("sublocality") || getComponent("sublocality_level_1") || getComponent("postal_town");
    const state = getComponent("administrative_area_level_1");
    const zip_code = getComponent("postal_code");
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    // Neighborhood/Area extraction
    const neighborhoodCandidate = getComponent("neighborhood") || getComponent("sublocality") || getComponent("sublocality_level_1");
    let neighborhood = "";
    try {
      const availableAreas = getAreasForCity(city, state);
      if (neighborhoodCandidate && availableAreas.includes(neighborhoodCandidate)) {
        neighborhood = neighborhoodCandidate;
      }
    } catch (e) {
      console.warn("Neighborhood lookup failed", e);
    }

    console.log("=== Address components extracted ===", { address: composedStreetLine, city, state, zip_code, lat, lng, neighborhoodCandidate, neighborhood });

    // Validate that we have all required components
    const missingFields: string[] = [];
    if (!city) missingFields.push("city");
    if (!state) missingFields.push("state");
    if (!zip_code) missingFields.push("zip code");

    if (missingFields.length > 0) {
      console.warn("Missing components from selected place:", missingFields);
      toast(
        `Unable to auto-populate ${missingFields.join(", ")}. Click "Enter manually" to fill missing fields.`,
        { duration: 6000 }
      );
      // Open manual dialog since autocomplete couldn't get all components
      setManualAddressDialogOpen(true);
      return;
    }

    // Compose final street and extract unit number if present
    const { street, unit } = extractUnitFromAddress(composedStreetLine);

    // Update form with parsed address components (only street in address field)
    setFormData((prev) => ({
      ...prev,
      address: street,
      city,
      state,
      zip_code,
      neighborhood: neighborhood || prev.neighborhood,
    }));

    // Update unit number if extracted and not already set
    if (unit && !unitNumber) {
      setUnitNumber(unit);
    }

    toast.success("Address selected successfully");
    setIsDirty(true);

    // Fetch ATTOM property data
    if (lat && lng) {
      try {
        console.log("[EditListing] Fetching property data from ATTOM...");
        const { data, error } = await supabase.functions.invoke("fetch-property-data", {
          body: { 
            latitude: lat, 
            longitude: lng, 
            address: street, 
            city, 
            state, 
            zip_code: zip_code,
            unit_number: unitNumber,
            property_type: formData.property_type
          },
        });

        if (error) {
          console.error("[EditListing] ATTOM fetch error:", error);
        } else if (data?.attom) {
          console.log("[EditListing] ATTOM data received:", data.attom);
          
          // Auto-fill property details from ATTOM
          setFormData((prev) => ({
            ...prev,
            bedrooms: data.attom.bedrooms?.toString() || prev.bedrooms,
            bathrooms: data.attom.bathrooms?.toString() || prev.bathrooms,
            square_feet: data.attom.square_feet?.toString() || prev.square_feet,
            lot_size: data.attom.lot_size ? Math.round(Number(data.attom.lot_size)).toString() : prev.lot_size,
            year_built: data.attom.year_built?.toString() || prev.year_built,
            property_type: data.attom.property_type || prev.property_type,
            annual_property_tax: data.attom.annual_property_tax?.toString() || prev.annual_property_tax,
            tax_year: data.attom.tax_year?.toString() || prev.tax_year,
            tax_assessment_value: data.attom.tax_assessment_value?.toString() || prev.tax_assessment_value,
          }));
          
          toast.success("Property details auto-filled from ATTOM data");
        }
      } catch (err) {
        console.error("[EditListing] Error fetching ATTOM data:", err);
      }
    }
  };

  // Helper to update form data and mark as dirty
  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate unit number for Condominium and Townhouse
    if ((formData.property_type === "Condominium" || formData.property_type === "Townhouse") && !unitNumber.trim()) {
      toast.error("Unit number is required for condominium and townhouse properties");
      return;
    }

    setSubmitting(true);

    try {
      // Upload new photos, floor plans, and documents
      const uploadedPhotos: any[] = [];
      const uploadedFloorPlans: any[] = [];
      const uploadedDocuments: any[] = [];
      
      // Upload new photos (not already uploaded)
      for (const photo of photos) {
        if (!photo.uploaded && photo.file) {
          const filePath = `${id}/${Date.now()}_${photo.file.name}`;
          const { error } = await supabase.storage
            .from('listing-photos')
            .upload(filePath, photo.file);
          
          if (!error) {
            const { data: { publicUrl } } = supabase.storage
              .from('listing-photos')
              .getPublicUrl(filePath);
            uploadedPhotos.push({ url: publicUrl, name: photo.file.name });
          }
        } else if (photo.uploaded && photo.url) {
          // Keep existing photos
          uploadedPhotos.push({ url: photo.url, name: '' });
        }
      }
      
      // Upload new floor plans
      for (const plan of floorPlans) {
        if (!plan.uploaded && plan.file) {
          const filePath = `${id}/${Date.now()}_${plan.file.name}`;
          const { error } = await supabase.storage
            .from('listing-floorplans')
            .upload(filePath, plan.file);
          
          if (!error) {
            const { data: { publicUrl } } = supabase.storage
              .from('listing-floorplans')
              .getPublicUrl(filePath);
            uploadedFloorPlans.push({ url: publicUrl, name: plan.file.name });
          }
        } else if (plan.uploaded && plan.url) {
          // Keep existing floor plans with their names
          const fileName = (plan as any).name || plan.url.split('/').pop() || 'floor-plan';
          uploadedFloorPlans.push({ url: plan.url, name: fileName });
        }
      }
      
      // Upload new documents
      for (const doc of documents) {
        if (!doc.uploaded && doc.file) {
          const filePath = `${id}/${Date.now()}_${doc.file.name}`;
          const { error } = await supabase.storage
            .from('listing-documents')
            .upload(filePath, doc.file);
          
          if (!error) {
            const { data: { publicUrl } } = supabase.storage
              .from('listing-documents')
              .getPublicUrl(filePath);
            uploadedDocuments.push({ url: publicUrl, name: doc.file.name });
          }
        } else if (doc.uploaded && doc.url) {
          // Keep existing documents with their names
          const fileName = (doc as any).name || doc.url.split('/').pop() || 'document';
          uploadedDocuments.push({ url: doc.url, name: fileName });
        }
      }

      // Build updated disclosures array
      const updatedDisclosures = [...disclosures];
      
      if (residentialExemption) updatedDisclosures.push(`Residential Exemption: ${residentialExemption}`);
      if (floors) updatedDisclosures.push(`Floors: ${floors}`);
      if (basementType) updatedDisclosures.push(`Basement Type: ${basementType}`);
      if (basementFeatures.length > 0) updatedDisclosures.push(`Basement Features: ${basementFeatures.join(', ')}`);
      if (basementFloorType.length > 0) updatedDisclosures.push(`Basement Floor Type: ${basementFloorType.join(', ')}`);
      if (leadPaint) updatedDisclosures.push(`Lead Paint: ${leadPaint}`);
      if (handicapAccess) updatedDisclosures.push(`Handicap Access: ${handicapAccess}`);
      if (foundation.length > 0) updatedDisclosures.push(`Foundation: ${foundation.join(', ')}`);
      if (parkingComments) updatedDisclosures.push(`Parking Comments: ${parkingComments}`);
      if (parkingFeatures.length > 0) updatedDisclosures.push(`Parking Features: ${parkingFeatures.join(', ')}`);
      if (garageComments) updatedDisclosures.push(`Garage Comments: ${garageComments}`);
      if (garageFeatures.length > 0) updatedDisclosures.push(`Garage Features: ${garageFeatures.join(', ')}`);
      if (lotSizeSource) updatedDisclosures.push(`Lot Size Source: ${lotSizeSource}`);
      if (lotDescription.length > 0) updatedDisclosures.push(`Lot Description: ${lotDescription.join(', ')}`);
      if (sellerDisclosure) updatedDisclosures.push(`Seller Disclosure: ${sellerDisclosure}`);
      if (disclosuresText) updatedDisclosures.push(`Disclosures: ${disclosuresText}`);
      if (exclusions) updatedDisclosures.push(`Exclusions: ${exclusions}`);

      // Build additional notes with broker comments
      let additionalNotes = formData.additional_notes;
      if (brokerComments) {
        additionalNotes += `\n\nBroker Comments: ${brokerComments}`;
      }

      const dataToUpdate: any = {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        neighborhood: formData.neighborhood || null,
        property_type: formData.property_type || null,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        lot_size: formData.lot_size ? parseFloat(formData.lot_size) : null,
        year_built: formData.year_built ? parseInt(formData.year_built) : null,
        description: formData.description || null,
        status: formData.status,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        commission_type: formData.commission_type,
        commission_notes: formData.commission_notes || null,
        showing_instructions: formData.showing_instructions || null,
        lockbox_code: formData.lockbox_code || null,
        appointment_required: formData.appointment_required,
        showing_contact_name: formData.showing_contact_name || null,
        showing_contact_phone: formData.showing_contact_phone || null,
        disclosures: updatedDisclosures,
        property_features: propertyFeatures,
        amenities: amenities,
        additional_notes: additionalNotes || null,
        annual_property_tax: formData.annual_property_tax ? parseFloat(formData.annual_property_tax) : null,
        tax_assessment_value: formData.tax_assessment_value ? parseFloat(formData.tax_assessment_value) : null,
        tax_year: formData.tax_year ? parseInt(formData.tax_year) : null,
        num_fireplaces: formData.num_fireplaces ? parseInt(formData.num_fireplaces) : null,
        total_parking_spaces: parkingSpaces ? parseInt(parkingSpaces) : null,
        garage_spaces: garageSpaces ? parseInt(garageSpaces) : null,
        photos: uploadedPhotos,
        floor_plans: uploadedFloorPlans,
        documents: uploadedDocuments,
      };

      // Update condo_details if it's a condominium
      if (formData.property_type?.includes("Condo") && unitNumber) {
        // Fetch existing condo_details first
        const { data: existingData } = await supabase
          .from("listings")
          .select("condo_details")
          .eq("id", id)
          .single();
        
        const existingCondoDetails = existingData?.condo_details 
          ? (typeof existingData.condo_details === 'string' 
            ? JSON.parse(existingData.condo_details) 
            : existingData.condo_details)
          : {};
        
        dataToUpdate.condo_details = {
          ...existingCondoDetails,
          unit_number: unitNumber,
          hoa_fee: hoaFee ? parseFloat(hoaFee) : null,
          hoa_fee_frequency: hoaFeeFrequency,
        };
      }

      const validatedCore = listingSchema.parse(dataToUpdate);
      // Merge validated core fields back with extended fields (photos, floor plans, documents, etc.)
      const payload = { ...dataToUpdate, ...validatedCore };

      const { error } = await supabase
        .from("listings")
        .update(payload)
        .eq("id", id);

      if (error) throw error;

      // Clear draft after successful save
      if (id) {
        localStorage.removeItem(`listing_draft_${id}`);
      }

      setIsDirty(false); // Reset dirty state after successful save
      toast.success("Listing updated successfully!");
      navigate("/agent-dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error updating listing: " + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Listing Type & Property Type */}
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* Price & Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>

              {/* Additional Sections */}
              <div className="border-t pt-4 space-y-4">
                <Skeleton className="h-6 w-40" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      
      {/* Auto-save indicator */}
      {lastAutoSave && (
        <div className="fixed bottom-4 right-4 z-50 bg-muted/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-border flex items-center gap-2 text-sm text-muted-foreground">
          <Cloud className="h-4 w-4" />
          <span>Draft saved {new Date().getTime() - lastAutoSave.getTime() < 60000 ? 'just now' : `at ${lastAutoSave.toLocaleTimeString()}`}</span>
        </div>
      )}
      
      {/* Manual Address Entry Dialog */}
      <Dialog open={manualAddressDialogOpen} onOpenChange={setManualAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Address Manually</DialogTitle>
            <DialogDescription>
              Fill in the address details manually if autocomplete doesn't find your property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manual-address">Street Address *</Label>
                <Input
                  id="manual-address"
                  placeholder="123 Main Street"
                  value={formData.address}
                  onChange={(e) => updateFormData({ address: e.target.value })}
                  onBlur={handleBlur}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-city">City *</Label>
                <Input
                  id="manual-city"
                  placeholder="Boston"
                  value={formData.city}
                  onChange={(e) => updateFormData({ city: e.target.value })}
                  onBlur={handleBlur}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-state">State *</Label>
                <Input
                  id="manual-state"
                  placeholder="MA"
                  value={formData.state}
                  onChange={(e) => updateFormData({ state: e.target.value })}
                  onBlur={handleBlur}
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-zip">ZIP Code *</Label>
              <Input
                id="manual-zip"
                placeholder="02101"
                value={formData.zip_code}
                onChange={(e) => updateFormData({ zip_code: e.target.value })}
                onBlur={handleBlur}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-neighborhood">Neighborhood (Optional)</Label>
              <Select
                value={formData.neighborhood}
                onValueChange={(value) => updateFormData({ neighborhood: value })}
              >
                <SelectTrigger id="manual-neighborhood">
                  <SelectValue placeholder="Select neighborhood" />
                </SelectTrigger>
                <SelectContent>
                  {getAreasForCity(formData.city, formData.state).length > 0 ? (
                    getAreasForCity(formData.city, formData.state).map((neighborhood) => (
                      <SelectItem key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No neighborhoods available for this city
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualAddressDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (formData.address && formData.city && formData.state && formData.zip_code) {
                  setManualAddressDialogOpen(false);
                  toast.success("Address entered manually");
                } else {
                  toast.error("Please fill in all address fields");
                }
              }}
            >
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <Card>
          <CardHeader>
            <CardTitle>Edit Listing</CardTitle>
            <CardDescription>Update your property listing details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
              {/* Listing Type */}
              <div className="space-y-2">
                <Label htmlFor="listing_type">Listing Type</Label>
                <Select
                  value={formData.listing_type}
                  onValueChange={(value) => updateFormData({ listing_type: value })}
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

              {/* Property Type */}
              <div className="space-y-2">
                <Label htmlFor="property_type">Property Type</Label>
                <Select
                  value={formData.property_type}
                  onValueChange={(value) => updateFormData({ property_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single Family">Single Family</SelectItem>
                    <SelectItem value="Condominium">Condominium</SelectItem>
                    <SelectItem value="Townhouse">Townhouse</SelectItem>
                    <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                    <SelectItem value="Land">Land</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Mobile Home">Mobile Home</SelectItem>
                    <SelectItem value="Co-op">Co-op</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => updateFormData({ status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="address">Address</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setManualAddressDialogOpen(true)}
                      disabled={!!(formData.city && formData.state && formData.zip_code)}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Enter manually
                    </Button>
                  </div>
                  <AddressAutocomplete
                    onPlaceSelect={handleAddressSelect}
                    placeholder="Enter property address"
                    value={formData.address}
                     onChange={(val) => {
                       if (addressSelectedRef.current) return;
                       updateFormData({ address: val });
                     }}
                  />
                  {!(formData.city && formData.state && formData.zip_code) && (
                    <p className="text-xs text-muted-foreground">
                      Can't find your address? Click "Enter manually" above
                    </p>
                  )}
                  {formData.city && formData.state && formData.zip_code && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-success"></span>
                      Address verified
                    </p>
                  )}
                </div>

                {/* Unit Number - for properties with units */}
                {(formData.property_type?.includes("Condo") || 
                  formData.property_type?.includes("Townhouse") || 
                  formData.property_type?.includes("Multi") || 
                  formData.property_type?.includes("Rental") ||
                  formData.listing_type === "for_rent") && (
                  <div className="space-y-2 w-28 self-end">
                    <Label htmlFor="unit_number" className="sr-only">
                      Unit #
                    </Label>
                    <Input
                      id="unit_number"
                      value={unitNumber}
                      onChange={(e) => { setUnitNumber(e.target.value); setIsDirty(true); }}
                      placeholder="Unit #"
                      required={formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse")}
                    />
                  </div>
                )}
              </div>

              {/* Only show city/state/zip fields if they're empty (manual entry mode) */}
              {!(formData.city && formData.state && formData.zip_code) && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateFormData({ city: e.target.value })}
                        onBlur={handleBlur}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => updateFormData({ state: e.target.value })}
                        onBlur={handleBlur}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zip_code">Zip Code</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => updateFormData({ zip_code: e.target.value })}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </>
              )}

              {/* Neighborhood */}
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Area/Neighborhood</Label>
                <Select
                  value={formData.neighborhood}
                  onValueChange={(value) => updateFormData({ neighborhood: value })}
                  disabled={!formData.city || !formData.state || getAreasForCity(formData.city, formData.state).length === 0}
                >
                  <SelectTrigger id="neighborhood">
                    <SelectValue placeholder="Select neighborhood" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAreasForCity(formData.city, formData.state).map((neighborhood) => (
                      <SelectItem key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


            {/* HOA/Condo Fee - for condos and townhouses */}
            {(formData.property_type?.includes("Condo") || formData.property_type?.includes("Townhouse")) && (
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hoa_fee">HOA/Condo Fee</Label>
                    <FormattedInput
                      id="hoa_fee"
                      format="currency"
                      decimals={0}
                      value={hoaFee}
                      onChange={(value) => { setHoaFee(value); setIsDirty(true); }}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoa_fee_frequency">Fee Frequency</Label>
                    <Select value={hoaFeeFrequency} onValueChange={(val) => { setHoaFeeFrequency(val); setIsDirty(true); }}>
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
              )}

              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <FormattedInput
                  id="price"
                  format="currency"
                  value={formData.price}
                  onChange={(value) => setFormData(prev => ({ ...prev, price: value }))}
                  onBlur={handleBlur}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                    onBlur={handleBlur}
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
                    onBlur={handleBlur}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="square_feet">Square Feet</Label>
                  <FormattedInput
                    id="square_feet"
                    format="number"
                    value={formData.square_feet}
                    onChange={(value) => setFormData(prev => ({ ...prev, square_feet: value }))}
                    onBlur={handleBlur}
                  />
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  onBlur={handleBlur}
                  rows={4}
                  placeholder="Describe the property..."
                />
              </div>

              {/* Unit Features */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Unit Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="floors">Number of Floors</Label>
                    <Input
                      id="floors"
                      value={floors}
                      onChange={(e) => setFloors(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="num_fireplaces">Fireplaces</Label>
                    <Input
                      id="num_fireplaces"
                      type="number"
                      value={formData.num_fireplaces}
                      onChange={(e) => setFormData(prev => ({ ...prev, num_fireplaces: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Property Tax */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Property Tax</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="annual_property_tax">Annual Property Tax</Label>
                    <FormattedInput
                      id="annual_property_tax"
                      format="currency"
                      value={formData.annual_property_tax}
                      onChange={(value) => setFormData(prev => ({ ...prev, annual_property_tax: value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_assessment_value">Assessed Value</Label>
                    <FormattedInput
                      id="tax_assessment_value"
                      format="currency"
                      value={formData.tax_assessment_value}
                      onChange={(value) => setFormData(prev => ({ ...prev, tax_assessment_value: value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_year">Fiscal Year</Label>
                    <Input
                      id="tax_year"
                      type="number"
                      value={formData.tax_year}
                      onChange={(e) => setFormData(prev => ({ ...prev, tax_year: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentialExemption">Residential Exemption</Label>
                  <Select value={residentialExemption} onValueChange={setResidentialExemption}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="year_built">Year Built</Label>
                    <Input
                      id="year_built"
                      type="number"
                      value={formData.year_built}
                      onChange={(e) => setFormData(prev => ({ ...prev, year_built: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Basement Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Basement Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="basementType">Basement Type</Label>
                  <Select value={basementType} onValueChange={setBasementType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select basement type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Crawl Space">Crawl Space</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Basement Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Finished', 'Unfinished', 'Partially Finished', 'Walk-Out', 'Interior Access', 'Exterior Access'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`basement-${feature}`}
                          checked={basementFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBasementFeatures([...basementFeatures, feature]);
                            } else {
                              setBasementFeatures(basementFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`basement-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Basement Floor Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Concrete', 'Tile', 'Carpet', 'Wood', 'Other'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`floor-${type}`}
                          checked={basementFloorType.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBasementFloorType([...basementFloorType, type]);
                            } else {
                              setBasementFloorType(basementFloorType.filter(t => t !== type));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`floor-${type}`} className="font-normal cursor-pointer text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Foundation & Building Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Foundation & Building Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leadPaint">Lead Paint</Label>
                    <Select value={leadPaint} onValueChange={setLeadPaint}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handicapAccess">Handicap Access</Label>
                    <Select value={handicapAccess} onValueChange={setHandicapAccess}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Foundation</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Poured Concrete', 'Block', 'Stone', 'Brick', 'Wood', 'Other'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`foundation-${type}`}
                          checked={foundation.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFoundation([...foundation, type]);
                            } else {
                              setFoundation(foundation.filter(f => f !== type));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`foundation-${type}`} className="font-normal cursor-pointer text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Parking & Garage */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Parking & Garage</h3>
                <div className="space-y-2">
                  <Label htmlFor="parkingSpaces">Parking #</Label>
                  <Input
                    id="parkingSpaces"
                    type="number"
                    value={parkingSpaces}
                    onChange={(e) => setParkingSpaces(e.target.value)}
                    placeholder="Number of parking spaces"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parking Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Driveway', 'Off-Street', 'On Street Permit', 'Assigned', 'Covered', 'Uncovered', 'Garage Attached', 'Garage Detached'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`parking-${feature}`}
                          checked={parkingFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setParkingFeatures([...parkingFeatures, feature]);
                            } else {
                              setParkingFeatures(parkingFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`parking-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parkingComments">Parking Comments</Label>
                  <Input
                    id="parkingComments"
                    value={parkingComments}
                    onChange={(e) => setParkingComments(e.target.value)}
                    placeholder="Additional parking information..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garageSpaces">Garage #</Label>
                  <Input
                    id="garageSpaces"
                    type="number"
                    value={garageSpaces}
                    onChange={(e) => setGarageSpaces(e.target.value)}
                    placeholder="Number of garage spaces"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Garage Features</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Heated', 'Electric Door Opener', 'Workshop', 'Finished Interior', 'Storage', 'Insulated'].map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`garage-${feature}`}
                          checked={garageFeatures.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGarageFeatures([...garageFeatures, feature]);
                            } else {
                              setGarageFeatures(garageFeatures.filter(f => f !== feature));
                            }
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`garage-${feature}`} className="font-normal cursor-pointer text-sm">
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garageComments">Garage Comments</Label>
                  <Input
                    id="garageComments"
                    value={garageComments}
                    onChange={(e) => setGarageComments(e.target.value)}
                    placeholder="Additional garage information..."
                  />
                </div>
              </div>

              {/* Lot Information */}
              {!(formData.property_type?.toLowerCase().includes("condo")) && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Lot Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="lotSizeSource">Lot Size Source</Label>
                    <Input
                      id="lotSizeSource"
                      value={lotSizeSource}
                      onChange={(e) => setLotSizeSource(e.target.value)}
                      placeholder="e.g., Assessor, Survey, Public Records"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lot Description</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Corner Lot', 'Cul-de-sac', 'Level', 'Sloped', 'Wooded', 'Cleared', 'Fenced', 'Landscaped'].map((desc) => (
                        <div key={desc} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`lot-${desc}`}
                            checked={lotDescription.includes(desc)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLotDescription([...lotDescription, desc]);
                              } else {
                                setLotDescription(lotDescription.filter(d => d !== desc));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`lot-${desc}`} className="font-normal cursor-pointer text-sm">
                            {desc}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Disclosures & Legal */}
              <div className="space-y-4 border-t pt-4">
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
                  <Label htmlFor="disclosuresText">Additional Disclosures</Label>
                  <Textarea
                    id="disclosuresText"
                    value={disclosuresText}
                    onChange={(e) => setDisclosuresText(e.target.value)}
                    rows={3}
                    placeholder="Any additional disclosures about the property..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exclusions">Exclusions</Label>
                  <Textarea
                    id="exclusions"
                    value={exclusions}
                    onChange={(e) => setExclusions(e.target.value)}
                    rows={3}
                    placeholder="Items not included in the sale..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brokerComments">Broker Comments</Label>
                  <Textarea
                    id="brokerComments"
                    value={brokerComments}
                    onChange={(e) => setBrokerComments(e.target.value)}
                    rows={3}
                    placeholder="Comments for other agents..."
                  />
                </div>
              </div>

              {/* Commission Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Commission Information</h3>
                <div className="grid grid-cols-2 gap-4">
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
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="commission_rate"
                          type="number"
                          step="0.01"
                          value={formData.commission_rate}
                          onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: e.target.value }))}
                          placeholder="5000"
                          className="pl-6"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_notes">Commission Notes</Label>
                  <Input
                    id="commission_notes"
                    name="notes_listing_commission"
                    value={formData.commission_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, commission_notes: e.target.value }))}
                    autoComplete="off"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    role="presentation"
                  />
                </div>
              </div>

              {/* Photos & Media */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Property Photos</h3>
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

              {/* Floor Plans & Documents */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Floor Plans & Documents</h3>
                
                {/* Floor Plans Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Floor Plans ({floorPlans.length})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('floor-plans-input')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Floor Plans
                    </Button>
                    <input
                      id="floor-plans-input"
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const newFiles: FileWithPreview[] = Array.from(files).map(file => ({
                          file,
                          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
                          id: Math.random().toString(36).slice(2),
                        }));
                        setFloorPlans(prev => [...prev, ...newFiles]);
                        setIsDirty(true);
                        toast.success(`${files.length} floor plan(s) added`);
                      }}
                    />
                  </div>
                  
                  {floorPlans.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {floorPlans.map((plan) => (
                        <div key={plan.id} className="relative border rounded-lg p-2 group">
                          {plan.preview ? (
                            <img src={plan.preview} alt="Floor plan" className="w-full h-24 object-cover rounded" />
                          ) : (
                            <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setFloorPlans(prev => prev.filter(p => p.id !== plan.id));
                              setIsDirty(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {plan.file?.name || (plan as any).name || 'Existing file'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Documents ({documents.length})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('documents-input')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Documents
                    </Button>
                    <input
                      id="documents-input"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const newFiles: FileWithPreview[] = Array.from(files).map(file => ({
                          file,
                          preview: '',
                          id: Math.random().toString(36).slice(2),
                        }));
                        setDocuments(prev => [...prev, ...newFiles]);
                        setIsDirty(true);
                        toast.success(`${files.length} document(s) added`);
                      }}
                    />
                  </div>
                  
                  {documents.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3 group hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[200px]">
                              {doc.file?.name || (doc as any).name || 'Existing document'}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setDocuments(prev => prev.filter(d => d.id !== doc.id));
                              setIsDirty(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Showing Instructions */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Showing Instructions</h3>
                <div className="space-y-2">
                  <Label htmlFor="showing_instructions">Instructions</Label>
                  <Textarea
                    id="showing_instructions"
                    value={formData.showing_instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, showing_instructions: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lockbox_code">Lockbox Code</Label>
                    <Input
                      id="lockbox_code"
                      name="lockbox_one_time_code"
                      type="text"
                      placeholder="Enter lockbox code"
                      value={formData.lockbox_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, lockbox_code: e.target.value }))}
                      autoComplete="off"
                      inputMode="numeric"
                      pattern="^[0-9]*$"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      aria-autocomplete="none"
                      role="presentation"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <input
                      type="checkbox"
                      id="appointment_required"
                      checked={formData.appointment_required}
                      onChange={(e) => setFormData(prev => ({ ...prev, appointment_required: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="appointment_required" className="font-normal cursor-pointer">
                      Appointment required
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="showing_contact_name">Contact Name</Label>
                    <Input
                      id="showing_contact_name"
                      value={formData.showing_contact_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, showing_contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="showing_contact_phone">Contact Phone</Label>
                    <FormattedInput
                      id="showing_contact_phone"
                      type="tel"
                      value={formData.showing_contact_phone}
                      onChange={(value) => setFormData(prev => ({ ...prev, showing_contact_phone: value }))}
                      format="phone"
                      placeholder="1234567890"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Updating..." : "Update Listing"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/agent-dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditListing;
