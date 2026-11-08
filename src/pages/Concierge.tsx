import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { normalizeGooglePlace } from "@/lib/google-address";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Seo } from "@/components/Seo";
import Footer from "@/components/Footer";
import { useAuthRole } from "@/hooks/useAuthRole";
import { supabase } from "@/integrations/supabase/client";
import { COMMS_CHANNELS } from "@/lib/commsChannels";
import type { CommsChannelKey } from "@/lib/commsChannelPrefs";

type RequestType = "listing" | "broadcast";
type PropertyType = "single_family" | "condo" | "townhouse" | "multi_family";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PHOTO_BUCKET = "concierge-request-photos";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

type PhotoPreview = { file: File; src: string };

/** Private local photo previews, released on replacement/unmount. */
function usePhotoPreviews(files: File[]): PhotoPreview[] {
  const previews = useMemo(
    () => files.map((file) => ({ file, src: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.src)), [previews]);
  return previews;
}

/**
 * Stable Facebook deep link: /concierge.
 * A listing request is NOT a network email and never creates a published listing.
 * Submission is limited by RLS to verified/activated agents. Staff may preview.
 */
export default function Concierge() {
  const { user, role, loading, isVerifiedAgent } = useAuthRole();
  const [requestType, setRequestType] = useState<RequestType>("listing");
  const [communicationChannel, setCommunicationChannel] = useState<CommsChannelKey | "">("");
  const [subject, setSubject] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<{ street: string; city: string; state: string; zip: string } | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType>("single_family");
  const [askingPrice, setAskingPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [lotAcres, setLotAcres] = useState("");
  const [condoFee, setCondoFee] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [parkingType, setParkingType] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [uploadWarning, setUploadWarning] = useState("");
  const photoPreviews = usePhotoPreviews(photoFiles);

  const canSubmit = Boolean(user && role === "agent" && isVerifiedAgent);
  const adminPreview = Boolean(user && role === "admin");

  function onPhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    const invalid = selected.find((file) => !ALLOWED_PHOTO_TYPES[file.type] || file.size > MAX_PHOTO_BYTES);
    if (invalid) {
      toast.error("Photos must be JPG, PNG or WebP, each no larger than 10 MB.");
      return;
    }
    if (photoFiles.length + selected.length > MAX_PHOTOS) {
      toast.error("You can upload up to 10 listing photos.");
      return;
    }
    setPhotoFiles((current) => [...current, ...selected]);
  }

  function resetForm() {
    setRequestType("listing");
    setCommunicationChannel("");
    setSubject("");
    setPropertyAddress("");
    setSelectedAddress(null);
    setPropertyType("single_family");
    setAskingPrice("");
    setBedrooms("");
    setBathrooms("");
    setSquareFeet("");
    setLotAcres("");
    setCondoFee("");
    setParkingSpaces("");
    setParkingType("");
    setPhotoFiles([]);
    setDetails("");
    setReferenceUrl("");
    setUploadWarning("");
    setSubmitted(false);
    setConfirmationOpen(false);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Admin test mode is strictly client-side: no DB writes, uploads or emails.
    const isAdminTest = adminPreview && !canSubmit;
    if (!user || (!canSubmit && !isAdminTest) || submitting) return;

    const isListing = requestType === "listing";
    const address = propertyAddress.trim();
    const numericPrice = Number(askingPrice);
    const numericBedrooms = Number(bedrooms);
    const numericBathrooms = Number(bathrooms);
    const numericSquareFeet = Number(squareFeet);
    const numericLotAcres = Number(lotAcres);
    const numericCondoFee = Number(condoFee);
    const numericParkingSpaces = Number(parkingSpaces);
    if (isListing) {
      if (!address || !askingPrice || !bedrooms || !bathrooms || !squareFeet ||
          !Number.isFinite(numericPrice) || numericPrice <= 0 ||
          !Number.isInteger(numericBedrooms) || numericBedrooms < 0 || numericBedrooms > 30 ||
          !Number.isFinite(numericBathrooms) || numericBathrooms < 0 || numericBathrooms > 30 ||
          !Number.isInteger(numericSquareFeet) || numericSquareFeet < 1 ||
          (propertyType === "single_family" &&
            (!lotAcres || !Number.isFinite(numericLotAcres) || numericLotAcres < 0)) ||
          (propertyType === "condo" && (
            (condoFee !== "" && (!Number.isFinite(numericCondoFee) || numericCondoFee < 0)) ||
            !parkingSpaces || !Number.isInteger(numericParkingSpaces) ||
            numericParkingSpaces < 0 || numericParkingSpaces > 100 || !parkingType
          ))) {
        toast.error("Complete the essential listing details before submitting.");
        return;
      }
    } else if (!communicationChannel || !subject.trim() || !details.trim()) {
      toast.error("Choose the channel and add the email subject and message.");
      return;
    }

    if (isAdminTest) {
      // View the same success popup without contacting the existing live backend.
      setUploadWarning("");
      setSubmitted(true);
      setConfirmationOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const requestBody = isListing
        ? {
            request_type: "listing",
            subject: address.slice(0, 160),
            property_address: address,
            address_street: selectedAddress?.street || null,
            address_city: selectedAddress?.city || null,
            address_state: selectedAddress?.state || null,
            address_zip: selectedAddress?.zip || null,
            property_type: propertyType,
            asking_price: numericPrice,
            bedrooms: numericBedrooms,
            bathrooms: numericBathrooms,
            square_feet: numericSquareFeet,
            lot_acres: propertyType === "single_family" ? numericLotAcres : null,
            condo_fee_monthly: propertyType === "condo" && condoFee !== "" ? numericCondoFee : null,
            parking_spaces: propertyType === "condo" ? numericParkingSpaces : null,
            parking_type: propertyType === "condo" ? parkingType : null,
            details: details.trim(),
          }
        : {
            request_type: "broadcast",
            communication_channel: communicationChannel,
            subject: subject.trim(),
            details: details.trim(),
            reference_url: referenceUrl.trim() || null,
          };

      const { data, error } = await (supabase as any)
        .from("agent_concierge_requests")
        .insert({ agent_id: user.id, ...requestBody })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("Unable to create request");

      // Photos are private, scoped to the newly created request, and never added
      // to the site's public listing-photo storage. No listing or email is created.
      let uploadedPaths: string[] = [];
      let failedCount = 0;
      if (isListing && photoFiles.length) {
        for (const file of photoFiles) {
          const extension = ALLOWED_PHOTO_TYPES[file.type];
          const path = `${user.id}/${data.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (uploadError) {
            failedCount += 1;
          } else {
            uploadedPaths.push(path);
          }
        }
        if (uploadedPaths.length) {
          const { error: pathsError } = await (supabase as any)
            .from("agent_concierge_requests")
            .update({ photo_paths: uploadedPaths })
            .eq("id", data.id)
            .eq("agent_id", user.id);
          if (pathsError) {
            // Avoid leaving successful but unlinked private uploads behind.
            await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
            failedCount = photoFiles.length;
            uploadedPaths = [];
          }
        }
      }

      setUploadWarning(
        failedCount > 0
          ? `Your request was saved, but ${failedCount} photo(s) could not be attached. Please contact AAC with the missing photos.`
          : "",
      );
      setSubmitted(true);
      setConfirmationOpen(true);
      if (failedCount) toast.warning("Request saved with a photo upload warning.");
      else toast.success("Your concierge request was received.");
    } catch {
      toast.error("We couldn't save your request. Nothing was sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Seo
        title="AAC Concierge Service | All Agent Connect"
        description="Need help preparing a shareable listing or agent network broadcast? AAC Concierge helps verified real estate agents."
        canonical="https://allagentconnect.com/concierge"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <Link to="/" className="text-sm font-semibold text-[#0E56F5] hover:underline">
          All Agent Connect
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          AAC Concierge Service
        </h1>
        <div className="mt-4 h-1 w-16 rounded bg-[#16A34A]" />
        <p className="mt-5 text-lg leading-8 text-zinc-700">
          Short on time? Submit the essentials and our team can help prepare your
          property listing or agent network broadcast.
        </p>
        <p className="mt-3 text-sm text-zinc-600">
          Requests are reviewed by AAC staff. Nothing is published or sent to the agent network automatically.
        </p>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-zinc-600">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking membership…
          </div>
        ) : !user ? (
          <section className="mt-10 rounded-xl border border-zinc-200 p-6">
            <h2 className="text-xl font-semibold">Already have an AAC account?</h2>
            <p className="mt-2 text-zinc-600">
              Sign in to return here and request concierge help.
              New agents can register for free and submit requests once verified.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild><Link to="/auth?returnTo=%2Fconcierge">Sign in</Link></Button>
              <Button asChild variant="outline"><Link to="/request-access">Register free</Link></Button>
            </div>
          </section>
        ) : !canSubmit && !adminPreview ? (
          <section className="mt-10 rounded-xl border border-zinc-200 p-6">
            <h2 className="text-xl font-semibold">Verified agent membership required</h2>
            <p className="mt-2 text-zinc-600">
              Concierge requests are available after your licensed agent account
              has been verified and activated.
            </p>
            <Button asChild className="mt-5"><Link to="/agent-dashboard">Back to AAC</Link></Button>
          </section>
        ) : submitted ? (
          <section aria-live="polite" className="mt-10 rounded-xl border border-zinc-200 p-7">
            <CheckCircle2 className="h-9 w-9 text-[#16A34A]" />
            <h2 className="mt-3 text-xl font-semibold">Your concierge request is in</h2>
            <p className="mt-2 text-zinc-600">
              {adminPreview
                ? "Admin test complete. No request was saved and no email was sent."
                : "Your request was submitted to AAC Concierge. Our team will review it and follow up. Nothing has been published or broadcast."}
            </p>
            {uploadWarning && (
              <p role="alert" className="mt-3 rounded-md border border-amber-300 p-3 text-sm text-zinc-800">
                {uploadWarning}
              </p>
            )}
            <Button variant="outline" className="mt-5" onClick={resetForm}>Send another request</Button>
          </section>
        ) : (
          <form onSubmit={submitRequest} className="mt-10 space-y-6 rounded-xl border border-zinc-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Request concierge help</h2>
            {adminPreview && (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                Admin test mode: complete the form and click Test Form to see the
                confirmation. Nothing will be saved, uploaded or emailed.
                <Link to="/admin/concierge-requests" className="ml-1 font-medium text-[#0E56F5] underline">
                  View staff requests
                </Link>.
              </p>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-zinc-800">What do you need help with?</legend>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="requestType" value="listing"
                    checked={requestType === "listing"} onChange={() => setRequestType("listing")} />
                  Property Listing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="requestType" value="broadcast"
                    checked={requestType === "broadcast"} onChange={() => setRequestType("broadcast")} />
                  Network Broadcast Email
                </label>
              </div>
            </fieldset>

            {requestType === "listing" ? (
              <section className="space-y-5">
                <p className="text-sm text-zinc-600">
                  Enter the property essentials and upload photos. Our team will use them
                  to prepare a listing for your review.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="concierge-address">Property address *</Label>
                  <AddressAutocomplete
                    value={propertyAddress}
                    onChange={(value) => { setPropertyAddress(value); setSelectedAddress(null); }}
                    onPlaceSelect={(place) => {
                      const a = normalizeGooglePlace(place);
                      const formatted = [a.address_line1 || a.formatted_address || "", a.city, [a.state, a.zip].filter(Boolean).join(" ")]
                        .filter(Boolean).join(", ").slice(0, 300);
                      setPropertyAddress(formatted);
                      setSelectedAddress(a.address_line1 && a.city && a.state && a.zip
                        ? { street: a.address_line1, city: a.city, state: a.state, zip: a.zip }
                        : null);
                    }}
                    placeholder="Start typing a street address…"
                  />
                  <p className="text-xs text-zinc-500">Choose a Google address suggestion or type the complete address manually.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concierge-type">Property type *</Label>
                  <select id="concierge-type" required value={propertyType}
                    onChange={(e) => { setPropertyType(e.target.value as PropertyType); setLotAcres(""); setCondoFee(""); setParkingSpaces(""); setParkingType(""); }}
                    className="flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900">
                    {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="concierge-price">Asking price ($) *</Label>
                    <FormattedInput id="concierge-price" inputMode="numeric" required
                      format="currency" value={askingPrice} onChange={setAskingPrice}
                      placeholder="$1,250,000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concierge-sqft">Square feet *</Label>
                    <FormattedInput id="concierge-sqft" inputMode="numeric" required
                      format="number" value={squareFeet} onChange={setSquareFeet}
                      placeholder="1,800" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concierge-beds">Beds *</Label>
                    <Input id="concierge-beds" type="number" min="0" max="30" step="1" required
                      value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
                      placeholder="3" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concierge-baths">Baths *</Label>
                    <Input id="concierge-baths" type="number" min="0" max="30" step="0.5" required
                      value={bathrooms} onChange={(e) => setBathrooms(e.target.value)}
                      placeholder="2.5" />
                  </div>
                  {propertyType === "single_family" && (
                    <div className="space-y-2">
                      <Label htmlFor="concierge-acres">Lot size (acres) *</Label>
                      <Input id="concierge-acres" type="number" min="0" step="0.0001" required
                        value={lotAcres} onChange={(e) => setLotAcres(e.target.value)}
                        placeholder="0.25" />
                    </div>
                  )}
                </div>
                {propertyType === "condo" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="concierge-condo-fee">Condo fee ($ / month)</Label>
                      <FormattedInput id="concierge-condo-fee" inputMode="numeric"
                        format="currency" value={condoFee} onChange={setCondoFee}
                        placeholder="$650" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="concierge-parking-spaces">Parking spaces *</Label>
                      <Input id="concierge-parking-spaces" type="number" min="0" max="100" step="1" required
                        value={parkingSpaces} onChange={(e) => setParkingSpaces(e.target.value)}
                        placeholder="0" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="concierge-parking-type">Parking type *</Label>
                      <select id="concierge-parking-type" required value={parkingType}
                        onChange={(e) => setParkingType(e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm">
                        <option value="" disabled>Select parking type</option>
                        <option value="none">None</option>
                        <option value="garage">Garage</option>
                        <option value="deeded">Deeded</option>
                        <option value="assigned">Assigned</option>
                        <option value="off_street">Off-street</option>
                        <option value="street">Street</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="concierge-photos">Property photos (up to 10)</Label>
                  <label htmlFor="concierge-photos"
                    className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 text-sm font-medium text-[#0E56F5] hover:bg-zinc-50">
                    <ImagePlus className="h-5 w-5" /> Add Photos
                  </label>
                  <Input id="concierge-photos" type="file" accept="image/jpeg,image/png,image/webp"
                    multiple className="sr-only" onChange={onPhotoSelection} />
                  <p className="text-xs text-zinc-500">JPG, PNG or WebP, maximum 10 MB per photo. Photos stay private until reviewed.</p>
                  {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Selected photos">
                      {photoPreviews.map((preview, index) => (
                        <div key={preview.src} className="relative overflow-hidden rounded-lg border border-zinc-200">
                          <img src={preview.src} alt={`Selected property photo ${index + 1}`}
                            className="h-28 w-full object-cover" />
                          <button type="button" aria-label={`Remove photo ${index + 1}`}
                            className="absolute right-1 top-1 rounded-full bg-white p-1 text-zinc-800 shadow"
                            onClick={() => setPhotoFiles((current) => current.filter((_, i) => i !== index))}>
                            <X className="h-4 w-4" />
                          </button>
                          <p className="truncate px-2 py-1 text-xs text-zinc-600">{preview.file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concierge-listing-notes">Additional notes (optional)</Label>
                  <Textarea id="concierge-listing-notes" maxLength={4000} rows={3} value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Anything else we should know?" />
                </div>
              </section>
            ) : (
              <section className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="concierge-channel">Which Communications channel? *</Label>
                  <select id="concierge-channel" required value={communicationChannel}
                    onChange={(e) => setCommunicationChannel(e.target.value as CommsChannelKey | "")}
                    className="flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900">
                    <option value="" disabled>Select a channel</option>
                    {COMMS_CHANNELS.map((channel) => (
                      <option key={channel.key} value={channel.key}>{channel.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concierge-subject">Email subject *</Label>
                  <Input id="concierge-subject" required maxLength={160} value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What should agents know?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concierge-details">Message or instructions *</Label>
                  <Textarea id="concierge-details" required maxLength={4000} rows={5} value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="What should the network email say?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concierge-link">Reference link (optional)</Label>
                  <Input id="concierge-link" type="url" maxLength={1000} value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    placeholder="https://…" />
                </div>
              </section>
            )}

            <p className="text-sm text-zinc-600">
              Your request goes to AAC staff for review and notifies our team. No network broadcast or listing publication happens automatically.
            </p>
            <Button type="submit" disabled={submitting || (!canSubmit && !adminPreview)}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                : adminPreview ? "Test Form (No Send)"
                : requestType === "listing" ? "Submit listing for concierge" : "Request network email"}
            </Button>
          </form>
        )}
      </main>
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
              Request sent to AAC Concierge
            </DialogTitle>
            <DialogDescription className="pt-2 text-base leading-6">
              {adminPreview
                ? "This was a preview test. No request was saved, no photos were uploaded, and no emails were sent."
                : "Your request was received and our team has been notified. We'll review your details and follow up. Nothing has been published or sent to the agent network."}
            </DialogDescription>
          </DialogHeader>
          {uploadWarning && (
            <p role="alert" className="rounded-md border border-amber-300 p-3 text-sm text-zinc-800">
              {uploadWarning}
            </p>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setConfirmationOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
