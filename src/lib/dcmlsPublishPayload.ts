/**
 * DCMLS publish state must be written in a single `listings` update so rows never
 * sit in an invalid combination (enforced by DB CHECK + RLS).
 * UI or API layers should spread this into the main update payload, not PATCH columns separately.
 */
export function dcmlsPublishSnapshot(wantPublishedOnDcmls: boolean): {
  publish_to_dcmls: boolean;
  dcmls_status: "published" | "draft";
} {
  if (wantPublishedOnDcmls) {
    return { publish_to_dcmls: true, dcmls_status: "published" };
  }
  return { publish_to_dcmls: false, dcmls_status: "draft" };
}
