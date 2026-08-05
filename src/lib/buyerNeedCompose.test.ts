/**
 * Guards the single canonical Buyer Need workflow.
 *
 * The retired standalone `/submit-client-need` page inserted straight into
 * `client_needs`, which independently launched a second network email
 * campaign through the legacy database trigger. One Buyer Need action must
 * never be able to produce both a broadcast batch and a legacy batch.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BUYER_NEED_COMPOSE_ROUTE,
  BUYER_NEED_DISCLOSURE,
  RETIRED_BUYER_NEED_PATH,
  isBuyerNeedComposeRequested,
} from "./buyerNeedCompose";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(p) && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("canonical Buyer Need compose flow", () => {
  it("points at the Communications Center composer", () => {
    expect(BUYER_NEED_COMPOSE_ROUTE).toBe("/communications?compose=buyer-need");
    expect(isBuyerNeedComposeRequested("?compose=buyer-need")).toBe(true);
    expect(isBuyerNeedComposeRequested("?compose=other")).toBe(false);
    expect(isBuyerNeedComposeRequested("")).toBe(false);
  });

  it("no longer ships the standalone page that inserted and broadcast directly", () => {
    expect(existsSync("src/pages/SubmitClientNeed.tsx")).toBe(false);
  });

  it("redirects the retired path instead of rendering a second workflow", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toContain(RETIRED_BUYER_NEED_PATH);
    expect(app).toMatch(/path="\/submit-client-need"[\s\S]{0,160}Navigate to=\{BUYER_NEED_COMPOSE_ROUTE\}/);
  });

  it("routes every Buyer Need CTA through the canonical flow", () => {
    const offenders = walk("src")
      .filter((f) => f !== "src/App.tsx")
      .filter((f) => /navigate\(\s*["']\/submit-client-need/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no client code inserts directly into client_needs", () => {
    const offenders = walk("src").filter((f) =>
      /from\(\s*["']client_needs["']\s*\)[\s\S]{0,40}\.insert\(/.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("discloses network notification before posting", () => {
    const dialog = readFileSync(
      "src/components/communication-center/SendEmailDialog.tsx",
      "utf8",
    );
    expect(dialog).toContain("BUYER_NEED_DISCLOSURE");
    expect(BUYER_NEED_DISCLOSURE).toMatch(/agents who have opted in/);
  });
});
