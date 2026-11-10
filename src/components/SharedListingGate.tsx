import { Navigate, useLocation } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UnavailableShareLink } from "@/components/UnavailableShareLink";
import { isDcmlsHost } from "@/lib/host";

// Browser guest storage and query-string IDs never authorize private data.
// Token pages and invitation/activation routes have their own server checks.
export function SharedListingGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading, isVerifiedAgent, isAdmin } = useAuthRole();
  const { pathname, search, state } = useLocation();
  const privateNetwork = /^\/(property|consumer-property|agent|our-agents|agents|find-agent|browse|search|listing-results|listing-search)(\/|$)/.test(pathname);
  if (!privateNetwork) return <>{children}</>;
  if (loading) return <LoadingScreen />;
  const propertyId = pathname.match(/^\/(?:property|consumer-property)\/([^/]+)\/?$/)?.[1];
  if (isDcmlsHost() && propertyId && pathname.startsWith("/property/")) return <Navigate to={`/consumer-property/${propertyId}${search}`} state={state} replace />;
  // DCMLS uses its separately authorized publication source, never AAC reads.
  if (isDcmlsHost() && (/^\/(browse|search)(\/|$)/.test(pathname) || propertyId || /^\/agent\/[^/]+\/?$/.test(pathname))) return <>{children}</>;
  if (user && role === "buyer" && propertyId) return <Navigate to={`/client/shared-property/${propertyId}${search}`} state={state} replace />;
  if (!user || (!isVerifiedAgent && !isAdmin)) return <UnavailableShareLink />;
  return <>{children}</>;
}

export default SharedListingGate;
