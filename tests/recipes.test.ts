import { describe, expect, it } from "vitest";

import { filterRecipes } from "../lib/recipes/search";
import { buildDefaultCategories, buildSampleRecipes } from "../lib/recipes/seed";
import { genId } from "../lib/recipes/types";

describe("recipes data layer", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => genId()));
    expect(ids.size).toBe(200);
  });

  it("builds default categories and sample recipes", () => {
    const cats = buildDefaultCategories();
    expect(cats.length).toBe(4);
    const recipes = buildSampleRecipes();
    expect(recipes.length).toBe(4);
    const catIds = new Set(cats.map((c) => c.id));
    for (const r of recipes) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.ingredients.length).toBeGreaterThan(0);
      if (r.categoryId) expect(catIds.has(r.categoryId)).toBe(true);
    }
  });

  it("filters by name query (case-insensitive)", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "negroni", {});
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("尼格罗尼");
  });

  it("filters by ingredient name", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "薄荷", {});
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("莫吉托");
  });

  it("filters by category", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "", { categoryId: "cat-classic" });
    expect(result.length).toBe(3);
  });

  it("filters favorites only", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "", { favoritesOnly: true });
    expect(result.length).toBe(1);
    expect(result[0].favorite).toBe(true);
  });

  it("combines query and category filter", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "威士忌", { categoryId: "cat-classic" });
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("威士忌酸");
  });

  it("returns all when query empty and no filters", () => {
    const recipes = buildSampleRecipes();
    expect(filterRecipes(recipes, "", {}).length).toBe(recipes.length);
  });
});
