import { describe, expect, it } from "vitest";

import { filterRecipes } from "../lib/recipes/search";
import { sortBottles, sortPreps, sortRecipes } from "../lib/recipes/sort";
import { normalizeRecipe, Recipe } from "../lib/recipes/types";
import { normalizePrep } from "../lib/homemade/types";
import { Bottle, normalizeBottle } from "../lib/bottles/types";

const mkRecipe = (over: Partial<Recipe> & { id: string; name: string }): Recipe =>
  normalizeRecipe(over);

describe("sortRecipes 排序引擎", () => {
  const recipes = [
    mkRecipe({ id: "a", name: "尼格罗尼", nameEn: "Negroni", abv: 24, favorite: false, createdAt: 3 }),
    mkRecipe({ id: "b", name: "金汤力", nameEn: "Gin & Tonic", abv: 8, favorite: true, createdAt: 1 }),
    mkRecipe({ id: "c", name: "马天尼", nameEn: "Martini", abv: 30, favorite: false, createdAt: 2 }),
    mkRecipe({ id: "d", name: "含羞草", nameEn: "Mimosa", abv: null, favorite: false, createdAt: 4 }),
  ];

  it("default 保持原顺序且不修改原数组", () => {
    const out = sortRecipes(recipes, "default");
    expect(out).toBe(recipes);
  });

  it("abvAsc 低到高,null 排末尾", () => {
    const out = sortRecipes(recipes, "abvAsc");
    expect(out.map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("abvDesc 高到低,null 仍在末尾", () => {
    const out = sortRecipes(recipes, "abvDesc");
    expect(out.map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("costAsc 用传入的 costOf,null 排末尾", () => {
    const costs: Record<string, number | null> = { a: 20, b: 8, c: null, d: 15 };
    const out = sortRecipes(recipes, "costAsc", { costOf: (r) => costs[r.id] });
    expect(out.map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("newest 按创建时间倒序", () => {
    const out = sortRecipes(recipes, "newest");
    expect(out.map((r) => r.id)).toEqual(["d", "a", "c", "b"]);
  });

  it("favorites 收藏优先", () => {
    const out = sortRecipes(recipes, "favorites");
    expect(out[0].id).toBe("b");
  });

  it("name 按传入 nameOf 排序", () => {
    const out = sortRecipes(recipes, "name", { nameOf: (r) => r.nameEn });
    expect(out.map((r) => r.nameEn)).toEqual(["Gin & Tonic", "Martini", "Mimosa", "Negroni"]);
  });
});

describe("filterRecipes 多选筛选", () => {
  const recipes = [
    mkRecipe({ id: "a", name: "尼格罗尼", categoryId: "c1", flavors: ["苦韵"], codexFamily: "马天尼 Martini", strength: "strong" }),
    mkRecipe({ id: "b", name: "金汤力", categoryId: "c2", flavors: ["清爽", "柑橘"], codexFamily: "高球 Highball", strength: "light" }),
    mkRecipe({ id: "c", name: "大吉利", categoryId: "c1", flavors: ["酸爽", "柑橘"], codexFamily: "大吉利 Daiquiri", strength: "medium" }),
  ];

  it("categoryIds 多选:命中任一分类", () => {
    const out = filterRecipes(recipes, "", { categoryIds: ["c1"] });
    expect(out.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("flavors 多选:命中任一风味", () => {
    const out = filterRecipes(recipes, "", { flavors: ["柑橘"] });
    expect(out.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("codexFamilies + strengths 组合过滤", () => {
    const out = filterRecipes(recipes, "", {
      codexFamilies: ["高球 Highball", "大吉利 Daiquiri"],
      strengths: ["light"],
    });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("多选优先于单选字段", () => {
    const out = filterRecipes(recipes, "", { categoryId: "c2", categoryIds: ["c1"] });
    expect(out.map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("sortPreps / sortBottles", () => {
  it("自制品按成本排序,null 排末尾", () => {
    const preps = [
      normalizePrep({ id: "p1", name: "糖浆A", createdAt: 1 }),
      normalizePrep({ id: "p2", name: "糖浆B", createdAt: 2 }),
      normalizePrep({ id: "p3", name: "糖浆C", createdAt: 3 }),
    ];
    const costs: Record<string, number | null> = { p1: 5, p2: null, p3: 2 };
    const out = sortPreps(preps, "costAsc", { costOf: (p) => costs[p.id] });
    expect(out.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });

  it("酒款按价格排序,价格 0(未知)排末尾", () => {
    const mkBottle = (id: string, price: number, abv: number): Bottle =>
      normalizeBottle({ id, nameZh: id, category: "金酒", priceCny: price, abv, createdAt: 1 });
    const bottles = [mkBottle("b1", 120, 43), mkBottle("b2", 0, 40), mkBottle("b3", 80, 47)];
    const asc = sortBottles(bottles, "priceAsc");
    expect(asc.map((b) => b.id)).toEqual(["b3", "b1", "b2"]);
    const abvDesc = sortBottles(bottles, "abvDesc");
    expect(abvDesc.map((b) => b.id)).toEqual(["b3", "b1", "b2"]);
  });
});
