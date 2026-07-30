import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import {
  MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID,
  isAnnouncementEligible,
} from "@/lib/announcements";

export { MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID };

/**
 * One-time high-visibility announcement for authenticated agents.
 * Persistence: agent_settings.dismissed_announcement_ids (cross-device).
 * Does not touch notification preference components or email pipelines.
 */
export function MessagingSystemUpdateAnnouncement() {
  const navigate = useNavigate();
  const { user, role, isAdmin, loading: authLoading } = useAuthRole();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAgent = role === "agent" || isAdmin;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (authLoading) return;
      if (!user?.id || !isAgent) {
        if (!cancelled) {
          setOpen(false);
          setReady(true);
        }
        return;
      }

      // Cheap short-circuit: archived / expired / not-yet-published announcements
      // and accounts created after publish never query at all.
      if (
        !isAnnouncementEligible({
          announcementId: MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID,
          accountCreatedAt: user.created_at,
          dismissedIds: [],
        })
      ) {
        if (!cancelled) {
          setOpen(false);
          setReady(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("agent_settings")
          .select("dismissed_announcement_ids")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.warn("[MessagingSystemUpdateAnnouncement] load failed:", error);
          setOpen(false);
          setReady(true);
          return;
        }

        // No agent_settings row → not an agent workspace user we can persist for.
        if (!data) {
          setOpen(false);
          setReady(true);
          return;
        }

        const dismissed = Array.isArray(data.dismissed_announcement_ids)
          ? (data.dismissed_announcement_ids as string[])
          : [];
        setOpen(
          isAnnouncementEligible({
            announcementId: MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID,
            accountCreatedAt: user.created_at,
            dismissedIds: dismissed,
          }),
        );
        setReady(true);
      } catch (e) {
        console.warn("[MessagingSystemUpdateAnnouncement] unexpected error:", e);
        if (!cancelled) {
          setOpen(false);
          setReady(true);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, user?.created_at, isAgent]);

  const acknowledge = useCallback(async () => {
    if (!user?.id || saving) return false;
    setSaving(true);
    try {
      const { data, error: readError } = await supabase
        .from("agent_settings")
        .select("dismissed_announcement_ids")
        .eq("user_id", user.id)
        .maybeSingle();

      if (readError) throw readError;
      if (!data) return false;

      const current = Array.isArray(data.dismissed_announcement_ids)
        ? (data.dismissed_announcement_ids as string[])
        : [];
      if (current.includes(MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID)) {
        return true;
      }

      const next = [...current, MESSAGING_PREFERENCES_FIX_ANNOUNCEMENT_ID];
      const { error: writeError } = await supabase
        .from("agent_settings")
        .update({ dismissed_announcement_ids: next })
        .eq("user_id", user.id);

      if (writeError) throw writeError;
      return true;
    } catch (e) {
      console.error("[MessagingSystemUpdateAnnouncement] acknowledge failed:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.id, saving]);

  const handleDismiss = async () => {
    const ok = await acknowledge();
    if (ok) setOpen(false);
  };

  const handleReviewPreferences = async () => {
    const ok = await acknowledge();
    if (!ok) return;
    setOpen(false);
    navigate("/communications", { state: { scrollToPreferences: true } });
  };

  if (!ready || !open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Require an explicit button — backdrop/Escape alone must not dismiss
        // without recording acknowledgement. Block uncontrolled close.
        if (!next) return;
        setOpen(next);
      }}
    >
      <DialogContent
        hideCloseButton
        className="max-w-[min(100vw-1.5rem,28rem)] gap-0 overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-50 p-0 shadow-[0_12px_40px_rgba(180,83,9,0.35)] sm:rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="border-b-2 border-amber-400 bg-amber-500 px-5 py-4 text-amber-950">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-300 ring-2 ring-amber-200">
                <AlertTriangle className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-950/80">
                  Important notice
                </p>
                <DialogTitle className="sr-only">Messaging System Update</DialogTitle>
                <h2 className="text-[20px] font-bold leading-tight tracking-tight text-amber-950">
                  Messaging System Update
                </h2>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5">
          <DialogDescription asChild>
            <div className="space-y-3 text-[14px] leading-relaxed text-amber-950/90">
              <p>
                We apologize for a recent bug in our messaging and email notification system that
                caused some members to receive messages they had chosen not to receive.
              </p>
              <p>
                We’ve identified the issue and have worked to correct it. Your Communications Center
                channel preferences will now be honored when messages are sent.
              </p>
              <p>
                Please review your Communications Center preferences to make sure your channels,
                coverage area, and notification timing are set the way you want.
              </p>
              <p>Thank you for your patience as we continue improving All Agent Connect.</p>
            </div>
          </DialogDescription>

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleReviewPreferences()}
              className="h-11 w-full rounded-xl bg-amber-600 text-[14px] font-semibold text-white hover:bg-amber-700 focus-visible:ring-amber-500"
            >
              Review Communication Preferences
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void handleDismiss()}
              className="h-11 w-full rounded-xl border-amber-400 bg-white text-[14px] font-medium text-amber-950 hover:bg-amber-100"
            >
              Dismiss
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MessagingSystemUpdateAnnouncement;
