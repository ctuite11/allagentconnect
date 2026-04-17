import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { propertyStripCard, propertyEyebrow } from "./propertyTokens";

const DEFAULT_BROKERAGE_LOGO_URL = "/placeholder.svg";

interface BrokerageStripProps {
  /** Eyebrow label, e.g. "Listing courtesy of" or "Represented by" */
  label: string;
  brokerageName?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Compact brokerage attribution strip used in the right rail of both
 * PropertyDetail (AAC) and ConsumerPropertyDetail (DCMLS).
 */
export function BrokerageStrip({
  label,
  brokerageName,
  logoUrl,
  className,
}: BrokerageStripProps) {
  const displayLogo = logoUrl || DEFAULT_BROKERAGE_LOGO_URL;
  const displayName = brokerageName || "Brokerage";

  return (
    <Card className={cn(propertyStripCard, className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src={displayLogo}
              alt={`${displayName} logo`}
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_BROKERAGE_LOGO_URL;
              }}
            />
          </div>
          <div className="min-w-0">
            <p className={propertyEyebrow}>{label}</p>
            <p className="text-sm font-medium truncate">{displayName}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default BrokerageStrip;
