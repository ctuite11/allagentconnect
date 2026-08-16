import { supabase } from "@/integrations/supabase/client";

export type DevelopmentDocumentUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; message: string };

/**
 * Mint a short-lived signed URL via the approved Edge Function.
 * Never use raw private Storage URLs for development documents.
 */
export async function fetchDevelopmentDocumentUrl(
  documentId: string,
): Promise<DevelopmentDocumentUrlResult> {
  const { data, error } = await supabase.functions.invoke("development-document-url", {
    body: { document_id: documentId },
  });

  if (error) {
    return { ok: false, message: error.message || "Unable to open this document." };
  }

  const url = data && typeof data === "object" && typeof (data as { url?: unknown }).url === "string"
    ? (data as { url: string }).url
    : null;
  const expiresIn =
    data && typeof data === "object" && typeof (data as { expiresIn?: unknown }).expiresIn === "number"
      ? (data as { expiresIn: number }).expiresIn
      : 300;

  if (!url) {
    const serverMessage =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Unable to open this document.";
    return { ok: false, message: serverMessage };
  }

  return { ok: true, url, expiresIn };
}

function navigateBlankPopupOrFallback(popup: Window | null, url: string): void {
  if (popup && !popup.closed) {
    try {
      try {
        popup.opener = null;
      } catch {
        // Some browsers may ignore opener clearing; navigation still proceeds.
      }
      popup.location.replace(url);
      return;
    } catch {
      // Fall through to guaranteed same-tab navigation.
    }
  }

  // Popup blocked/closed (common on Safari/iOS) — same-tab assign cannot be blocked
  // the way a post-await target=_blank click can.
  window.location.assign(url);
}

/**
 * Open a development document via signed URL without relying on a post-await window.open
 * (Safari/mobile popup blockers close those). Opens a blank tab synchronously on gesture,
 * then replaces its location once the Edge Function returns.
 */
export async function openDevelopmentDocument(
  documentId: string,
): Promise<DevelopmentDocumentUrlResult> {
  const popup = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

  const result = await fetchDevelopmentDocumentUrl(documentId);
  if (!result.ok) {
    try {
      popup?.close();
    } catch {
      // ignore
    }
    return result;
  }

  navigateBlankPopupOrFallback(popup, result.url);
  return result;
}
