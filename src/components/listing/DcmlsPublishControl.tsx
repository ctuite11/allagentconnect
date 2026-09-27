import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, AlertCircle, EyeOff, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateDcmlsParticipation } from "@/lib/dcmlsListing";

/** Agent-level DCMLS participation resolution for listing forms. */
export type DcmlsParticipationState = "loading" | "unknown" | "on" | "off";

interface DcmlsPublishControlProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  dcmlsStatus?: string;
  dcmlsError?: string | null;
  /**
   * Agent-level DCMLS participation.
   * - on/off: known; checkbox enabled only when on
   * - loading/unknown: control disabled; save must not rewrite DCMLS fields
   */
  participation: DcmlsParticipationState;
  /** Called after a successful agent-level opt-in. Must NOT check the listing box. */
  onOptedIn?: () => void;
}

/**
 * "Show this listing on DCMLS" checkbox with status indicator.
 * Used in both AddListing and EditListing forms.
 */
export function DcmlsPublishControl({
  checked,
  onCheckedChange,
  dcmlsStatus,
  dcmlsError,
  participation,
  onOptedIn,
}: DcmlsPublishControlProps) {
  const [optingIn, setOptingIn] = useState(false);
  const handleOptIn = async () => {
    setOptingIn(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Not signed in");
      const res = await updateDcmlsParticipation(data.user.id, true);
      if (res.status !== "on") throw new Error("Opt-in not confirmed");
      toast.success("You're opted in to DCMLS. Choose whether to show this listing.");
      onOptedIn?.();
    } catch {
      toast.error("Could not opt in to DCMLS. Try again or use Settings.");
    } finally {
      setOptingIn(false);
    }
  };
  const knownOn = participation === "on";
  const knownOff = participation === "off";
  const disabled = !knownOn;

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-primary/5 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Checkbox
          id="publish_to_dcmls"
          checked={knownOn && checked}
          disabled={disabled}
          onCheckedChange={(val) => {
            if (!knownOn) return;
            onCheckedChange(val === true);
          }}
        />
        <Label
          htmlFor="publish_to_dcmls"
          className={`flex items-center gap-2 text-base font-semibold text-foreground ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
        >
          <Globe className="h-5 w-5 text-primary" />
          Show this listing on DCMLS
        </Label>

        {knownOn && dcmlsStatus && dcmlsStatus !== "not_published" && (
          <DcmlsStatusBadge status={dcmlsStatus} error={dcmlsError} />
        )}
      </div>
      {participation === "loading" ? (
        <p className="text-xs text-muted-foreground pl-7 inline-flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Checking Direct Connect MLS participation…
        </p>
      ) : participation === "unknown" ? (
        <p className="text-xs text-amber-800 pl-7 inline-flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>
            Could not verify DCMLS participation. Listing DCMLS settings will not be changed until
            this loads successfully — refresh and try again.
          </span>
        </p>
      ) : knownOff ? (
        <div className="pl-7 space-y-2">
          {onOptedIn && (
            <Button type="button" size="sm" onClick={() => void handleOptIn()} disabled={optingIn}>
              {optingIn && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />}
              Opt in to DCMLS
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            You're not participating in Direct Connect MLS yet. Opt in here or in{" "}
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
              Settings
            </Link>
            . Opting in does not publish listings — you still choose each listing separately.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground pl-7">
          When enabled, this listing will be visible on Direct Connect MLS. Opting into DCMLS in
          Settings does not publish listings — each listing must be selected separately.
        </p>
      )}
    </div>
  );
}

function DcmlsStatusBadge({ status, error }: { status: string; error?: string | null }) {
  if (status === 'published') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
        Published
      </Badge>
    );
  }

  if (status === 'hidden') {
    return (
      <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-200 text-[10px]">
        <EyeOff className="h-3 w-3 mr-1" />
        Hidden
      </Badge>
    );
  }

  if (status === 'error') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] cursor-help">
              <AlertCircle className="h-3 w-3 mr-1" />
              Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{error || 'Unknown error'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
