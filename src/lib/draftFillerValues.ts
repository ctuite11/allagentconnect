// Draft saves store stand-in values so an incomplete draft can persist.
// When a draft is reopened, show these as blank so the form's placeholders appear.
// Exact-match only; non-draft listings are never touched.
export function clearDraftFiller<T extends string>(
  status: string | null | undefined,
  field: "address" | "city" | "zip_code" | "price",
  value: T,
): T | "" {
  if ((status || "").toLowerCase() !== "draft") return value;
  const v = String(value ?? "");
  const filler = { address: "Draft", city: "TBD", zip_code: "00000" } as const;
  if (field === "price") return v.trim() !== "" && Number(v) === 0 ? "" : value;
  return v === filler[field] ? "" : value;
}
