export const SENT_CATEGORY_LABELS: Record<string, string> = {
  buyer_need: "Buyer Needs",
  sales_intel: "Sales Intel",
  renter_need: "Renter Needs",
  general_discussion: "General Discussions",
};

export function sentCategoryLabel(category: string): string {
  return SENT_CATEGORY_LABELS[category] ?? "Communication";
}

export function previewSentMessage(message: string, max = 140): string {
  const trimmed = message.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatSentDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Map RPC exceptions to agent-facing copy. Never surface raw Postgres text. */
export function friendlyUpdateCommsError(raw: string | null | undefined): string {
  const message = (raw ?? "").toLowerCase();
  if (message.includes("only edit communications you sent") || message.includes("not owner")) {
    return "You can only edit Communications you sent.";
  }
  if (message.includes("subject is required")) return "Please enter a subject.";
  if (message.includes("message is required")) return "Please enter a message.";
  if (message.includes("at most 10") || message.includes("10 attachments")) {
    return "You can attach up to 10 photos or videos.";
  }
  if (
    message.includes("attachment kind") ||
    message.includes("attachment path") ||
    message.includes("attachments must be an array")
  ) {
    return "One of the attachments is invalid. Remove it and try again.";
  }
  if (message.includes("not found")) return "That Communication is no longer available.";
  if (message.includes("not authenticated")) return "Please sign in again.";
  return "Couldn't save your changes. Please try again.";
}
