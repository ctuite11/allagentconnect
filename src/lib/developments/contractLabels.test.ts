import { describe, expect, it } from "vitest";
import { formatExpectedCompletion } from "./contractLabels";

describe("formatExpectedCompletion", () => {
  it("prefers quarter+year over deprecated date", () => {
    expect(
      formatExpectedCompletion({
        expected_completion_year: 2027,
        expected_completion_quarter: 2,
        estimated_completion: "2027-06-01",
      }),
    ).toBe("Q2 2027");
  });

  it("formats month+year", () => {
    expect(
      formatExpectedCompletion({
        expected_completion_year: 2027,
        expected_completion_month: 6,
      }),
    ).toBe("Jun 2027");
  });

  it("does not combine quarter and month", () => {
    expect(
      formatExpectedCompletion({
        expected_completion_year: 2028,
        expected_completion_quarter: 1,
        expected_completion_month: 3,
      }),
    ).toBe("Q1 2028");
  });
});
