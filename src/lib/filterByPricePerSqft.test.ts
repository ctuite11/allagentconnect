import { describe, expect, it } from "vitest";
import { filterByPricePerSqft } from "./filterByPricePerSqft";

const lovejoy = { status: "off_market", price: 0, price_range_min: 1299000, price_range_max: 1325000, square_feet: 955 };
const fixedPrice = { status: "off_market", price: 700000, square_feet: 1000 };
describe("agent search $/sq ft for range-only Off Market listings", () => {
  it("matches Lovejoy range when it overlaps $1,300–$1,400/sqft", () => {
    expect(filterByPricePerSqft([lovejoy, fixedPrice], "1,300", "1,400")).toEqual([lovejoy]);
    expect(filterByPricePerSqft([lovejoy, fixedPrice], "1,400", "")).toEqual([]);
    expect(filterByPricePerSqft([lovejoy, fixedPrice], "", "1,350")).toEqual([fixedPrice]);
  });
  it("leaves unfiltered results untouched", () => {
    const rows = [lovejoy, fixedPrice, { price: 0, square_feet: 0 }];
    expect(filterByPricePerSqft(rows, "", "")).toBe(rows);
  });
  it("excludes truly missing price/size only with active criteria", () => {
    const rows = [{ price: 0, square_feet: 955 }, { price: 500000, square_feet: 0 }];
    expect(filterByPricePerSqft(rows, "100", "")).toEqual([]);
  });
});
