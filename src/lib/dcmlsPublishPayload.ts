type DcmlsSnapshot = {
  publish_to_dcmls: boolean;
  dcmls_status: "published" | "draft";
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

export const dcmlsPublishSnapshot = (showOnDcmls: boolean): DcmlsSnapshot => {
  const publishToDcmls = showOnDcmls === true;

  return {
    publish_to_dcmls: publishToDcmls,
    dcmls_status: publishToDcmls ? "published" : "draft",
  };
};

export const dcmlsShowOnFromRecord = (record: DcmlsRecord): boolean => {
  if (isTruthyPublishFlag(record.publish_to_dcmls)) {
    return true;
  }

  return (record.dcmls_status || "").toLowerCase() === "published";
};