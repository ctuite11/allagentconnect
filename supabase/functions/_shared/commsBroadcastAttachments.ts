/**
 * Comms Center broadcast attachments (photos/video).
 * Separate from the conversation-scoped Messages attachment contract.
 */
export const MAX_COMMS_ATTACHMENTS = 10;

export interface CommsAttachmentInput {
  path: string;
  kind: "image" | "video";
  mimeType?: string;
  name?: string;
  size?: number;
}

export interface NormalizedCommsAttachment {
  path: string;
  kind: "image" | "video";
  mime_type: string;
  file_name: string;
  size_bytes: number;
  sort_order: number;
}

/**
 * Validates client-supplied attachment metadata. Every path must live inside
 * the authenticated sender's own storage folder (`<senderId>/...`).
 */
export function normalizeCommsAttachments(
  raw: unknown,
  senderId: string,
): { ok: true; attachments: NormalizedCommsAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "attachments must be an array" };
  if (raw.length > MAX_COMMS_ATTACHMENTS) {
    return { ok: false, error: `at most ${MAX_COMMS_ATTACHMENTS} attachments are allowed` };
  }

  const out: NormalizedCommsAttachment[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    if (out === null) return;
  });

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") return { ok: false, error: "invalid attachment entry" };
    const a = item as Record<string, unknown>;
    const path = typeof a.path === "string" ? a.path.trim() : "";
    if (!path) return { ok: false, error: "attachment path is required" };
    if (path.includes("..")) return { ok: false, error: "invalid attachment path" };
    if (!path.startsWith(`${senderId}/`)) {
      return { ok: false, error: "attachment path does not belong to the sender" };
    }
    if (seen.has(path)) return { ok: false, error: "duplicate attachment path" };
    seen.add(path);

    const kind = a.kind === "video" ? "video" : a.kind === "image" ? "image" : null;
    if (!kind) return { ok: false, error: "attachment kind must be image or video" };

    out.push({
      path,
      kind,
      mime_type: typeof a.mimeType === "string" ? a.mimeType.slice(0, 200) : "",
      file_name: typeof a.name === "string" && a.name ? a.name.slice(0, 300) : "attachment",
      size_bytes: typeof a.size === "number" && Number.isFinite(a.size) && a.size >= 0 ? Math.floor(a.size) : 0,
      sort_order: i,
    });
  }

  return { ok: true, attachments: out };
}

/** "3 photos and 1 video" — empty string when there are no attachments. */
export function summarizeCommsAttachments(attachments: Array<{ kind: "image" | "video" }>): string {
  const photos = attachments.filter((a) => a.kind === "image").length;
  const videos = attachments.filter((a) => a.kind === "video").length;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

/** Email/digest CTA block. Returns "" when there are no attachments. */
export function buildAttachmentCtaHtml(
  attachments: Array<{ kind: "image" | "video" }>,
  senderName: string,
  actionUrl: string,
): string {
  const summary = summarizeCommsAttachments(attachments);
  if (!summary) return "";
  return `
            <div style="background:#ffffff;border:1px solid #e5e7eb;padding:14px 16px;border-radius:8px;margin:12px 0;">
              <p style="margin:0;font-size:14px;color:#334155;">${senderName} shared ${summary} — <a href="${actionUrl}" style="color:#0E56F5;text-decoration:none;font-weight:600;">View attachments</a></p>
            </div>`;
}
