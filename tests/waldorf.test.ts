import { describe, expect, it } from "vitest";
import { buildWaldorfCategories, buildWaldorfRecipes } from "../lib/recipes/waldorf";
import { ICE_TYPES, normalizeRecipe } from "../lib/recipes/types";

describe("Waldorf dataset", () => {
  const recipes = buildWaldorfRecipes();

  it("contains all 447 recipes with bilingual names", () => {
    expect(recipes.length).toBe(447);
    for (const r of recipes) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.nameEn.length).toBeGreaterThan(0);
    }
  });

  it("every recipe cites the book as source", () => {
    for (const r of recipes) {
      expect(r.source).toContain("Waldorf");
    }
  });

  it("ice values are within the ICE_TYPES set (or empty)", () => {
    const valid = new Set<string>([...ICE_TYPES, ""]);
    for (const r of recipes) {
      expect(valid.has(r.ice)).toBe(true);
    }
  });

  it("all recipes have ingredients and steps", () => {
    const withIngredients = recipes.filter((r) => r.ingredients.length > 0);
    expect(withIngredients.length / recipes.length).toBeGreaterThan(0.97);
    const withSteps = recipes.filter((r) => r.steps.length > 0);
    expect(withSteps.length / recipes.length).toBeGreaterThan(0.97);
  });

  it("categories include waldorf additions", () => {
    const cats = buildWaldorfCategories();
    expect(cats.length).toBeGreaterThan(0);
    for (const c of cats) {
      expect(c.id.startsWith("cat-waldorf-")).toBe(true);
    }
  });

  it("normalizeRecipe fills ice for legacy data", () => {
    const legacy = normalizeRecipe({ id: "x", name: "测试" });
    expect(legacy.ice).toBe("");
  });
});
