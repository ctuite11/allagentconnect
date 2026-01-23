/**
 * Inline legal disclosures for use throughout the app.
 * These must appear at point-of-use per the legal spec.
 */

import { AlertCircle, Home, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  className?: string;
  compact?: boolean;
}

/** Use on: Listings, messaging, buyer registry, consumer pages */
export const NoAgencyDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    <span className="font-medium">Disclosure:</span> Use of this platform does not create an agency relationship. 
    All parties are responsible for their own representation and due diligence.
  </div>
);

/** Use on: Listing cards and detail views */
export const OffMarketDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    Off-market and coming-soon listings are shared at the discretion of listing agents and may not be publicly marketed. 
    Availability, pricing, and terms are subject to change without notice.
  </div>
);

/** Use on: Listings and dashboards */
export const AccuracyDisclaimer = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    Listing information is provided by participating agents and has not been independently verified. 
    Users should confirm all details directly with the listing agent.
  </div>
);

/** Use on: Listings, footer, consumer pages */
export const MLSNonAffiliationDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    This platform is not a multiple listing service and is not affiliated with any MLS or REALTOR® association.
  </div>
);

/** Use on: Listings and buyer-facing views */
export const CompensationDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    Buyer agent compensation, if any, is determined solely by the listing agent or seller. 
    No compensation is implied or guaranteed by the platform.
  </div>
);

/** Use on: Listings, search, footer */
export const FairHousingDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground flex items-center gap-2", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    <Home className="h-3 w-3 flex-shrink-0" />
    <span>
      We support the principles of the Fair Housing Act and do not tolerate discrimination based on protected characteristics.
    </span>
  </div>
);

/** Use on: Agent signup / verification flow */
export const VerificationDisclaimer = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    Verification confirms license status at the time of review but does not guarantee ongoing licensure or professional conduct.
  </div>
);

/** Use on: Consumer landing pages */
export const ConsumerDisclosure = ({ className, compact }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", compact ? "" : "p-3 bg-muted/50 rounded-md border", className)}>
    This site facilitates direct communication with listing agents. It does not represent buyers or sellers 
    and does not provide brokerage services.
  </div>
);

/** Patent notice - Use on: Footer and Terms */
export const PatentNotice = ({ className }: DisclosureProps) => (
  <div className={cn("text-xs text-muted-foreground", className)}>
    Certain platform features are protected by issued and pending U.S. patents. Unauthorized use is prohibited.
  </div>
);

/** Email communications disclaimer - Use in: Footer of all system emails */
export const EMAIL_DISCLAIMER = 
  "Messages sent through the platform are communications between users. The platform does not review, endorse, or verify their content.";
