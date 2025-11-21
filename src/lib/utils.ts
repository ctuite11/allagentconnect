import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildDisplayAddress(
  listing: { address: string; city: string; state: string; zip_code: string; condo_details?: any }
) {
  const city = listing.city || '';
  const state = listing.state || '';
  const zip = listing.zip_code || '';

  const removeCountry = (s: string) =>
    s.replace(/\s*,?\s*(USA|United States)$/i, '');

  let base = (listing.address || '').trim();
  base = removeCountry(base);

  // Get unit number from condo_details
  let unit: string | null = null;
  try {
    const details =
      typeof listing.condo_details === 'string'
        ? JSON.parse(listing.condo_details)
        : listing.condo_details;
    unit = details?.unit_number ? String(details.unit_number) : null;
  } catch {
    unit = null;
  }

  if (unit) {
    const hasHash = new RegExp(`#\\s*${unit}\\b`, 'i').test(base);
    const hasWord = new RegExp(`\\bUnit\\s*${unit}\\b`, 'i').test(base);
    if (!hasHash && !hasWord) {
      const cityIndex = city ? base.indexOf(`, ${city}`) : -1;
      if (cityIndex > -1) {
        base = `${base.slice(0, cityIndex)} #${unit}${base.slice(cityIndex)}`;
      } else {
        base = `${base} #${unit}`;
      }
    }
  }

  // Ensure city/state/zip appear if missing
  const lowerBase = base.toLowerCase();
  const hasCity = city && lowerBase.includes(city.toLowerCase());
  const hasState = state && new RegExp(`\\b${state}\\b`, 'i').test(base);
  const hasZip = zip && base.includes(zip);

  if (!hasCity && !hasState && !hasZip) {
    const tail = [city && `${city}, ${state} ${zip}`]
      .filter(Boolean)
      .join(', ');
    if (tail) base = [base, tail].filter(Boolean).join(', ');
  }

  return base;
}
