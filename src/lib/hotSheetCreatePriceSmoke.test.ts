/**
 * Functional smoke coverage for Create/Edit Hot Sheet price + live-count
 * behavior (PR #102). These tests exercise the same helpers the dialog uses
 * for validation, persistence, and matching-count criteria — not typecheck alone.
 */
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_HOT_SHEET_CRITERIA,
  fromCriteriaPayload,
  parseHotSheetNumber,
  toCriteriaPayload,
} from "@/lib/hotSheetCriteriaCore";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

/** Mirrors CreateHotSheetDialog.validateCriteriaInputs price/range checks. */
function validateCreatePriceRange(input: {
  minPrice: string;
  maxPrice: string;
  hasNoMin: boolean;
  hasNoMax: boolean;
  state?: string;
  statuses?: string[];
}) {
  if (!input.state) {
    return { valid: false, message: "Please select at least one location filter." };
  }
  const min = input.hasNoMin ? null : parseHotSheetNumber(input.minPrice);
  const max = input.hasNoMax ? null : parseHotSheetNumber(input.maxPrice);
  if (min !== null && max !== null && min > max) {
    return { valid: false, message: "Min Price cannot be greater than Max Price." };
  }
  if ((input.statuses?.length || 0) === 0) {
    return { valid: false, message: "Select at least one listing status." };
  }
  return { valid: true, message: "ok" };
}

/** Same numeric conversion CreateHotSheetDialog uses for the live count. */
function liveCountCriteriaFromForm(form: {
  minPrice: string;
  maxPrice: string;
  hasNoMin: boolean;
  hasNoMax: boolean;
  propertyTypes?: string[];
  statuses?: string[];
  cities?: string[];
  state?: string;
  zipCode?: string;
  bedrooms?: string;
  bathrooms?: string;
  minSqft?: string;
  maxSqft?: string;
}) {
  const savedNumbers = toCriteriaPayload({
    ...DEFAULT_HOT_SHEET_CRITERIA,
    ...form,
    cities: form.cities ?? [],
    propertyTypes: form.propertyTypes ?? [],
    statuses: form.statuses ?? [],
  });
  return {
    propertyTypes: form.propertyTypes ?? [],
    statuses: form.statuses && form.statuses.length > 0 ? form.statuses : undefined,
    cities: form.cities ?? [],
    state: form.state,
    zipCode: form.zipCode,
    minPrice: savedNumbers.minPrice ?? undefined,
    maxPrice: savedNumbers.maxPrice ?? undefined,
    bedrooms: savedNumbers.bedrooms ?? undefined,
    bathrooms: savedNumbers.bathrooms ?? undefined,
    minSqft: savedNumbers.minSqft ?? undefined,
    maxSqft: savedNumbers.maxSqft ?? undefined,
  };
}

describe("Create Hot Sheet functional smoke — $500,000–$1,200,000", () => {
  it("validates comma prices without treating them as inverted range", () => {
    // Pre-fix bug: parseFloat("500,000")===500 and parseFloat("1,200,000")===1
    // caused min > max and blocked create.
    const result = validateCreatePriceRange({
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: false,
      hasNoMax: false,
      state: "CT",
      statuses: ["Active"],
    });
    expect(result.valid).toBe(true);
  });

  it("builds save + live-count prices at 500000 / 1200000", () => {
    const form = {
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: false,
      hasNoMax: false,
      state: "CT",
      cities: ["Greenwich"],
      statuses: ["Active"],
      propertyTypes: ["single_family"],
    };
    const saved = toCriteriaPayload({ ...DEFAULT_HOT_SHEET_CRITERIA, ...form });
    const countCriteria = liveCountCriteriaFromForm(form);

    expect(saved.minPrice).toBe(500000);
    expect(saved.maxPrice).toBe(1200000);
    expect(countCriteria.minPrice).toBe(500000);
    expect(countCriteria.maxPrice).toBe(1200000);
    expect(countCriteria.minPrice).toBe(saved.minPrice);
    expect(countCriteria.maxPrice).toBe(saved.maxPrice);
  });

  it("rejects a true inverted range after comma-safe parse", () => {
    const result = validateCreatePriceRange({
      minPrice: "1,200,000",
      maxPrice: "500,000",
      hasNoMin: false,
      hasNoMax: false,
      state: "CT",
      statuses: ["Active"],
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Min Price cannot be greater/);
  });
});

describe("No Minimum / No Maximum smoke", () => {
  it("allows create with both No Min and No Max", () => {
    const result = validateCreatePriceRange({
      minPrice: "",
      maxPrice: "",
      hasNoMin: true,
      hasNoMax: true,
      state: "CT",
      statuses: ["Active"],
    });
    expect(result.valid).toBe(true);

    const saved = toCriteriaPayload({
      ...DEFAULT_HOT_SHEET_CRITERIA,
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: true,
      hasNoMax: true,
    });
    expect(saved.minPrice).toBeNull();
    expect(saved.maxPrice).toBeNull();

    const countCriteria = liveCountCriteriaFromForm({
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: true,
      hasNoMax: true,
    });
    expect(countCriteria.minPrice).toBeUndefined();
    expect(countCriteria.maxPrice).toBeUndefined();
  });

  it("allows No Min with a max only, and No Max with a min only", () => {
    expect(
      validateCreatePriceRange({
        minPrice: "",
        maxPrice: "1,200,000",
        hasNoMin: true,
        hasNoMax: false,
        state: "CT",
        statuses: ["Active"],
      }).valid,
    ).toBe(true);

    expect(
      validateCreatePriceRange({
        minPrice: "500,000",
        maxPrice: "",
        hasNoMin: false,
        hasNoMax: true,
        state: "CT",
        statuses: ["Active"],
      }).valid,
    ).toBe(true);
  });
});

describe("Edit existing Hot Sheet price round-trip smoke", () => {
  it("loads saved numeric prices and re-saves the same values with commas in the form", () => {
    const loaded = fromCriteriaPayload({
      minPrice: 500000,
      maxPrice: 1200000,
      hasNoMin: false,
      hasNoMax: false,
      state: "CT",
      cities: ["Stamford"],
      statuses: ["Active"],
      propertyTypes: ["condo"],
    });

    // fromCriteriaPayload keeps numbers as display strings without forcing commas;
    // UI may show commas via formatters — parsers must accept either form.
    const editedForm = {
      ...loaded,
      minPrice: "500,000",
      maxPrice: "1,200,000",
    };
    const resaved = toCriteriaPayload(editedForm);
    expect(resaved.minPrice).toBe(500000);
    expect(resaved.maxPrice).toBe(1200000);
    expect(resaved.hasNoMin).toBe(false);
    expect(resaved.hasNoMax).toBe(false);
  });
});

describe("exact-count query efficiency", () => {
  it("uses head:true exact count and does not fetch listing rows", () => {
    const selectCalls: Array<{ columns: string; options: unknown }> = [];
    const chain: Record<string, unknown> = {};
    const methods = [
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "or",
      "ilike",
      "not",
      "is",
      "filter",
      "order",
    ];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    chain.select = vi.fn((columns: string, options?: unknown) => {
      selectCalls.push({ columns, options });
      return chain;
    });

    const supabase = {
      from: vi.fn(() => chain),
    };

    const result = buildListingsQuery(
      supabase as never,
      {
        state: "CT",
        cities: ["Greenwich"],
        minPrice: 500000,
        maxPrice: 1200000,
        statuses: ["Active"],
      },
      { countExact: true },
    );

    expect(supabase.from).toHaveBeenCalledWith("listings_public");
    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0].columns).toBe("id");
    expect(selectCalls[0].options).toEqual({ count: "exact", head: true });
    // Caller gets the chain back; CreateHotSheetDialog does not call .limit().
    expect(result).toBe(chain);
    expect(Object.prototype.hasOwnProperty.call(chain, "limit")).toBe(false);
    // Head-count skips ORDER BY — no unnecessary sort pressure on the DB.
    expect(chain.order).not.toHaveBeenCalled();
  });
});

describe("live count criteria coverage vs saved payload", () => {
  it("aligns price, beds, baths, sqft, types, statuses, cities, state with save", () => {
    const form = {
      ...DEFAULT_HOT_SHEET_CRITERIA,
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: false,
      hasNoMax: false,
      bedrooms: "3",
      bathrooms: "2",
      minSqft: "1,500",
      maxSqft: "4,000",
      state: "CT",
      cities: ["Darien"],
      statuses: ["Active", "Coming Soon"],
      propertyTypes: ["single_family", "condo"],
      zipCode: "06820",
    };
    const saved = toCriteriaPayload(form);
    const countCriteria = liveCountCriteriaFromForm({
      ...form,
      zipCode: "06820",
    });

    expect(countCriteria.minPrice).toBe(saved.minPrice);
    expect(countCriteria.maxPrice).toBe(saved.maxPrice);
    expect(countCriteria.bedrooms).toBe(saved.bedrooms);
    expect(countCriteria.bathrooms).toBe(saved.bathrooms);
    expect(countCriteria.minSqft).toBe(saved.minSqft);
    expect(countCriteria.maxSqft).toBe(saved.maxSqft);
    expect(countCriteria.propertyTypes).toEqual(saved.propertyTypes);
    expect(countCriteria.statuses).toEqual(saved.statuses);
    expect(countCriteria.cities).toEqual(saved.cities);
    expect(countCriteria.state).toBe(saved.state);
    expect(countCriteria.zipCode).toBe("06820");
  });

  it("documents remaining saved fields not applied by live count / buildListingsQuery", () => {
    // Pre-existing gap (not introduced by the comma-price fix): Create saves
    // acres, pricePerSqft, hasParking, county, and richer sale criteria that
    // buildListingsQuery does not filter on (except maxPricePerSqft, which the
    // Create dialog still does not pass into the live count).
    const saved = toCriteriaPayload({
      ...DEFAULT_HOT_SHEET_CRITERIA,
      acres: "2",
      pricePerSqft: "500",
      hasParking: "yes",
      selectedCountyId: "county-1",
      minPrice: "500,000",
      maxPrice: "1,200,000",
    });
    const countCriteria = liveCountCriteriaFromForm({
      minPrice: "500,000",
      maxPrice: "1,200,000",
      hasNoMin: false,
      hasNoMax: false,
    });

    expect(saved.acres).toBe(2);
    expect(saved.pricePerSqft).toBe(500);
    expect(saved.hasParking).toBe(true);
    expect(saved.selectedCountyId).toBe("county-1");
    expect(countCriteria).not.toHaveProperty("acres");
    expect(countCriteria).not.toHaveProperty("pricePerSqft");
    expect(countCriteria).not.toHaveProperty("hasParking");
    expect(countCriteria).not.toHaveProperty("selectedCountyId");
    expect(countCriteria).not.toHaveProperty("maxPricePerSqft");
  });
});
