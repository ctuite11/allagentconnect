/** Server-side DCMLS incentive helpers. Never return the selections themselves to consumers. */
export const DCMLS_INCENTIVE_NONE = "No incentive offered";

export type IncentiveType = "buyer" | "seller";

export interface DcmlsSettingsRow {
  user_id: string;
  dcmls_participation: boolean | null;
  dcmls_receive_seller_leads: boolean | null;
  dcmls_buyer_lead_zips: string[] | null;
  dcmls_seller_lead_zips: string[] | null;
  dcmls_buyer_incentives: string[] | null;
  dcmls_seller_incentives: string[] | null;
  dcmls_buyer_incentives_more: string | null;
  dcmls_seller_incentives_more: string | null;
}

export const DCMLS_SETTINGS_COLUMNS =
  "user_id, dcmls_participation, dcmls_receive_seller_leads, dcmls_buyer_lead_zips, dcmls_seller_lead_zips, dcmls_buyer_incentives, dcmls_seller_incentives, dcmls_buyer_incentives_more, dcmls_seller_incentives_more";

export function hasIncentives(list: string[] | null | undefined): boolean {
  return (list ?? []).some((i) => i && i !== DCMLS_INCENTIVE_NONE);
}

/** Availability for the agent's own profile (participation + real incentives). */
export function availability(s: DcmlsSettingsRow | null) {
  if (!s || s.dcmls_participation !== true) return { buyer: false, seller: false };
  return {
    buyer: hasIncentives(s.dcmls_buyer_incentives),
    seller: hasIncentives(s.dcmls_seller_incentives) && s.dcmls_receive_seller_leads === true,
  };
}

/** Comparison eligibility for a given ZIP. */
export function eligibleForCompare(s: DcmlsSettingsRow, type: IncentiveType, zip: string): boolean {
  if (s.dcmls_participation !== true) return false;
  if (type === "buyer") {
    return hasIncentives(s.dcmls_buyer_incentives) && (s.dcmls_buyer_lead_zips ?? []).includes(zip);
  }
  return (
    hasIncentives(s.dcmls_seller_incentives) &&
    s.dcmls_receive_seller_leads === true &&
    (s.dcmls_seller_lead_zips ?? []).includes(zip)
  );
}

export function snapshot(s: DcmlsSettingsRow, type: IncentiveType) {
  const list = type === "buyer" ? s.dcmls_buyer_incentives : s.dcmls_seller_incentives;
  const more = type === "buyer" ? s.dcmls_buyer_incentives_more : s.dcmls_seller_incentives_more;
  return { type, incentives: list ?? [], more: more ?? null, captured_at: new Date().toISOString() };
}
