import { describe, expect, it } from "vitest";

import { filterBottles } from "../lib/bottles/store";
import { buildDefaultBottles } from "../lib/bottles/seed";
import { normalizeBottle } from "../lib/bottles/types";
import {
  estimateRecipeCost,
  matchBottle,
  parseAmountToMl,
  parseVolumeToMl,
} from "../lib/bottles/cost";
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

  it("reorders tags within a kind while preserving other kinds", () => {
    // 模拟 store 中 reorderTags 的核心逻辑
    const tags = buildDefaultTags();
    const flavors = tags.filter((t) => t.kind === "flavor");
    const others = tags.filter((t) => t.kind !== "flavor");
    const orderedIds = [...flavors.map((t) => t.id)].reverse();
    const map = new Map(flavors.map((t) => [t.id, t]));
    const next: typeof flavors = [];
    for (const id of orderedIds) {
      const item = map.get(id);
      if (item) {
        next.push(item);
        map.delete(id);
      }
    }
    const result = [...others, ...next];
    expect(result.length).toBe(tags.length);
    const resultFlavors = result.filter((t) => t.kind === "flavor");
    expect(resultFlavors[0].name).toBe(flavors[flavors.length - 1].name);
    expect(resultFlavors[resultFlavors.length - 1].name).toBe(flavors[0].name);
  });
});

describe("bottle database", () => {
  it("builds default bottles with required fields", () => {
    const bottles = buildDefaultBottles();
    expect(bottles.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(bottles.map((b) => b.id));
    expect(ids.size).toBe(bottles.length);
    for (const b of bottles) {
      expect(b.nameZh.length).toBeGreaterThan(0);
      expect(b.nameEn.length).toBeGreaterThan(0);
      expect(b.category.length).toBeGreaterThan(0);
      expect(b.abv).toBeGreaterThanOrEqual(0);
      expect(b.abv).toBeLessThanOrEqual(100);
      expect(b.priceCny).toBeGreaterThanOrEqual(0);
    }
  });

  it("filters bottles by chinese name, english name and category", () => {
    const bottles = buildDefaultBottles();
    expect(filterBottles(bottles, "君度").length).toBe(1);
    expect(filterBottles(bottles, "cointreau").length).toBe(1);
    const gins = filterBottles(bottles, "", "金酒");
    expect(gins.length).toBeGreaterThan(0);
    expect(gins.every((b) => b.category === "金酒")).toBe(true);
    // 组合:分类 + 关键词
    expect(filterBottles(bottles, "hendrick", "金酒").length).toBe(1);
  });

  it("normalizes bottles with missing fields", () => {
    const b = normalizeBottle({ id: "x1", nameZh: "测试酒" });
    expect(b.category).toBe("其他");
    expect(b.abv).toBe(0);
    expect(b.priceCny).toBe(0);
    expect(b.builtin).toBe(false);
  });
});

describe("cost estimation", () => {
  it("parses amounts in various units to ml", () => {
    expect(parseAmountToMl("45ml")).toBe(45);
    expect(parseAmountToMl("1.5 oz")).toBe(45);
    expect(parseAmountToMl("1/2 oz")).toBe(15);
    expect(parseAmountToMl("1 1/2 oz")).toBe(45);
    expect(parseAmountToMl("2 dash")).toBeCloseTo(1.8);
    expect(parseAmountToMl("30 毫升")).toBe(30);
    expect(parseAmountToMl("1 bar spoon")).toBe(5);
    expect(parseAmountToMl("45")).toBe(45);
    expect(parseAmountToMl("适量")).toBeNull();
    expect(parseAmountToMl("")).toBeNull();
  });

  it("parses bottle volume to ml", () => {
    expect(parseVolumeToMl("700ml")).toBe(700);
    expect(parseVolumeToMl("1000ml")).toBe(1000);
    expect(parseVolumeToMl("75cl")).toBe(750);
    expect(parseVolumeToMl("1L")).toBe(1000);
    expect(parseVolumeToMl("")).toBeNull();
  });

  it("matches ingredients to bottles by name/brand", () => {
    const bottles = buildDefaultBottles();
    expect(matchBottle("金巴利", bottles)?.nameEn).toBe("Campari");
    expect(matchBottle("Campari", bottles)?.nameZh).toBe("金巴利");
    expect(matchBottle("君度橙酒", bottles)?.nameEn).toBe("Cointreau");
    // 类别兜底:泛称"金酒"匹配该分类中最便宜的酒款
    const gin = matchBottle("金酒", bottles);
    expect(gin?.category).toBe("金酒");
    expect(matchBottle("完全不存在的东西xyz", bottles)).toBeNull();
  });

  it("estimates recipe cost from matched bottles", () => {
    const bottles = buildDefaultBottles();
    // 尼格罗尼:金酒30ml + 金巴利30ml + 甜味美思30ml
    const est = estimateRecipeCost(
      [
        { id: "1", name: "金酒", amount: "30ml" },
        { id: "2", name: "金巴利", amount: "30ml" },
        { id: "3", name: "马天尼红味美思", amount: "30ml" },
        { id: "4", name: "橙皮", amount: "1片" },
      ],
      bottles,
    );
    expect(est.totalCount).toBe(4);
    expect(est.estimatedCount).toBe(3);
    expect(est.total).toBeGreaterThan(5);
    expect(est.total).toBeLessThan(50);
    // 金巴利 150元/750ml * 30ml = 6元
    const campari = est.items.find((i) => i.ingredient.name === "金巴利");
    expect(campari?.cost).toBeCloseTo(6, 1);
  });

  it("estimates cost for seed recipes end-to-end (negroni & whiskey sour)", () => {
    const bottles = buildDefaultBottles();
    const recipes = buildSampleRecipes();
    const negroni = recipes.find((r) => r.name.includes("尼格罗尼"));
    expect(negroni).toBeDefined();
    const est = estimateRecipeCost(negroni!.ingredients, bottles);
    // 金酒/金巴利/甜味美思 三项均应可估算
    expect(est.estimatedCount).toBe(3);
    expect(est.total).toBeGreaterThan(5);

    const sour = recipes.find((r) => r.name.includes("威士忌酸"));
    expect(sour).toBeDefined();
    const est2 = estimateRecipeCost(sour!.ingredients, bottles);
    // 波本威士忌应可估算;蛋白无法估算但不报错
    const bourbon = est2.items.find((i) => i.ingredient.name.includes("波本"));
    expect(bourbon?.cost).not.toBeNull();
    const egg = est2.items.find((i) => i.ingredient.name.includes("蛋白"));
    expect(egg?.cost).toBeNull();
  });
});
