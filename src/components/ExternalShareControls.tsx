import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { privacyRpc } from "@/lib/privacyApi";
import { getPublicOrigin } from "@/lib/getPublicUrl";
import { useAuthRole } from "@/hooks/useAuthRole";
import { toast } from "sonner";

type ShareLink = { id: string; recipient_label: string | null; created_at: string; expires_at: string; revoked_at: string | null };

/** Seller authorization is separate from an agent's permission to read a listing. */
export function ExternalShareControls({ listingId, isOwner, allowed: initialAllowed, authorization: initialAuthorization = "" }: {
  listingId: string; isOwner: boolean; allowed: boolean; authorization?: string;
}) {
  const { isVerifiedAgent } = useAuthRole();
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(initialAllowed);
  const [savedAllowed, setSavedAllowed] = useState(initialAllowed);
  const [authorization, setAuthorization] = useState(initialAuthorization);
  const [days, setDays] = useState(90);
  const [label, setLabel] = useState("");
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [createdUrl, setCreatedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAllowed(initialAllowed); setSavedAllowed(initialAllowed); setAuthorization(initialAuthorization); setCreatedUrl(""); }, [listingId, initialAllowed, initialAuthorization]);
  const reload = useCallback(async () => setLinks(await privacyRpc("list_listing_share_links", { p_listing_id: listingId })), [listingId]);
  useEffect(() => {
    if (open) void reload().catch(() => toast.error("Could not load share links."));
    else setCreatedUrl("");
  }, [open, reload]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); await reload(); }
    catch { toast.error("This action could not be completed. Confirm the listing's sharing authorization and try again."); }
    finally { setBusy(false); }
  };
  const showLink = (token: string) => setCreatedUrl(`${getPublicOrigin().replace(/\/$/, "")}/s/${token}`);
  if (!isVerifiedAgent || (!isOwner && !initialAllowed)) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{initialAllowed ? "Share externally" : "External sharing settings"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>External sharing</DialogTitle><DialogDescription>
        Links show only this listing and your contact card. Anyone holding a valid link can open it until it expires or is revoked.
      </DialogDescription></DialogHeader>
      {isOwner && <div className="space-y-3 rounded-lg border p-4">
        <Label className="flex items-start gap-2"><input type="checkbox" checked={allowed} onChange={e => setAllowed(e.target.checked)} />Allow external sharing under the seller's instructions and marketing restrictions</Label>
        <Label htmlFor="seller-sharing-authorization">Seller authorization and applicable restrictions</Label>
        <Textarea id="seller-sharing-authorization" value={authorization} onChange={e => setAuthorization(e.target.value)} maxLength={2000} />
        <p className="text-sm text-muted-foreground">Default is off. Turning this off immediately prevents existing links from opening.</p>
        <Button disabled={busy || (allowed && authorization.trim().length < 10)} onClick={() => void run(async () => {
          await privacyRpc("set_listing_external_sharing", { p_listing_id: listingId, p_allowed: allowed, p_authorization: authorization });
          setSavedAllowed(allowed);
          toast.success("Sharing authorization saved.");
        })}>Save authorization</Button>
      </div>}
      {savedAllowed && allowed && <div className="space-y-3">
        <Label htmlFor="share-recipient-label">Label (optional)</Label><Input id="share-recipient-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} />
        <Label htmlFor="share-expiry-days">Expires in days (1–365)</Label><Input id="share-expiry-days" type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} />
        <Button disabled={busy || !Number.isInteger(days) || days < 1 || days > 365} onClick={() => void run(async () => showLink(await privacyRpc("create_listing_share_link", {
          p_listing_id: listingId, p_recipient_label: label || null, p_days: days,
        })))}>Create link</Button>
      </div>}
      {createdUrl && <div className="space-y-2"><Label htmlFor="new-share-link">Copy this new link before closing</Label>
        <Input id="new-share-link" readOnly value={createdUrl} onFocus={e => e.target.select()} />
        <Button variant="outline" onClick={() => void navigator.clipboard.writeText(createdUrl).then(() => toast.success("Link copied")).catch(() => toast.error("Select and copy the link above."))}>Copy link</Button>
      </div>}
      <div className="space-y-3"><h3 className="font-semibold">Your links for this listing</h3>
        {links.length === 0 && <p className="text-sm text-muted-foreground">No links created yet.</p>}
        {links.map(link => <div key={link.id} className="space-y-2 rounded-lg border p-3 text-sm">
          <p>{link.recipient_label || "Share link"} · {link.revoked_at ? "Revoked" : new Date(link.expires_at) <= new Date() ? "Expired" : "Active"}</p>
          <p>Expires {new Date(link.expires_at).toLocaleDateString()}</p>
          <div className="flex gap-2">
            {!link.revoked_at && <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => privacyRpc("revoke_listing_share_link", { p_link_id: link.id }))}>Revoke</Button>}
            {savedAllowed && allowed && <Button variant="outline" size="sm" disabled={busy || !Number.isInteger(days) || days < 1 || days > 365} onClick={() => void run(async () => showLink(await privacyRpc("replace_listing_share_link", { p_link_id: link.id, p_days: days })))}>Replace</Button>}
          </div>
        </div>)}
      </div>
    </DialogContent></Dialog>
  </>;
}
