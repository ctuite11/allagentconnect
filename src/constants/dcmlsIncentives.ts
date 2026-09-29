/** DCMLS incentive options (agent_settings.dcmls_*_incentives). Storage/UI only. */
export const DCMLS_INCENTIVE_NONE = "No incentive offered";
export const DCMLS_INCENTIVE_MORE = "More";
export const DCMLS_INCENTIVE_MORE_MAX = 500;

export const DCMLS_BUYER_INCENTIVES = [
  "Buyer-agent fee credit / rebate",
  "Closing-cost credit",
  "Home warranty",
  "Inspection credit",
  "Moving / storage credit",
  DCMLS_INCENTIVE_NONE,
  DCMLS_INCENTIVE_MORE,
] as const;

export const DCMLS_SELLER_INCENTIVES = [
  "Reduced / flexible listing fee",
  "Professional photography included",
  "Floor plan / 3D tour included",
  "Drone / video marketing included",
  "Staging consultation included",
  "Pre-listing preparation credit",
  "Moving / storage credit",
  DCMLS_INCENTIVE_NONE,
  DCMLS_INCENTIVE_MORE,
] as const;

/** "No incentive offered" is mutually exclusive with every other choice (including More). */
export function toggleDcmlsIncentive(list: string[], item: string): string[] {
  if (list.includes(item)) return list.filter((i) => i !== item);
  if (item === DCMLS_INCENTIVE_NONE) return [DCMLS_INCENTIVE_NONE];
  return [...list.filter((i) => i !== DCMLS_INCENTIVE_NONE), item];
}
