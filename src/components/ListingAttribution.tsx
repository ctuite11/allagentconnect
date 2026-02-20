import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { getPrimaryAgentId } from "@/utils/agentTracking";
import type { User } from "@supabase/supabase-js";

interface ListingAttributionProps {
  listingAgentName?: string;
  listingAgentCompany?: string;
  /** Pass viewer role from parent to avoid redundant RPC calls */
  viewerRole?: UserRole;
  /** Pass sticky agent name from parent to avoid N+1 fetches */
  stickyAgentName?: string;
  /** Render variant */
  variant?: "inline" | "block";
}

/**
 * Centralised listing attribution component.
 * - Buyer/client viewers see "Your agent {StickyAgentName}" (never the listing agent).
 * - Agent/admin viewers see the standard "Listed by {name} • {company}".
 */
export function ListingAttribution({
  listingAgentName,
  listingAgentCompany,
  viewerRole: externalRole,
  stickyAgentName: externalStickyName,
  variant = "inline",
}: ListingAttributionProps) {
  const [user, setUser] = useState<User | null>(null);
  const { role: hookRole, loading: roleLoading } = useUserRole(
    externalRole !== undefined ? null : user
  );
  const [stickyName, setStickyName] = useState<string | null>(
    externalStickyName ?? null
  );

  const role = externalRole ?? hookRole;

  // Resolve auth user only when role not provided externally
  useEffect(() => {
    if (externalRole !== undefined) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, [externalRole]);

  // Resolve sticky agent name only when needed
  useEffect(() => {
    if (externalStickyName) return;
    if (role !== "buyer") return;

    const agentId = getPrimaryAgentId();
    if (!agentId) return;

    supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", agentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStickyName(`${data.first_name} ${data.last_name}`);
        }
      });
  }, [role, externalStickyName]);

  // While loading role (only when doing own lookup), render nothing to avoid flicker
  if (externalRole === undefined && roleLoading) return null;

  // CLIENT / BUYER: show sticky agent attribution
  if (role === "buyer") {
    if (!stickyName) return null;
    return (
      <span className="text-xs text-muted-foreground">
        Your agent {stickyName}
      </span>
    );
  }

  // AGENT / ADMIN / ANONYMOUS: show standard listing agent attribution
  if (!listingAgentName) return null;

  if (variant === "block") {
    return (
      <>
        <span className="text-sm font-medium text-foreground truncate">
          {listingAgentName}
        </span>
        {listingAgentCompany && (
          <span className="text-xs text-muted-foreground truncate">
            {listingAgentCompany}
          </span>
        )}
      </>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      Listed by {listingAgentName}
      {listingAgentCompany && ` • ${listingAgentCompany}`}
    </span>
  );
}
