import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Seo } from "@/components/Seo";
import Footer from "@/components/Footer";
import { useAuthRole } from "@/hooks/useAuthRole";
import { supabase } from "@/integrations/supabase/client";

type RequestType = "listing" | "broadcast";

/**
 * Stable Facebook deep link: /concierge.
 * Public content is marketing copy only; requests and identity are visible
 * exclusively to verified, activated AAC agents after sign-in.
 */
export default function Concierge() {
  const { user, role, loading, isVerifiedAgent } = useAuthRole();
  const [requestType, setRequestType] = useState<RequestType>("listing");
  const [subject, setSubject] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = Boolean(user && role === "agent" && isVerifiedAgent);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canSubmit || submitting) return;
    const trimmedSubject = subject.trim();
    const trimmedDetails = details.trim();
    if (!trimmedSubject || !trimmedDetails) {
      toast.error("Please add a subject and describe what you need.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("agent_concierge_requests")
        .insert({
          agent_id: user.id,
          request_type: requestType,
          subject: trimmedSubject,
          property_address: requestType === "listing" ? propertyAddress.trim() || null : null,
          reference_url: referenceUrl.trim() || null,
          details: trimmedDetails,
        });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Your request was received.");
    } catch {
      toast.error("We couldn't submit your request. Nothing was sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Seo
        title="AAC Concierge Service | All Agent Connect"
        description="Need help creating a shareable listing or agent network broadcast? AAC Concierge helps verified real estate agents prepare and share opportunities."
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
          Short on time? Tell us what you'd like to share. Our team can help prepare a
          complete, shareable property listing or an agent network broadcast for you.
        </p>
        <p className="mt-3 text-sm text-zinc-600">
          This service is for verified All Agent Connect members. Drafts and submissions
          are not published or emailed to the network automatically.
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
        ) : !canSubmit ? (
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
              Our team will review the details and follow up. Your request has not
              posted to Facebook or been sent as a network email.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => {
              setSubmitted(false);
              setSubject("");
              setPropertyAddress("");
              setReferenceUrl("");
              setDetails("");
            }}>
              Send another request
            </Button>
          </section>
        ) : (
          <form onSubmit={submitRequest} className="mt-10 space-y-6 rounded-xl border border-zinc-200 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Request concierge help</h2>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-zinc-800">What do you need help with?</legend>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="requestType" value="listing"
                    checked={requestType === "listing"} onChange={() => setRequestType("listing")} />
                  Shareable property listing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="requestType" value="broadcast"
                    checked={requestType === "broadcast"} onChange={() => setRequestType("broadcast")} />
                  Network broadcast email
                </label>
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="concierge-subject">Listing or announcement title *</Label>
              <Input id="concierge-subject" required maxLength={160} value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="E.g., Coming-soon condo in Charlestown" />
            </div>
            {requestType === "listing" && (
              <div className="space-y-2">
                <Label htmlFor="concierge-address">Property address (if applicable)</Label>
                <Input id="concierge-address" maxLength={300} value={propertyAddress}
                  onChange={(event) => setPropertyAddress(event.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="concierge-details">What would you like us to prepare? *</Label>
              <Textarea id="concierge-details" required maxLength={4000} rows={6} value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Include the property details, buyer/renter need, timing, preferred wording and anything else we should know." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="concierge-link">Reference link (optional)</Label>
              <Input id="concierge-link" type="url" maxLength={1000} value={referenceUrl}
                onChange={(event) => setReferenceUrl(event.target.value)}
                placeholder="https://…" />
              <p className="text-xs text-zinc-500">Link to photos or an existing listing, if you have one.</p>
            </div>
            <p className="text-sm text-zinc-600">
              Our team will contact you to review the draft before publication or network delivery.
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit concierge request"}
            </Button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
