import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Request = {
  id: string; title: string; body: string | null; created_at: string;
  metadata: { listing_id?: string; requester_id?: string; requester_name?: string } | null;
};

/** Requests are visible only in the sharing account's authenticated workspace. */
export function ShareLinkRequests() {
  const { user, activeOwnerUserId, isVerifiedAgent } = useAuthRole();
  const ownerId = isVerifiedAgent && user ? activeOwnerUserId ?? user.id : null;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ owner: string; items: Request[]; failed?: boolean }>();
  const [busy, setBusy] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const requestVersion = useRef(0);
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    const load = async () => {
      const version = ++requestVersion.current;
      try {
        const { data, error } = await supabase.from("agent_notifications")
          .select("id,title,body,metadata,created_at").eq("agent_id", ownerId)
          .eq("type", "share_link_request").is("read_at", null)
          .order("created_at", { ascending: false }).limit(100);
        if (!cancelled && version === requestVersion.current) setState({ owner: ownerId, items: (data ?? []) as Request[], failed: Boolean(error) });
      } catch {
        if (!cancelled && version === requestVersion.current) setState({ owner: ownerId, items: [], failed: true });
      }
    };
    void load();
    const onFocus = () => void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [ownerId, refresh]);

  const markReviewed = async (id: string) => {
    if (!ownerId || busy) return;
    setBusy(id);
    try {
      const { error } = await supabase.from("agent_notifications").update({ read_at: new Date().toISOString() })
        .eq("id", id).eq("agent_id", ownerId).eq("type", "share_link_request");
      if (error) throw error;
      // Ignore an earlier poll that could otherwise restore this reviewed row.
      if (currentOwner.current === ownerId) requestVersion.current++;
      setState(current => current?.owner === ownerId ? { ...current, items: current.items.filter(item => item.id !== id) } : current);
    } catch {
      toast.error("Could not mark this request reviewed. Please try again.");
    } finally { setBusy(undefined); }
  };

  if (!ownerId || state?.owner !== ownerId || (!state.failed && state.items.length === 0)) return null;
  return <>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3">
      {state.failed ? <><p role="alert" className="text-sm">Share-link requests could not be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>Retry</Button></>
        : <><p className="text-sm">{state.items.length} new share-link {state.items.length === 1 ? "request" : "requests"}</p>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Review link requests</Button></>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Share-link requests</DialogTitle><DialogDescription>
        Review the seller's current authorization before replacing a link. Copy the replacement to the buyer through your usual communication channel.
      </DialogDescription></DialogHeader>
      {state.items.map(item => <div key={item.id} className="space-y-3 rounded-lg border p-4 text-sm">
        <p className="font-semibold">{item.metadata?.requester_name || "A buyer"} requested a new link</p>
        <p>{item.body}</p><p className="text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
        <div className="flex flex-wrap gap-2">
          {item.metadata?.listing_id && <Button size="sm" variant="outline" onClick={() => {
            setOpen(false); navigate(`/property/${encodeURIComponent(item.metadata!.listing_id!)}#agent-tools-section`);
          }}>Review listing and links</Button>}
          <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void markReviewed(item.id)}>Mark reviewed</Button>
        </div>
      </div>)}
    </DialogContent></Dialog>
  </>;
}
