import type {
  DevelopmentDocumentCategory,
  DevelopmentLifecycleStatus,
  DevelopmentTier,
  DevelopmentUnitStatus,
} from "./types";

export function formatUsd(amount: number | null | undefined, opts?: { tbdLabel?: string }): string {
  if (amount == null || Number.isNaN(Number(amount))) {
    return opts?.tbdLabel ?? "Price TBD";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatStartingFrom(amount: number | null | undefined): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `From ${formatUsd(amount)}`;
}

export function formatSqft(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${new Intl.NumberFormat("en-US").format(Number(value))} sqft`;
}

export function formatBedsBaths(beds: number | null | undefined, baths: number | null | undefined): string {
  const parts: string[] = [];
  if (beds != null) parts.push(`${trimNumeric(beds)} bed`);
  if (baths != null) parts.push(`${trimNumeric(baths)} bath`);
  return parts.join(" · ") || "Beds/baths TBD";
}

function trimNumeric(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function formatLocation(parts: {
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const cityState = [parts.city, parts.state].filter(Boolean).join(", ");
  if (parts.neighborhood && cityState) return `${parts.neighborhood} · ${cityState}`;
  return parts.neighborhood || cityState || "Location TBD";
}

export function formatAddressLine(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string {
  const cityLine = [parts.city, parts.state].filter(Boolean).join(", ");
  const withZip = [cityLine, parts.postal_code].filter(Boolean).join(" ");
  return [parts.address, withZip].filter(Boolean).join(", ") || "Address TBD";
}

export function formatDateLabel(value: string | null | undefined, fallback = "TBD"): string {
  if (!value) return fallback;
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function lifecycleLabel(status: string | null | undefined): string {
  const map: Record<DevelopmentLifecycleStatus, string> = {
    planning: "Planning",
    pre_construction: "Pre-Construction",
    under_construction: "Under Construction",
    completed: "Completed",
  };
  return map[status as DevelopmentLifecycleStatus] ?? "In Progress";
}

export function stageLabel(status: string | null | undefined): string {
  return lifecycleLabel(status);
}

export function salesStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    not_yet_released: "Not Yet Released",
    coming_soon: "Coming Soon",
    now_selling: "Now Selling",
    final_units: "Final Units",
    sold_out: "Sold Out",
  };
  return map[status ?? ""] ?? "—";
}

export function unitStatusLabel(status: string | null | undefined): string {
  const map: Record<DevelopmentUnitStatus, string> = {
    not_released: "Not Released",
    coming_soon: "Coming Soon",
    available: "Available",
    reserved: "Reserved",
    under_agreement: "Under Agreement",
    sold: "Sold",
  };
  return map[status as DevelopmentUnitStatus] ?? "Unknown";
}

export function tierLabel(tier: string | null | undefined): string | null {
  if (tier === "featured") return "Featured";
  if (tier === "premium") return "Premium";
  return null;
}

export function isElevatedTier(tier: string | null | undefined): tier is Exclude<DevelopmentTier, "standard"> {
  return tier === "featured" || tier === "premium";
}

export function documentCategoryLabel(category: string | null | undefined): string {
  const map: Record<DevelopmentDocumentCategory, string> = {
    brochure: "Brochure",
    floor_plan: "Floor Plan",
    site_plan: "Site Plan",
    spec_sheet: "Spec Sheet",
    finish_package: "Finish Package",
    disclosure: "Disclosure",
    condo_docs: "Condo Docs",
    deposit_schedule: "Deposit Schedule",
    broker_registration: "Broker Registration",
    buyer_agent_compensation: "Buyer-Agent Compensation",
    commission_bonus: "Commission Bonus",
    showing_tour_procedure: "Showing / Tour Procedure",
    sales_office_hours: "Sales Office Hours",
    offer_submission: "Offer Submission",
    other: "Other",
  };
  return map[category as DevelopmentDocumentCategory] ?? "Document";
}

/** Agent-resource categories called out in the product brief. */
export const AGENT_RESOURCE_CATEGORIES: ReadonlySet<string> = new Set([
  "broker_registration",
  "buyer_agent_compensation",
  "commission_bonus",
  "showing_tour_procedure",
  "deposit_schedule",
  "offer_submission",
  "sales_office_hours",
]);

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "label" in item && typeof (item as { label: unknown }).label === "string") {
        return (item as { label: string }).label.trim();
      }
      if (item && typeof item === "object" && "name" in item && typeof (item as { name: unknown }).name === "string") {
        return (item as { name: string }).name.trim();
      }
      return "";
    })
    .filter(Boolean);
}

export function asDetailEntries(value: unknown): Array<{ label: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => {
      if (raw == null || raw === "") return null;
      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const display =
        typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
          ? String(raw)
          : Array.isArray(raw)
            ? raw.map(String).filter(Boolean).join(", ")
            : null;
      if (!display) return null;
      return { label, value: display };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
}

/** Lightweight markdown → readable plain blocks (no extra dependency). */
export function markdownToPlainBlocks(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "• ")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .trim(),
    )
    .filter(Boolean);
}
