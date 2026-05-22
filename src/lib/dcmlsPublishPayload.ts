/** Allowed by listings.dcmls_status_check (see supabase migration 20260416203603). */
export const DCMLS_ALLOWED_STATUSES = [
  "not_published",
  "published",
  "hidden",
  "error",
] as const;

export type DcmlsAllowedStatus = (typeof DCMLS_ALLOWED_STATUSES)[number];

type DcmlsSnapshot = {
  publish_to_dcmls: boolean;
  dcmls_status: DcmlsAllowedStatus;
};

type DcmlsRecord = {
  publish_to_dcmls?: boolean | string | number | null;
  dcmls_status?: string | null;
};

const isTruthyPublishFlag = (value: DcmlsRecord["publish_to_dcmls"]): boolean => {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes";
  }

  return false;
};

/** DB-safe inactive status while DCMLS public publish is gated. */
export const DCMLS_INACTIVE_STATUS: DcmlsAllowedStatus = "not_published";

export const dcmlsPublishSnapshot = (showOnDcmls: boolean): DcmlsSnapshot => {
  const publishToDcmls = showOnDcmls === true;

  return {
    publish_to_dcmls: publishToDcmls,
    dcmls_status: publishToDcmls ? "published" : DCMLS_INACTIVE_STATUS,
  };
};

export const dcmlsShowOnFromRecord = (record: DcmlsRecord): boolean => {
  if (isTruthyPublishFlag(record.publish_to_dcmls)) {
    return true;
  }

  return (record.dcmls_status || "").toLowerCase() === "published";
};