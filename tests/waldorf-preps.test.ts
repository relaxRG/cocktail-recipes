import { describe, expect, it } from "vitest";
import { buildWaldorfBottles, buildWaldorfPreps, findFullPrepByName } from "../lib/bottles/waldorf-ingredients";
import { buildWaldorfRecipes } from "../lib/recipes/waldorf";
import { smartLinkIngredient } from "../lib/recipes/smart-link";
import { estimatePrepCost, parseQuantity } from "../lib/homemade/cost";
import { matchPrep } from "../lib/homemade/match";

const bottles = buildWaldorfBottles();
const preps = buildWaldorfPreps();
const fullPreps = preps.filter((p) => p.recipe.trim());

describe("Waldorf 自制原料数据集", () => {
  it("包含 48 条带完整做法的条目", () => {
    expect(fullPreps.length).toBe(48);
  });

  it("每条完整条目都有双语名、配料、做法与产量", () => {
    for (const p of fullPreps) {
      expect(p.name.trim()).not.toBe("");
      expect(p.nameAlt.trim()).not.toBe("");
      expect(p.ingredients.length).toBeGreaterThan(0);
      expect(p.recipe.trim()).not.toBe("");
      expect(p.yield.trim()).not.toBe("");
    }
  });

  it("findFullPrepByName 可按别名归一(红石榴/德麦拉拉/Gomme)", () => {
    expect(findFullPrepByName("自制红石榴糖浆")?.name).toBe("Grenadine");
    expect(findFullPrepByName("Homemade Demerara Syrup")?.name).toBe("Demerara Syrup");
    expect(findFullPrepByName("Gomme Syrup")?.name).toBe("Gum Syrup");
  });
});

describe("Waldorf 配方自制引用链接覆盖", () => {
  it("447 份配方中全部自制类引用 100% 命中", () => {
    const recipes = buildWaldorfRecipes();
    const RE = /自制|house-?made|homemade|infused|浸渍/i;
    let total = 0;
    let hit = 0;
    const cache = new Map<string, boolean>();
    for (const r of recipes) {
      for (const ing of r.ingredients) {
        if (!RE.test(ing.name)) continue;
        total += 1;
        let ok = cache.get(ing.name);
        if (ok === undefined) {
          ok = smartLinkIngredient(ing.name, bottles, preps) != null;
          cache.set(ing.name, ok);
        }
        if (ok) hit += 1;
      }
    }
    expect(total).toBeGreaterThanOrEqual(110);
    expect(hit).toBe(total);
  });

  it("覆盆子/草莓糖浆经别名表归一到 Berry Syrup", () => {
    expect(matchPrep("自制覆盆子糖浆", preps)?.name).toContain("Berry Syrup");
    expect(matchPrep("自制草莓糖浆", preps)?.name).toContain("Berry Syrup");
  });
});

describe("自制品成本贯通", () => {
  it("48 条完整条目配料行全部可估算成本", () => {
    for (const p of fullPreps) {
      const est = estimatePrepCost(p, bottles);
      expect(est.estimatedCount, `${p.name} 缺配料成本`).toBe(est.totalCount);
      expect(est.batchCost).toBeGreaterThan(0);
    }
  });

  it("parseQuantity 支持分数与美制量词", () => {
    expect(parseQuantity("¼ oz. almond extract")).toEqual({ qty: 7.5, unit: "ml" });
    expect(parseQuantity("½ c. peeled ginger")).toEqual({ qty: 120, unit: "ml" });
    expect(parseQuantity("⅛ tsp. ground cinnamon")).toEqual({ qty: 0.625, unit: "ml" });
    expect(parseQuantity("2 tbsp. horseradish")).toEqual({ qty: 30, unit: "ml" });
    expect(parseQuantity("1 750 ml. bottle Galliano")).toEqual({ qty: 750, unit: "ml" });
    expect(parseQuantity("Peel/rind of 4 lemons")).toEqual({ qty: 4, unit: "piece" });
    expect(parseQuantity("12 lemongrass leaves, chopped")).toEqual({ qty: 12, unit: "piece" });
  });

  it("小粒香料按件计价不虚高(12 丁香 < ¥1)", () => {
    const aromatic = fullPreps.find((p) => p.name === "Aromatic Bitters")!;
    const est = estimatePrepCost(aromatic, bottles);
    const cloveLine = est.items.find((i) => /12 cloves/.test(i.line))!;
    expect(cloveLine.cost).not.toBeNull();
    expect(cloveLine.cost!).toBeLessThan(1);
  });

  it("糖浆类每 30ml 成本在合理区间(¥0.1-2)", () => {
    for (const name of ["Simple Syrup", "Demerara Syrup", "Honey Syrup", "Grenadine"]) {
      const p = fullPreps.find((x) => x.name === name)!;
      const est = estimatePrepCost(p, bottles);
      expect(est.costPer30Ml, name).not.toBeNull();
      expect(est.costPer30Ml!).toBeGreaterThan(0.1);
      expect(est.costPer30Ml!).toBeLessThan(2);
    }
  });
});
