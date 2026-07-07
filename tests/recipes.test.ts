import { describe, expect, it } from "vitest";

import { filterRecipes } from "../lib/recipes/search";
import { buildDefaultCategories, buildSampleRecipes } from "../lib/recipes/seed";
import { CODEX_FAMILIES, buildDefaultTags, genId, normalizeRecipe } from "../lib/recipes/types";

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

  it("filters by codex family", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "", { codexFamily: "高球 Highball" });
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("莫吉托");
  });

  it("filters by flavor tag", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "", { flavor: "草本" });
    expect(result.length).toBe(2);
  });

  it("searches by variantOf text", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "边车", {});
    expect(result.some((r) => r.name.includes("玛格丽特"))).toBe(true);
  });

  it("normalizes legacy recipes without new fields", () => {
    const legacy = {
      id: "old-1",
      name: "旧配方",
      categoryId: null,
      baseSpirit: "金酒",
      glass: "",
      method: "摇和",
      strength: "medium",
      ingredients: [],
      steps: "",
      garnish: "",
      notes: "",
      favorite: false,
      createdAt: 1,
      updatedAt: 1,
    } as any;
    const normalized = normalizeRecipe(legacy);
    expect(normalized.variantOf).toBe("");
    expect(normalized.codexFamily).toBe("");
    expect(normalized.flavors).toEqual([]);
    expect(normalized.source).toBe("");
  });

  it("exposes six codex families", () => {
    expect(CODEX_FAMILIES.length).toBe(6);
  });

  it("searches by source text", () => {
    const recipes = buildSampleRecipes();
    const result = filterRecipes(recipes, "iba", {});
    expect(result.length).toBe(1);
    expect(result[0].name).toContain("尼格罗尼");
  });

  it("builds default tags for spirit, glass and flavor", () => {
    const tags = buildDefaultTags();
    const spirits = tags.filter((t) => t.kind === "spirit");
    const glasses = tags.filter((t) => t.kind === "glass");
    const flavors = tags.filter((t) => t.kind === "flavor");
    expect(spirits.length).toBeGreaterThan(0);
    expect(glasses.length).toBeGreaterThan(0);
    expect(flavors.length).toBe(10);
    // 每个标签都有颜色且 id 唯一
    const ids = new Set(tags.map((t) => t.id));
    expect(ids.size).toBe(tags.length);
    expect(tags.every((t) => /^#[0-9A-Fa-f]{6}$/.test(t.color))).toBe(true);
  });
});
