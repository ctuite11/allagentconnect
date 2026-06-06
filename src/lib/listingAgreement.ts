export const SALE_LISTING_AGREEMENT_OPTIONS = [
  { value: "Exclusive Right to Sell", label: "Exclusive Right to Sell" },
  { value: "Exclusive Agency", label: "Exclusive Agency" },
  { value: "Open Listing", label: "Open Listing" },
  { value: "Net Listing", label: "Net Listing" },
] as const;

export const RENTAL_LISTING_AGREEMENT_OPTIONS = [
  { value: "Exclusive Right to Rent", label: "Exclusive Right to Rent" },
  { value: "Exclusive Agency", label: "Exclusive Agency" },
  { value: "Open Listing", label: "Open Listing" },
] as const;

export function isRentalListing(listingType: string | null | undefined): boolean {
  return listingType === "for_rent";
}

export function listingAgreementOptions(listingType: string | null | undefined) {
  return isRentalListing(listingType)
    ? RENTAL_LISTING_AGREEMENT_OPTIONS
    : SALE_LISTING_AGREEMENT_OPTIONS;
}

export function listingAgreementSectionTitle(listingType: string | null | undefined): string {
  return isRentalListing(listingType) ? "Rental Agreement" : "Listing Agreement";
}

export function listingAgreementTypeLabel(listingType: string | null | undefined): string {
  return isRentalListing(listingType) ? "Type of Rental Agreement" : "Type of Listing Agreement";
}

export function listingAgreementDisclosuresTitle(listingType: string | null | undefined): string {
  return isRentalListing(listingType)
    ? "Disclosures, Exclusions & Rental Agreement"
    : "Disclosures, Exclusions & Listing Agreement";
}

export function listingCategoryMarketLabel(listingType: string | null | undefined): string {
  return isRentalListing(listingType) ? "Listing Rental" : "Listing Type";
}

export function listingCategoryMarketValue(listingType: string | null | undefined): string | null {
  if (listingType === "for_sale") return "For Sale";
  if (listingType === "for_rent") return "For Rent";
  return listingType ?? null;
}
