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
