import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { AgentEmailQuickDialog } from "@/components/agent-search/AgentEmailQuickDialog";

export type ActivityAgentContactProps = {
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  agentPhone: string | null;
};

/**
 * Reusable in-place agent contact row for Success Hub Network Activity feeds.
 * - Name → plain text
 * - Phone → tel: link
 * - Email → opens ContactAgentProfileDialog (preferred) or mailto: fallback
 * Scroll position is preserved because every action happens in-place.
 */
export function ActivityAgentContact({
  agentId,
  agentName,
  agentEmail,
  agentPhone,
}: ActivityAgentContactProps) {
  const formattedPhone = agentPhone ? formatPhoneNumber(agentPhone) : null;
  const location = useLocation();
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] text-neutral-600">
      <Link
        to={`/agent/${agentId}`}
        state={{ from: `${location.pathname}${location.search}` }}
        onClick={(e) => e.stopPropagation()}
        className="block max-w-full truncate font-medium text-[#0E56F5] hover:underline"
      >
        {agentName}
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {formattedPhone && formattedPhone !== "—" ? (
          <span className="inline-flex items-center gap-1 text-neutral-600">
            <Phone className="h-3 w-3" aria-hidden />
            {formattedPhone}
          </span>
        ) : null}
        {agentEmail ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEmailOpen(true);
              }}
              className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900 hover:underline"
            >
              <Mail className="h-3 w-3" aria-hidden />
              {agentEmail}
            </button>
            <AgentEmailQuickDialog
              open={emailOpen}
              onOpenChange={setEmailOpen}
              agentName={agentName}
              agentEmail={agentEmail}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default ActivityAgentContact;