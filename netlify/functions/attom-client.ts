const ATTOM_BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

export type AttomLookupInput = {
  attomId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type AttomEnrichment = {
  attomId: string | null;
  propertyType: string | null;
  stories: number | null;
  yearBuilt: number | null;
  lotSizeSqft: number | null;
  taxAmount: number | null;
  neighborhood: string | null;
  saleHistory: Array<{ date: string | null; amount: number | null; type: string | null }>;
  ownerOccupied: boolean | null;
  lastSaleAmount: number | null;
  lastSaleDate: string | null;
  // Internal diagnostic field only. Do not render consumer-facing.
  estimatedValue: number | null;
  zoning: string | null;
  raw: Record<string, unknown> | null;
};

export function readAttomApiKey(): string {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) {
    throw new Error("ATTOM_API_KEY is not configured");
  }
  return apiKey;
}

function getHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    apikey: apiKey,
  };
}

async function requestAttom<T>(
  path: string,
  query: URLSearchParams,
  apiKey: string
): Promise<{ status: number; data: T | null; rawText: string | null }> {
  const url = `${ATTOM_BASE_URL}${path}?${query.toString()}`;
  const response = await fetch(url, { method: "GET", headers: getHeaders(apiKey) });
  const rawText = await response.text().catch(() => null);

  let data: T | null = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText) as T;
    } catch {
      data = null;
    }
  }

  return { status: response.status, data, rawText };
}

type AttomPropertyResponse = { property?: Array<Record<string, any>> };
type AttomAvmResponse = {
  property?: Array<{ avm?: { amount?: { value?: number } } }>;
};

function normalizeAttomProperty(
  property: Record<string, any> | null,
  avm: AttomAvmResponse | null
): AttomEnrichment | null {
  if (!property) return null;

  const building = property.building ?? {};
  const summary = property.summary ?? {};
  const sale = property.sale ?? {};
  const lot = property.lot ?? {};
  const address = property.address ?? {};
  const area = property.area ?? {};
  const assessment = property.assessment ?? {};
  const avmAmount = avm?.property?.[0]?.avm?.amount?.value ?? null;

  const saleHistoryRaw: any[] = Array.isArray(property.saleHistory)
    ? property.saleHistory
    : Array.isArray(property.sale?.history)
    ? property.sale.history
    : [];

  const saleHistory = saleHistoryRaw
    .map((item: any) => ({
      date:
        typeof item?.saleTransDate === "string"
          ? item.saleTransDate
          : typeof item?.saleDate === "string"
          ? item.saleDate
          : null,
      amount:
        typeof item?.amount?.saleAmt === "number"
          ? item.amount.saleAmt
          : typeof item?.amount?.amount === "number"
          ? item.amount.amount
          : typeof item?.saleAmt === "number"
          ? item.saleAmt
          : null,
      type:
        typeof item?.saleTransType === "string"
          ? item.saleTransType
          : typeof item?.saleType === "string"
          ? item.saleType
          : null,
    }))
    .filter((item) => item.date || item.amount !== null)
    .slice(0, 5);

  const lastSaleAmount =
    typeof sale.amount?.saleAmt === "number"
      ? sale.amount.saleAmt
      : typeof sale.amount?.amount === "number"
      ? sale.amount.amount
      : null;

  const lastSaleDate =
    typeof sale.saleTransDate === "string"
      ? sale.saleTransDate
      : typeof sale.saleDate === "string"
      ? sale.saleDate
      : null;

  if (saleHistory.length === 0 && (lastSaleDate || lastSaleAmount !== null)) {
    saleHistory.push({
      date: lastSaleDate,
      amount: lastSaleAmount,
      type: null,
    });
  }

  return {
    attomId: property.identifier?.attomId ? String(property.identifier.attomId) : null,
    propertyType: summary.propType ?? summary.propertyType ?? null,
    stories:
      typeof building.size?.stories === "number"
        ? building.size.stories
        : typeof building.rooms?.stories === "number"
        ? building.rooms.stories
        : null,
    yearBuilt:
      typeof summary.yearBuilt === "number"
        ? summary.yearBuilt
        : typeof building.summary?.yearBuilt === "number"
        ? building.summary.yearBuilt
        : null,
    lotSizeSqft:
      typeof lot.lotSize1 === "number"
        ? lot.lotSize1
        : typeof lot.lotsize1 === "number"
        ? lot.lotsize1
        : null,
    taxAmount:
      typeof assessment.tax?.taxAmt === "number"
        ? assessment.tax.taxAmt
        : typeof assessment.tax?.taxAmtAnnual === "number"
        ? assessment.tax.taxAmtAnnual
        : typeof summary.taxAmount === "number"
        ? summary.taxAmount
        : null,
    neighborhood:
      area.munName ?? area.neighborhood ?? summary.neighborhood ?? null,
    saleHistory,
    ownerOccupied:
      typeof summary.absenteeInd === "boolean"
        ? !summary.absenteeInd
        : typeof summary.ownerOccupied === "boolean"
        ? summary.ownerOccupied
        : null,
    lastSaleAmount,
    lastSaleDate,
    estimatedValue: typeof avmAmount === "number" ? avmAmount : null,
    zoning: address.countrySubd ?? summary.zoning ?? null,
    raw: property,
  };
}

export async function fetchAttomEnrichment(
  input: AttomLookupInput,
  apiKey: string
): Promise<AttomEnrichment | null> {
  let property: Record<string, any> | null = null;

  if (input.attomId) {
    const detailQuery = new URLSearchParams({ attomid: String(input.attomId) });
    const detail = await requestAttom<AttomPropertyResponse>(
      "/property/detail",
      detailQuery,
      apiKey
    );
    property = detail.data?.property?.[0] ?? null;
  }

  if (!property && input.address) {
    const fullAddress = [input.address, input.city, input.state, input.zip]
      .filter(Boolean)
      .join(", ");

    const basicQuery = new URLSearchParams({ address: fullAddress });
    const basic = await requestAttom<AttomPropertyResponse>(
      "/property/basicprofile",
      basicQuery,
      apiKey
    );
    property = basic.data?.property?.[0] ?? null;
  }

  if (!property) {
    return null;
  }

  let avm: AttomAvmResponse | null = null;
  const addressLine = input.address ?? "";
  const addressLocal = [input.city, input.state, input.zip].filter(Boolean).join(", ");

  if (addressLine && addressLocal) {
    const avmQuery = new URLSearchParams({
      address1: addressLine,
      address2: addressLocal,
    });
    const avmResponse = await requestAttom<AttomAvmResponse>("/avm/detail", avmQuery, apiKey);
    avm = avmResponse.data;
  }

  return normalizeAttomProperty(property, avm);
}

export async function testAttomConnectivity(
  apiKey: string,
  input: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null }
): Promise<{ status: number; ok: boolean; detail: string }> {
  const fullAddress = [
    input.address || "1 Main St",
    input.city || "Boston",
    input.state || "MA",
    input.zip || "02108",
  ]
    .filter(Boolean)
    .join(", ");

  const query = new URLSearchParams({ address: fullAddress });
  const result = await requestAttom<Record<string, unknown>>("/property/basicprofile", query, apiKey);

  return {
    status: result.status,
    ok: result.status >= 200 && result.status < 300,
    detail: result.rawText ? result.rawText.slice(0, 200) : "No response body",
  };
}
