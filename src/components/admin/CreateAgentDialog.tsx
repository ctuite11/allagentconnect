import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import {
  PreviouslyDeletedAgentDialog,
  type PreviouslyDeletedAgentMatch,
} from "@/components/admin/PreviouslyDeletedAgentDialog";
import {
  checkDeletedAgent,
  logDeletedAgentOverride,
} from "@/lib/previouslyDeletedAgent";
import {
  checkAgentEmail,
  formatMatchLine,
  type AgentEmailCheck,
} from "@/lib/adminCheckAgentEmail";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const emailSchema = z.string().trim().email("Please enter a valid email address");

export function CreateAgentDialog({ open, onOpenChange, onSuccess }: CreateAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deletedMatch, setDeletedMatch] = useState<PreviouslyDeletedAgentMatch | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [emailCheck, setEmailCheck] = useState<AgentEmailCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = emailSchema.safeParse(email).success;

  // Debounced lookup once a valid email has been entered.
  useEffect(() => {
    if (!open || !emailValid) {
      setEmailCheck(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      const result = await checkAgentEmail(normalizedEmail);
      if (cancelled) return;
      setEmailCheck(result && result.email === normalizedEmail ? result : null);
      setChecking(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setChecking(false);
    };
  }, [open, emailValid, normalizedEmail]);

  const runCheckNow = async () => {
    if (!emailValid) return null;
    setChecking(true);
    try {
      const result = await checkAgentEmail(normalizedEmail);
      setEmailCheck(result);
      return result;
    } finally {
      setChecking(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setDeletedMatch(null);
    setEmailCheck(null);
    setStep("form");
  };


  const submitToServer = async (acknowledgeDeleted: boolean) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to create agents");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            ...(acknowledgeDeleted ? { acknowledgeDeleted: true } : {}),
          }),
        },
      );

      const result = await response.json();

      // Server-side Phase 4 guardrail — if we get 409 previously_deleted and
      // we haven't yet acknowledged, open the dialog (belt-and-suspenders in
      // case the client-side pre-check missed it, e.g. lookup returned null).
      if (response.status === 409 && result?.code === "previously_deleted") {
        setDeletedMatch(result.match ?? null);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to create agent");
      }

      toast.success(`Invite sent to ${normalizedEmail}`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("[CreateAgentDialog] Error:", error);
      toast.error(error.message || "Failed to create agent");
    }
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter first and last name");
      return;
    }

    setStep("confirm");
    // Re-run the lookup so the confirm step reflects the current email.
    void runCheckNow();
  };


  const handleConfirmSend = async () => {
    setLoading(true);
    try {
      // Phase 4 pre-check — if this email was previously deleted, open the
      // confirmation dialog before we even talk to admin-create-user.
      const match = await checkDeletedAgent(email);
      if (match) {
        setDeletedMatch(match);
        return;
      }
      await submitToServer(false);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAnyway = async () => {
    if (!deletedMatch) return;
    setLoading(true);
    try {
      await logDeletedAgentOverride(deletedMatch);
      setDeletedMatch(null);
      await submitToServer(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const blocked = Boolean(emailCheck?.hasActiveAccount);

  const renderEmailCheck = () => {
    if (!emailValid) return null;
    if (checking) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking existing records...
        </div>
      );
    }
    if (!emailCheck) return null;
    if (!emailCheck.found) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No existing record for this email.</span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">This email is already known to us</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {emailCheck.matches.map((m, i) => (
              <li key={`${m.source}-${i}`}>{formatMatchLine(m)}</li>
            ))}
          </ul>
          {blocked && (
            <p className="pt-1 font-medium">
              This agent already has an account — a new invite cannot be created.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (

    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm invite</DialogTitle>
              <DialogDescription>
                Review the details below. No email is sent until you confirm.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-right">
                  {firstName.trim()} {lastName.trim()}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-right break-all">
                  {email.trim().toLowerCase()}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium text-right">Send setup invite email</span>
              </div>
            </div>

            <div className="pt-3">{renderEmailCheck()}</div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSend}
                disabled={loading || blocked || checking}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending invite...
                  </>
                ) : (
                  "Confirm & send invite"
                )}
              </Button>
            </DialogFooter>

          </>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Send a personal setup invite. The agent will create their password and finish their profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReview} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              disabled={loading}
            />
            {renderEmailCheck()}
          </div>


          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Review invite
            </Button>
          </DialogFooter>
        </form>
        </>
        )}
      </DialogContent>
    </Dialog>
    <PreviouslyDeletedAgentDialog
      open={Boolean(deletedMatch)}
      match={deletedMatch}
      actionLabel="create this agent"
      loading={loading}
      onCancel={() => setDeletedMatch(null)}
      onContinue={handleContinueAnyway}
    />
    </>
  );
}
