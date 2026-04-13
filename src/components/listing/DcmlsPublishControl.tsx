import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, AlertCircle, EyeOff } from "lucide-react";

interface DcmlsPublishControlProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  dcmlsStatus?: string;
  dcmlsError?: string | null;
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
}: DcmlsPublishControlProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-center gap-3">
        <Checkbox
          id="publish_to_dcmls"
          checked={checked}
          onCheckedChange={(val) => onCheckedChange(val === true)}
        />
        <Label htmlFor="publish_to_dcmls" className="flex items-center gap-2 cursor-pointer font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Show this listing on DCMLS
        </Label>

        {/* Status indicator */}
        {dcmlsStatus && dcmlsStatus !== 'not_published' && (
          <DcmlsStatusBadge status={dcmlsStatus} error={dcmlsError} />
        )}
      </div>
      <p className="text-xs text-muted-foreground pl-7">
        When enabled, this listing will be visible on the DCMLS public listing site.
      </p>
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
