export function filterByPricePerSqft(
  listings: any[],
  minPpsf: string,
  maxPpsf: string
): any[] {
  const min = minPpsf ? parseFloat(minPpsf) : null;
  const max = maxPpsf ? parseFloat(maxPpsf) : null;
  if (!min && !max) return listings;

  return listings.filter(l => {
    const price = l.price;
    const sqft = l.square_feet;
    if (!price || !sqft || sqft <= 0) return false;
    const ppsf = price / sqft;
    if (min && ppsf < min) return false;
    if (max && ppsf > max) return false;
    return true;
  });
}
