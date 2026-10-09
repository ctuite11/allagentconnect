import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, AlertCircle, EyeOff, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DCMLS_SETTINGS_UI_ENABLED } from "@/config/featureFlags";

/** Agent-level DCMLS participation resolution for listing forms. */
export type DcmlsParticipationState = "loading" | "unknown" | "on" | "off";

interface DcmlsPublishControlProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  dcmlsStatus?: string;
  dcmlsError?: string | null;
  /**
   * Agent-level DCMLS participation (read-only here — managed in Profile/Settings).
   * - on/off: known; choice enabled only when on
   * - loading/unknown: control disabled; save must not rewrite DCMLS fields
   */
  participation: DcmlsParticipationState;
  /** True when the listing's real lifecycle status is Draft / never published. */
  listingIsDraft?: boolean;
}

/**
 * Listing-level "Show this listing on DCMLS: Yes / No".
 * Never changes the agent's participation. Used in AddListing and EditListing.
 */
export function DcmlsPublishControl({
  checked,
  onCheckedChange,
  dcmlsStatus,
  dcmlsError,
  participation,
  listingIsDraft = false,
}: DcmlsPublishControlProps) {
  if (!DCMLS_SETTINGS_UI_ENABLED) return null;
  const knownOn = participation === "on";
  const knownOff = participation === "off";
  const disabled = !knownOn;
  const value = knownOn ? (checked ? "yes" : "no") : "";

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-primary/5 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Label
          className={`flex items-center gap-2 text-base font-semibold text-foreground ${disabled ? "opacity-70" : ""}`}
        >
          <Globe className="h-5 w-5 text-primary" />
          Show this listing on DCMLS
        </Label>
        <RadioGroup
          className="flex gap-5"
          value={value}
          disabled={disabled}
          onValueChange={(v) => {
            if (!knownOn) return;
            onCheckedChange(v === "yes");
          }}
        >
          <label className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
            <RadioGroupItem id="publish_to_dcmls" value="yes" /> Yes
          </label>
          <label className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
            <RadioGroupItem value="no" /> No
          </label>
        </RadioGroup>

        {knownOn && checked && dcmlsStatus && dcmlsStatus !== "not_published" && (
          <DcmlsStatusBadge status={dcmlsStatus} error={dcmlsError} listingIsDraft={listingIsDraft} />
        )}
      </div>
      {participation === "loading" ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Checking Direct Connect MLS participation…
        </p>
      ) : participation === "unknown" ? (
        <p className="text-xs text-amber-800 inline-flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>
            Could not verify DCMLS participation. Listing DCMLS settings will not be changed until
            this loads successfully — refresh and try again.
          </span>
        </p>
      ) : knownOff ? (
        <p className="text-xs text-muted-foreground">
          You're not participating in Direct Connect MLS. Manage DCMLS in{" "}
          <Link to="/agent/profile#dcmls-settings" className="underline underline-offset-2 hover:text-foreground">
            Profile
          </Link>{" "}
          or{" "}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
            Settings
          </Link>
          .
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Yes makes this listing visible on Direct Connect MLS once it is live.
        </p>
      )}
    </div>
  );
}

function DcmlsStatusBadge({
  status,
  error,
  listingIsDraft,
}: {
  status: string;
  error?: string | null;
  listingIsDraft: boolean;
}) {
  if (status === "published") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
        {listingIsDraft ? "Confirmed" : "Published"}
      </Badge>
    );
  }

  if (status === "hidden") {
    return (
      <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-200 text-[10px]">
        <EyeOff className="h-3 w-3 mr-1" />
        Hidden
      </Badge>
    );
  }

  if (status === "error") {
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
            <p className="text-sm">{error || "Unknown error"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
