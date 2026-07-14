import { describe, expect, it } from "vitest";
import { parseAmountLoose } from "../lib/recipes/smart-cost";
import { estimateIngredientCostSmart } from "../lib/recipes/smart-cost";
import type { Bottle } from "../lib/bottles/types";
import type { Ingredient } from "../lib/recipes/types";

// Helper: create a minimal Bottle
function makeBottle(overrides: Partial<Bottle> & { nameZh: string }): Bottle {
  return {
    id: "test-1",
    nameEn: "",
    category: "茶咖与可可",
    style: "",
    brand: "",
    origin: "",
    volume: "",
    abv: 0,
    priceCny: 0,
    notes: "",
    flavorTags: [],
    story: "",
    styleDesc: "",
    builtin: false,
    rating: null,
    sortIndex: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeIngredient(name: string, amount: string): Ingredient {
  return { name, amount, unit: "", notes: "" };
}

describe("parseAmountLoose with ingredientName", () => {
  it("passes ingredientName to parseAmountToMl for oz context", () => {
    // Liquid oz → converts normally
    expect(parseAmountLoose("1.5 oz", "金酒")).toBeCloseTo(45, 0);
    // Solid oz → returns null (weight oz, no ml conversion)
    expect(parseAmountLoose("1 oz", "可可粉")).toBeNull();
  });

  it("resolves 适量 bitters via resolveAmbiguousUnit", () => {
    expect(parseAmountLoose("适量", "苦精")).toBeCloseTo(0.9, 1);
  });

  it("resolves 适量 soda via resolveAmbiguousUnit", () => {
    expect(parseAmountLoose("适量", "苏打水")).toBeCloseTo(60, 0);
  });

  it("resolves 几滴 via resolveAmbiguousUnit", () => {
    expect(parseAmountLoose("几滴", "苦精")).toBeCloseTo(0.15, 2);
  });

  it("resolves 一瓶 beer via resolveAmbiguousUnit", () => {
    expect(parseAmountLoose("一瓶", "啤酒")).toBeCloseTo(330, 0);
  });

  it("returns null for 适量 unknown ingredient", () => {
    expect(parseAmountLoose("适量", "神秘配料")).toBeNull();
  });

  it("backward compat: works without ingredientName", () => {
    expect(parseAmountLoose("1.5 oz")).toBeCloseTo(45, 0);
    expect(parseAmountLoose("2 dash")).toBeCloseTo(1.8, 1);
  });
});

describe("estimateIngredientCostSmart solid oz path", () => {
  it("calculates cost via weightG when solid oz is used", () => {
    const cocoaPowder = makeBottle({
      id: "cocoa-1",
      nameZh: "可可粉",
      nameEn: "Cocoa Powder",
      category: "茶咖与可可",
      priceCny: 50,   // ¥50
      weightG: 100,   // 100g package
    });
    const ing = makeIngredient("可可粉", "1 oz");
    // 1 oz = 28.35g; price per gram = 50/100 = 0.5; cost = 0.5 * 28.35 = 14.175
    const result = estimateIngredientCostSmart(ing, [cocoaPowder], []);
    expect(result.cost).not.toBeNull();
    if (result.cost !== null) {
      expect(result.cost).toBeCloseTo(14.175, 1);
    }
  });

  it("falls back to no_amount when solid oz but no weightG", () => {
    const cocoaPowder = makeBottle({
      id: "cocoa-2",
      nameZh: "可可粉",
      nameEn: "Cocoa Powder",
      category: "茶咖与可可",
      priceCny: 50,
      // No weightG
    });
    const ing = makeIngredient("可可粉", "1 oz");
    const result = estimateIngredientCostSmart(ing, [cocoaPowder], []);
    // Without weightG and no volume set, reason is no_volume (price exists but volume missing)
    expect(result.reason).toBe("no_volume");
  });
});
