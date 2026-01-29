import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Building2, User } from "lucide-react";
import { RepliersListing, getListingAgentDisplay } from "@/lib/repliers";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface IDXAgentInfoProps {
  listing: RepliersListing;
}

/**
 * Displays listing agent info from Repliers data.
 * Uses getListingAgentDisplay() helper for agent selection logic.
 */
export function IDXAgentInfo({ listing }: IDXAgentInfoProps) {
  const agentInfo = getListingAgentDisplay(listing);

  // If no agent and no brokerage, show minimal fallback
  if (!agentInfo.agentName && !agentInfo.brokerageName) {
    return (
      <Card className="rounded-2xl border-neutral-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-neutral-900">
            Listing Agent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Contact information unavailable
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-neutral-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-neutral-900">
          Listing Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent info row */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border border-neutral-200">
            {agentInfo.agentPhoto ? (
              <AvatarImage src={agentInfo.agentPhoto} alt={agentInfo.agentName || "Agent"} />
            ) : null}
            <AvatarFallback className="bg-neutral-100 text-neutral-600">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {agentInfo.agentName && (
              <p className="font-medium text-neutral-900 truncate">
                {agentInfo.agentName}
              </p>
            )}
            {agentInfo.brokerageName && (
              <p className="text-sm text-neutral-500 truncate flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                {agentInfo.brokerageName}
              </p>
            )}
          </div>
        </div>

        {/* Contact details */}
        {agentInfo.hasPrimaryContact ? (
          <div className="space-y-2 pt-1">
            {agentInfo.agentPhone && (
              <a
                href={`tel:${agentInfo.agentPhone}`}
                className="flex items-center gap-2 text-sm text-neutral-600 hover:text-emerald-600 transition-colors"
              >
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{formatPhoneNumber(agentInfo.agentPhone)}</span>
              </a>
            )}
            {agentInfo.agentEmail && (
              <a
                href={`mailto:${agentInfo.agentEmail}`}
                className="flex items-center gap-2 text-sm text-neutral-600 hover:text-emerald-600 transition-colors truncate"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{agentInfo.agentEmail}</span>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 pt-1">
            Contact via brokerage
          </p>
        )}
      </CardContent>
    </Card>
  );
}
