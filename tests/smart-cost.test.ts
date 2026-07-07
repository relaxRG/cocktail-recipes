import { describe, expect, it } from "vitest";

import { buildWaldorfBottles, buildWaldorfPreps } from "../lib/bottles/waldorf-ingredients";
import { estimateRecipeCostSmart, parseAmountLoose } from "../lib/recipes/smart-cost";

const bottles = buildWaldorfBottles();
const preps = buildWaldorfPreps();

describe("parseAmountLoose", () => {
  it("parses standard oz amounts", () => {
    expect(parseAmountLoose("2 oz.")).toBeCloseTo(60, 0);
  });
  it("parses dash amounts", () => {
    expect(parseAmountLoose("2 dashes")).toBeCloseTo(1.8, 1);
  });
  it("parses barspoon amounts", () => {
    expect(parseAmountLoose("1 bar spoon")).toBeCloseTo(5, 0);
  });
  it("returns null for unparseable amounts", () => {
    expect(parseAmountLoose("适量")).toBeNull();
  });
});

describe("estimateRecipeCostSmart", () => {
  it("costs branded bitters via smart link (old engine failed on these)", () => {
    const est = estimateRecipeCostSmart(
      [{ id: "1", name: "Angostura 苦精", amount: "2 dashes" }],
      bottles,
      preps,
    );
    expect(est.items[0].link).not.toBeNull();
    expect(est.items[0].cost).not.toBeNull();
    expect(est.total).toBeGreaterThan(0);
  });

  it("costs a classic recipe with a positive total", () => {
    const est = estimateRecipeCostSmart(
      [
        { id: "1", name: "黑麦威士忌", amount: "2 oz." },
        { id: "2", name: "甜味美思", amount: "1 oz." },
        { id: "3", name: "Angostura 苦精", amount: "2 dashes" },
      ],
      bottles,
      preps,
    );
    expect(est.estimatedCount).toBeGreaterThanOrEqual(2);
    expect(est.total).toBeGreaterThan(0);
  });

  it("reports no_match for generic non-products", () => {
    const est = estimateRecipeCostSmart(
      [{ id: "1", name: "冷水", amount: "1 oz." }],
      bottles,
      preps,
    );
    expect(est.items[0].cost).toBeNull();
    expect(est.items[0].reason).toBe("no_match");
  });

  it("reports no_amount when quantity is unparseable but product matched", () => {
    const est = estimateRecipeCostSmart(
      [{ id: "1", name: "金酒", amount: "适量" }],
      bottles,
      preps,
    );
    expect(est.items[0].link).not.toBeNull();
    expect(est.items[0].reason).toBe("no_amount");
  });
});
