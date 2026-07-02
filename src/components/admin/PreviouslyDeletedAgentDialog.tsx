import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface PreviouslyDeletedAgentMatch {
  id: string;
  original_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deletion_reason: string | null;
}

interface PreviouslyDeletedAgentDialogProps {
  open: boolean;
  match: PreviouslyDeletedAgentMatch | null;
  actionLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onContinue: () => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function displayName(match: PreviouslyDeletedAgentMatch): string {
  const full = `${match.first_name ?? ""} ${match.last_name ?? ""}`.trim();
  return full || match.email || "Unnamed agent";
}

/**
 * Phase 4 guardrail dialog. Shown to admins before creating, verifying, or
 * re-sending License Verified to any email that appears in `deleted_users`.
 * Two actions only in this phase: Cancel, or Continue anyway (which resubmits
 * the original action with `acknowledgeDeleted: true`).
 */
export function PreviouslyDeletedAgentDialog({
  open,
  match,
  actionLabel,
  loading,
  onCancel,
  onContinue,
}: PreviouslyDeletedAgentDialogProps) {
  // Set synchronously the moment Continue is clicked, so a stray
  // onOpenChange(false) fired during the async override work cannot be
  // mistaken for a Cancel. Cleared on unmount is unnecessary — the parent
  // remounts / closes the dialog on state change.
  const continuingRef = useRef(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading && !continuingRef.current) onCancel();
      }}
    >
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            This agent was previously deleted
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-relaxed">
            {match ? (
              <>
                <span className="font-medium text-neutral-900">
                  {displayName(match)}
                </span>{" "}
                &lt;{match.email}&gt; was deleted on{" "}
                <span className="font-medium text-neutral-900">
                  {formatWhen(match.deleted_at)}
                </span>
                {match.deletion_reason ? (
                  <>
                    {" "}
                    (reason:{" "}
                    <span className="italic">{match.deletion_reason}</span>)
                  </>
                ) : null}
                . Continuing will {actionLabel.toLowerCase()} as a brand-new
                agent account. Restore isn't available yet — cancel and review
                the archive first if you're unsure.
              </>
            ) : (
              "This email is in the deleted-agents archive."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          {/*
            Plain buttons — NOT AlertDialogAction / AlertDialogCancel. Those
            Radix wrappers auto-close the dialog on click, which fires
            onOpenChange(false) and previously ran onCancel() in parallel with
            onContinue(), racing to resolve the parent's promise gate and
            dropping the retry silently.
          */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (loading) return;
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (loading) return;
              continuingRef.current = true;
              try {
                onContinue();
              } finally {
                // Reset on next tick so a later re-open of this same dialog
                // instance behaves normally. The parent typically closes the
                // dialog synchronously after onContinue resolves anyway.
                setTimeout(() => {
                  continuingRef.current = false;
                }, 0);
              }
            }}
            className="bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600"
          >
            {loading ? "Working…" : "Continue anyway"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PreviouslyDeletedAgentDialog;