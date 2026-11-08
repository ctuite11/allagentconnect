import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, Loader2, Pencil, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { createConciergeDraftFromRequest, listConciergeDrafts, sendConciergeRequestReviewEmail } from "@/lib/conciergeListing";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { COMMS_CHANNEL_BY_KEY } from "@/lib/commsChannels";
import { isCommsChannelKey } from "@/lib/commsChannels";

type RequestStatus = "new" | "in_progress" | "completed" | "declined";
type ConciergeRequest = {
  id: string;
  agent_id: string;
  request_type: "listing" | "broadcast";
  property_type: string | null;
  asking_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  lot_acres: number | null;
  photo_paths: string[];
  communication_channel: string | null;
  subject: string;
  property_address: string | null;
  details: string;
  reference_url: string | null;
  status: RequestStatus;
  created_at: string;
};
type AgentIdentity = { email: string | null; first_name: string | null; last_name: string | null };

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

/** Staff-only manual queue; never sends emails or auto-publishes listings. */
export default function AdminConciergeRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentIdentity>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>({});
  const [loadingPhotosId, setLoadingPhotosId] = useState<string | null>(null);
  const [draftsByRequest, setDraftsByRequest] = useState<Record<string, string>>({});
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<ConciergeRequest | null>(null);
  const [reviewSendingId, setReviewSendingId] = useState<string | null>(null);
  const [reviewQueuedIds, setReviewQueuedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("agent_concierge_requests")
        .select("id, agent_id, request_type, communication_channel, subject, property_address, property_type, asking_price, bedrooms, bathrooms, square_feet, lot_acres, photo_paths, details, reference_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as ConciergeRequest[];
      setRequests(rows);
      // The existing admin-only concierge draft list maps source request IDs
      // to saved drafts so refreshing does not offer to create duplicates.
      const existingDrafts = await listConciergeDrafts().catch(() => []);
      setDraftsByRequest(Object.fromEntries(
        existingDrafts.filter((draft) => draft.creation_request_id).map((draft) =>
          [draft.creation_request_id as string, draft.id]),
      ));
      // One bounded storage request, not a request per listing.
      // Keep the staff queue fast even when a large number of agents submit.
      const photoPaths = rows.flatMap((request) => (request.photo_paths ?? []).slice(0, 3)).slice(0, 60);
      const { data: signed, error: signedError } = photoPaths.length
        ? await supabase.storage.from("concierge-request-photos").createSignedUrls(photoPaths, 300)
        : { data: [], error: null };
      const signedByPath = new Map(
        signedError ? [] : (signed ?? []).flatMap((entry, index) =>
          entry.signedUrl ? [[photoPaths[index], entry.signedUrl] as const] : []),
      );
      setPhotos(Object.fromEntries(rows.map((request) => [
        request.id,
        (request.photo_paths ?? []).flatMap((path) => {
          const url = signedByPath.get(path);
          return url ? [url] : [];
        }),
      ])));

      const ids = Array.from(new Set(rows.map((r) => r.agent_id)));
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("agent_profiles")
          .select("id, email, first_name, last_name")
          .in("id", ids);
        if (!profilesError) {
          setAgents(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile])));
        }
      } else {
        setAgents({});
      }
    } catch {
      toast.error("Unable to load concierge requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function setStatus(id: string, status: RequestStatus) {
    setChangingId(id);
    try {
      const { error } = await (supabase as any)
        .from("agent_concierge_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success("Request status updated.");
    } catch {
      toast.error("Could not update this request.");
    } finally {
      setChangingId(null);
    }
  }

  async function viewAllPhotos(request: ConciergeRequest) {
    const paths = (request.photo_paths ?? []).slice(0, 10);
    if (!paths.length || loadingPhotosId) return;
    setLoadingPhotosId(request.id);
    try {
      const { data, error } = await supabase.storage
        .from("concierge-request-photos")
        .createSignedUrls(paths, 300);
      if (error) throw error;
      const urls = (data ?? []).flatMap((item) => item.signedUrl ? [item.signedUrl] : []);
      if (urls.length !== paths.length) {
        toast.warning("Some photos could not be displayed. Please review before preparing the listing.");
      }
      setPhotos((current) => ({ ...current, [request.id]: urls }));
      setExpandedPhotos((current) => ({ ...current, [request.id]: true }));
    } catch {
      toast.error("Could not load the private photo gallery.");
    } finally {
      setLoadingPhotosId(null);
    }
  }

  async function prepareDraft(request: ConciergeRequest) {
    if (request.request_type !== "listing" || preparingId ||
        request.status === "completed" || request.status === "declined") return;
    const existing = draftsByRequest[request.id];
    if (existing) {
      navigate(`/admin/concierge-requests/edit/${existing}?request=${request.id}`);
      return;
    }
    setPreparingId(request.id);
    try {
      // Server validates the source request, agent ID, current eligibility,
      // and reads property details from the request—not from this browser.
      const draft = await createConciergeDraftFromRequest(request.agent_id, request.id);
      setDraftsByRequest((current) => ({ ...current, [request.id]: draft.id }));
      setRequests((current) => current.map((entry) =>
        entry.id === request.id ? { ...entry, status: "in_progress" } : entry));
      toast.success("Agent-owned draft created. Nothing has been published or emailed.");
      navigate(`/admin/concierge-requests/edit/${draft.id}?request=${request.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the draft.");
    } finally {
      setPreparingId(null);
    }
  }

  async function queueReview(request: ConciergeRequest) {
    const draftId = draftsByRequest[request.id];
    if (!draftId || request.photo_paths?.length || reviewSendingId) return;
    setReviewSendingId(request.id);
    try {
      const result = await sendConciergeRequestReviewEmail(draftId);
      setReviewQueuedIds((current) => current.includes(request.id) ? current : [...current, request.id]);
      toast.success(`Review email queued for ${result.email}. It has not published the listing.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not queue the review email.");
    } finally {
      setReviewSendingId(null);
      setReviewFor(null);
    }
  }

  return (
    <AgentAacPage>
      <Seo title="Concierge Requests | AAC Admin" description="Private staff concierge queue." />
      <AgentPageHeader title="Concierge Requests" subtitle="Manual review queue — no automatic network sends or publishing."
        actions={<Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>} />
      {loading ? (
        <p className="flex items-center gap-2 text-zinc-600"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-zinc-600">No concierge requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const agent = agents[request.agent_id];
            const name = [agent?.first_name, agent?.last_name].filter(Boolean).join(" ");
            return (
              <article key={request.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {request.request_type === "listing" ? "Property listing" : "Network broadcast"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900">{request.subject}</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      {name || agent?.email || request.agent_id} · {new Date(request.created_at).toLocaleString()}
                    </p>
                    {name && agent?.email && <p className="mt-1 text-sm text-zinc-600">{agent.email}</p>}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Status
                    <select aria-label={`Status for ${request.subject}`}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                      value={request.status} disabled={changingId === request.id}
                      onChange={(event) => void setStatus(request.id, event.target.value as RequestStatus)}>
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                {request.request_type === "broadcast" && request.communication_channel && (
                  <p className="mt-3 text-sm text-zinc-800">
                    <strong>Communications channel:</strong>{" "}
                    {isCommsChannelKey(request.communication_channel)
                      ? COMMS_CHANNEL_BY_KEY[request.communication_channel].title
                      : "Unknown channel"}
                  </p>
                )}
                {request.request_type === "listing" && (
                  <div className="mt-3 space-y-2 text-sm text-zinc-800">
                    <p><strong>Property:</strong> {request.property_address ?? "—"}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      <span><strong>Type:</strong> {request.property_type?.replace(/_/g, " ") ?? "—"}</span>
                      <span><strong>Asking:</strong> {request.asking_price != null
                        ? Number(request.asking_price).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                        : "—"}</span>
                      <span><strong>Beds:</strong> {request.bedrooms ?? "—"}</span>
                      <span><strong>Baths:</strong> {request.bathrooms ?? "—"}</span>
                      <span><strong>Sq ft:</strong> {request.square_feet?.toLocaleString() ?? "—"}</span>
                      {request.property_type === "single_family" && (
                        <span><strong>Acres:</strong> {request.lot_acres ?? "—"}</span>
                      )}
                    </div>
                    {photos[request.id]?.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {photos[request.id].map((src, index) => (
                          <a key={src} href={src} target="_blank" rel="noopener noreferrer"
                            title={`View submitted photo ${index + 1}`}>
                            <img src={src} className="h-28 w-full rounded-lg border border-zinc-200 object-cover"
                              alt={`Private submitted property photo ${index + 1}`} />
                          </a>
                        ))}
                      </div>
                    )}
                    {request.photo_paths?.length > 3 && !expandedPhotos[request.id] && (
                      <Button size="sm" variant="outline" disabled={loadingPhotosId !== null}
                        onClick={() => void viewAllPhotos(request)}>
                        {loadingPhotosId === request.id ? "Loading private photos…" :
                          `View all ${request.photo_paths.length} submitted photos`}
                      </Button>
                    )}
                    {request.photo_paths?.length > 0 && !photos[request.id]?.length && (
                      <p className="text-amber-700">Attached photos could not be loaded.</p>
                    )}
                  </div>
                )}
                {request.request_type === "listing" && request.status !== "completed" && request.status !== "declined" && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button size="sm" disabled={preparingId !== null || changingId === request.id}
                      onClick={() => void prepareDraft(request)}>
                      {preparingId === request.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : draftsByRequest[request.id]
                          ? <Pencil className="mr-2 h-4 w-4" />
                          : <FilePlus2 className="mr-2 h-4 w-4" />}
                      {draftsByRequest[request.id] ? "Continue agent draft" : "Create agent draft"}
                    </Button>
                    {draftsByRequest[request.id] && !request.photo_paths?.length && (
                      <Button variant="outline" size="sm" disabled={reviewSendingId !== null}
                        onClick={() => setReviewFor(request)}>
                        {reviewSendingId === request.id
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Send className="mr-2 h-4 w-4" />}
                        {reviewQueuedIds.includes(request.id) ? "Send review email again" : "Send to agent for review"}
                      </Button>
                    )}
                    {request.photo_paths?.length > 0 ? (
                      <p className="text-xs text-amber-800">
                        Review email held until the submitted private photos are securely attached.
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600">
                        Draft stays unpublished. Complete the full address and details before sending the review email.
                      </p>
                    )}
                  </div>
                )}
                {request.details && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    <strong>Agent instructions:</strong> {request.details}
                  </p>
                )}
                {request.reference_url && <p className="mt-3 break-all text-sm">
                  <strong>Reference:</strong> {request.reference_url}
                </p>}
              </article>
            );
          })}
        </div>
      )}
      <AlertDialog open={Boolean(reviewFor)} onOpenChange={(open) => {
        if (!open && !reviewSendingId) setReviewFor(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this draft to the agent for review?</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewFor && (
                <>
                  This queues one review email to {agents[reviewFor.agent_id]?.email || "the agent"} for
                  { " " }{reviewFor.property_address}. The agent must sign in to review,
                  edit and explicitly publish the listing. No listing is published by this action.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewSendingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={reviewSendingId !== null || !reviewFor}
              onClick={() => { if (reviewFor) void queueReview(reviewFor); }}>
              {reviewSendingId !== null ? "Queueing…" : "Queue review email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AgentAacPage>
  );
}
