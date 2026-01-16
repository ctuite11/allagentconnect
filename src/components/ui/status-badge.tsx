import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getStatusConfig,
  LISTING_STATUS_CONFIG,
  AGENT_STATUS_CONFIG,
  HOT_SHEET_STATUS_CONFIG,
  type ListingStatus,
  type AgentStatus,
  type HotSheetStatus,
} from "@/constants/status";

interface StatusBadgeProps {
  status: string;
  domain?: "listing" | "agent" | "hotsheet";
  size?: "sm" | "md" | "lg";
  className?: string;
  showDot?: boolean;
}

/**
 * Universal StatusBadge component
 * 
 * Usage:
 * <StatusBadge status="active" domain="listing" />
 * <StatusBadge status="verified" domain="agent" />
 * <StatusBadge status="active" domain="hotsheet" />
 */
export function StatusBadge({
  status,
  domain = "listing",
  size = "md",
  className,
  showDot = false,
}: StatusBadgeProps) {
  const config = getStatusConfig(status, domain);
  
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        config.bg,
        config.text,
        "border-0 font-medium whitespace-nowrap",
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5",
            config.text.replace("text-", "bg-")
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}

/**
 * Listing-specific badge (convenience wrapper)
 */
export function ListingStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "domain"> & { status: ListingStatus | string }) {
  return <StatusBadge status={status} domain="listing" {...props} />;
}

/**
 * Agent-specific badge (convenience wrapper)
 */
export function AgentStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "domain"> & { status: AgentStatus | string }) {
  return <StatusBadge status={status} domain="agent" {...props} />;
}

/**
 * Hot Sheet-specific badge (convenience wrapper)
 */
export function HotSheetStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "domain"> & { status: HotSheetStatus | string }) {
  return <StatusBadge status={status} domain="hotsheet" {...props} />;
}
