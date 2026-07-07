import { describe, expect, it } from "vitest";

import { filterBottles } from "../lib/bottles/store";
import { buildDefaultBottles } from "../lib/bottles/seed";
import { BOTTLE_CATEGORIES, migrateBottleCategory, normalizeBottle } from "../lib/bottles/types";
import {
  estimateRecipeCost,
  formatAmountAsMl,
  matchBottle,
  normalizeIngredientName,
  parseAmountToMl,
  parseVolumeToMl,
} from "../lib/bottles/cost";
import { filterRecipes } from "../lib/recipes/search";
import { buildDefaultCategories, buildSampleRecipes } from "../lib/recipes/seed";
import { parseRecipeText, splitIngredientLine, looksLikeIngredientLine } from "../lib/recipes/parser";
import { CODEX_FAMILIES, buildDefaultTags, genId, normalizeRecipe } from "../lib/recipes/types";
import { buildSamplePreps } from "../lib/homemade/seed";
import { filterPreps } from "../lib/homemade/store";
import { matchPrep, suggestPrep } from "../lib/homemade/match";
import {
  estimateHomemadeIngredientCost,
  estimatePrepCost,
  matchMaterial,
  parseQuantity,
  parseYieldToMl,
} from "../lib/homemade/cost";
import { suggestIngredients } from "../lib/suggest";
import { displayNames } from "../lib/utils";
import {
  PREP_SECTIONS,
  PREP_TYPES,
  prepSectionLabel,
  prepSectionOf,
  prepTypeLabel,
} from "../lib/homemade/types";

describe("homemade preps", () => {
  it("builds sample preps with required fields and unique ids", () => {
    const preps = buildSamplePreps();
    expect(preps.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(preps.map((p) => p.id));
    expect(ids.size).toBe(preps.length);
    const typeKeys = new Set(PREP_TYPES.map((t) => t.key));
    for (const p of preps) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeKeys.has(p.type)).toBe(true);
      expect(p.ingredients.length).toBeGreaterThan(0);
      expect(p.recipe.length).toBeGreaterThan(0);
    }
  });

  it("filters preps by query (bilingual) and type", () => {
    const preps = buildSamplePreps();
    // English & Chinese search both hit simple syrup
    const en = filterPreps(preps, "simple syrup");
    expect(en.length).toBeGreaterThanOrEqual(1);
    const zh = filterPreps(preps, "糖浆");
    expect(zh.length).toBeGreaterThanOrEqual(1);
    // ingredient search
    const ging = filterPreps(preps, "ginger");
    expect(ging.length).toBeGreaterThanOrEqual(1);
    // type filter
    const syrups = filterPreps(preps, "", "syrup");
    expect(syrups.every((p) => p.type === "syrup")).toBe(true);
    // combined
    expect(filterPreps(preps, "不存在xyz").length).toBe(0);
  });

  it("resolves prep type labels bilingually", () => {
    expect(prepTypeLabel("syrup", "zh")).toBe("糖浆");
    expect(prepTypeLabel("syrup", "en")).toBe("Syrup");
    expect(prepTypeLabel("unknown-key", "en")).toBe("unknown-key");
  });

  it("groups prep types into process sections", () => {
    const sectionKeys = new Set(PREP_SECTIONS.map((s) => s.key));
    for (const pt of PREP_TYPES) {
      expect(sectionKeys.has(pt.section)).toBe(true);
    }
    expect(prepSectionOf("syrup")).toBe("homemade-syrup");
    expect(prepSectionOf("liqueur")).toBe("homemade-liqueur");
    expect(prepSectionOf("infusion")).toBe("flavored-liquid");
    expect(prepSectionOf("fermented")).toBe("homemade-spirit");
    expect(prepSectionOf("unknown")).toBe("misc");
    expect(prepSectionLabel("homemade-liqueur", "zh")).toBe("自制利口酒");
    expect(prepSectionLabel("homemade-liqueur", "en")).toBe("Homemade Liqueurs");
  });

  it("filters preps by section and samples cover new sections", () => {
    const preps = buildSamplePreps();
    const sections = new Set(preps.map((p) => prepSectionOf(p.type)));
    for (const key of ["homemade-syrup", "homemade-liqueur", "flavored-liquid", "homemade-spirit"]) {
      expect(sections.has(key)).toBe(true);
    }
    const liqueurs = filterPreps(preps, "", undefined, "homemade-liqueur");
    expect(liqueurs.length).toBeGreaterThanOrEqual(2);
    expect(liqueurs.every((p) => prepSectionOf(p.type) === "homemade-liqueur")).toBe(true);
    // section + type combined
    const syrupsOnly = filterPreps(preps, "", "syrup", "homemade-syrup");
    expect(syrupsOnly.every((p) => p.type === "syrup")).toBe(true);
  });

  it("matches recipe ingredients to homemade preps bilingually", () => {
    const preps = buildSamplePreps();
    // English exact / partial
    const m1 = matchPrep("Simple Syrup", preps);
    expect(m1?.name.toLowerCase()).toContain("simple syrup");
    // Chinese name matches nameAlt
    const m2 = matchPrep("蜂蜜糖浆", preps);
    expect(m2).not.toBeNull();
    // Qualifier stripped (homemade / 自制 prefix)
    const m3 = matchPrep("自制姜糖浆", preps);
    expect(m3).not.toBeNull();
    const m4 = matchPrep("homemade orgeat", preps);
    expect(m4?.name.toLowerCase()).toContain("orgeat");
    // No weak false positives
    expect(matchPrep("Gin", preps)).toBeNull();
    expect(matchPrep("青柠汁", preps)?.name ?? null).not.toBe(undefined);
  });

  it("suggests homemade prep templates for known unmatched ingredients", () => {
    const s1 = suggestPrep("Cinnamon Syrup");
    expect(s1?.type).toBe("syrup");
    expect(s1?.name).toBe("Cinnamon Syrup");
    const s2 = suggestPrep("法勒南");
    expect(s2?.type).toBe("cordial");
    const s3 = suggestPrep("咖啡利口酒");
    expect(s3?.type).toBe("liqueur");
    const s4 = suggestPrep("chili-infused tequila");
    expect(s4?.type).toBe("infusion");
    expect(s4?.name).toBe("chili-infused tequila");
    // Non-homemade ingredients yield no suggestion
    expect(suggestPrep("Angostura Bitters (bottled)")).toBeNull();
    expect(suggestPrep("Lime Juice")).toBeNull();
  });

  it("live-suggests ingredients from bottles and homemade preps with language priority", () => {
    const bottles = buildDefaultBottles();
    const preps = buildSamplePreps();
    // English query hits both libraries; homemade ranks first on equal score
    const en = suggestIngredients("syrup", bottles, preps, "en");
    expect(en.length).toBeGreaterThan(0);
    expect(en.some((s) => s.source === "homemade")).toBe(true);
    // English UI: primary value should be English when available
    const enHit = en.find((s) => s.source === "homemade");
    expect(enHit && /[a-z]/i.test(enHit.value)).toBe(true);
    // Chinese query matches Chinese names, zh UI returns Chinese primary
    const zh = suggestIngredients("糖浆", bottles, preps, "zh");
    expect(zh.length).toBeGreaterThan(0);
    expect(zh.some((s) => /[\u4e00-\u9fff]/.test(s.value))).toBe(true);
    // Single latin char yields nothing; single CJK char is allowed
    expect(suggestIngredients("g", bottles, preps, "en").length).toBe(0);
    expect(suggestIngredients("姜", bottles, preps, "zh").length).toBeGreaterThan(0);
    // Limit respected
    expect(suggestIngredients("a", bottles, preps, "en", 6).length).toBeLessThanOrEqual(6);
  });

  it("displayNames follows UI language with fallback", () => {
    expect(displayNames("Simple Syrup", "简单糖浆", "en")).toEqual({
      primary: "Simple Syrup",
      secondary: "简单糖浆",
    });
    expect(displayNames("Simple Syrup", "简单糖浆", "zh")).toEqual({
      primary: "简单糖浆",
      secondary: "Simple Syrup",
    });
    // Fallback when preferred name missing
    expect(displayNames("", "简单糖浆", "en")).toEqual({ primary: "简单糖浆", secondary: "" });
    expect(displayNames("Orgeat", "", "zh")).toEqual({ primary: "Orgeat", secondary: "" });
  });

  it("parses ingredient quantities in mixed units", () => {
    expect(parseQuantity("500g white sugar 白砂糖")).toEqual({ qty: 500, unit: "g" });
    expect(parseQuantity("1kg 冰糖")).toEqual({ qty: 1000, unit: "g" });
    expect(parseQuantity("700ml London dry gin 伦敦干金")).toEqual({ qty: 700, unit: "ml" });
    expect(parseQuantity("1L water 水")).toEqual({ qty: 1000, unit: "ml" });
    expect(parseQuantity("2 vanilla beans 香草荚")).toEqual({ qty: 2, unit: "piece" });
    expect(parseQuantity("适量盐")).toBeNull();
  });

  it("matches materials to Chinese market reference prices", () => {
    expect(matchMaterial("500g white sugar 白砂糖")?.zh).toBe("白砂糖");
    expect(matchMaterial("250g honey 蜂蜜")?.zh).toBe("蜂蜜");
    expect(matchMaterial("100g fresh ginger juice 鲜姜汁")?.zh).toBe("鲜姜");
    expect(matchMaterial("700ml vodka 伏特加")?.en).toBe("Vodka");
    expect(matchMaterial("神秘材料xyz")).toBeNull();
  });

  it("estimates homemade prep batch and unit costs", () => {
    const bottles = buildDefaultBottles();
    const preps = buildSamplePreps();
    const simple = preps.find((p) => /simple syrup/i.test(p.name))!;
    const est = estimatePrepCost(simple, bottles);
    expect(est.estimatedCount).toBeGreaterThan(0);
    expect(est.batchCost).toBeGreaterThan(0);
    // Simple syrup (500g sugar + 500ml water) should be cheap: < ¥10 per batch
    expect(est.batchCost).toBeLessThan(10);
    if (est.yieldMl) {
      expect(est.costPer30Ml).not.toBeNull();
      expect(est.costPer30Ml!).toBeGreaterThan(0);
    }
    expect(parseYieldToMl("~750ml")).toBe(750);
    expect(parseYieldToMl("约1.5L")).toBe(1500);
    expect(parseYieldToMl("")).toBeNull();
  });

  it("costs recipe ingredients via homemade prep unit cost", () => {
    const bottles = buildDefaultBottles();
    const preps = buildSamplePreps();
    const hit = estimateHomemadeIngredientCost("Simple Syrup", "15ml", preps, bottles);
    expect(hit).not.toBeNull();
    expect(hit!.cost).toBeGreaterThan(0);
    expect(hit!.amountMl).toBe(15);
    // Unknown ingredient yields null
    expect(estimateHomemadeIngredientCost("神秘材料xyz", "15ml", preps, bottles)).toBeNull();
  });
});

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
    const zhHits = filterBottles(bottles, "君度");
    expect(zhHits.length).toBeGreaterThanOrEqual(1);
    expect(zhHits.some((b) => b.nameEn === "Cointreau")).toBe(true);
    const enHits = filterBottles(bottles, "cointreau");
    expect(enHits.length).toBeGreaterThanOrEqual(1);
    expect(enHits.some((b) => b.nameZh === "君度橙酒")).toBe(true);
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

  it("expanded bottle database has 200+ entries", () => {
    const bottles = buildDefaultBottles();
    expect(bottles.length).toBeGreaterThanOrEqual(200);
  });

  it("covers all major categories", () => {
    const bottles = buildDefaultBottles();
    const cats = new Set(bottles.map((b) => b.category));
    for (const c of [
      "金酒", "朗姆", "伏特加", "威士忌", "龙舌兰", "白兰地",
      "利口酒", "苦精", "味美思", "开胃酒", "起泡酒", "葡萄酒",
      "清酒烧酒", "中式白酒", "糖浆", "软饮",
    ]) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it("every bottle has valid category and bilingual names", () => {
    const bottles = buildDefaultBottles();
    for (const b of bottles) {
      expect((BOTTLE_CATEGORIES as readonly string[]).includes(b.category)).toBe(true);
      expect(b.nameZh.length).toBeGreaterThan(0);
      expect(b.nameEn.length).toBeGreaterThan(0);
    }
  });

  it("migrates legacy 软饮糖浆 category into 糖浆 or 软饮", () => {
    expect(
      migrateBottleCategory({ category: "软饮糖浆", style: "Syrup", nameEn: "Monin Grenadine", nameZh: "莫林红石榴糖浆" }),
    ).toBe("糖浆");
    expect(
      migrateBottleCategory({ category: "软饮糖浆", style: "Tonic", nameEn: "Schweppes Tonic Water", nameZh: "怡泉汤力水" }),
    ).toBe("软饮");
    expect(
      migrateBottleCategory({ category: "软饮糖浆", style: "", nameEn: "Anchor Whipping Cream", nameZh: "安佳淡奶油" }),
    ).toBe("糖浆");
    expect(
      migrateBottleCategory({ category: "软饮糖浆", style: "", nameEn: "Coca-Cola", nameZh: "可口可乐" }),
    ).toBe("软饮");
    // non-legacy categories are untouched
    expect(
      migrateBottleCategory({ category: "金酒", style: "London Dry", nameEn: "Beefeater", nameZh: "必富达金酒" }),
    ).toBe("金酒");
  });

  it("filters bottles by style sub-category", () => {
    const bottles = buildDefaultBottles();
    const londonDry = filterBottles(bottles, "", "金酒", "London Dry");
    expect(londonDry.length).toBeGreaterThanOrEqual(3);
    expect(londonDry.every((b) => b.category === "金酒" && b.style === "London Dry")).toBe(true);
    const bourbons = filterBottles(bottles, "", "威士忌", "Bourbon");
    expect(bourbons.length).toBeGreaterThanOrEqual(1);
    expect(bourbons.every((b) => b.style === "Bourbon")).toBe(true);
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

  it("formats amounts uniformly as ml", () => {
    expect(formatAmountAsMl("1.5 oz")).toBe("45ml");
    expect(formatAmountAsMl("1/2 oz")).toBe("15ml");
    expect(formatAmountAsMl("2 dash")).toBe("1.8ml");
    expect(formatAmountAsMl("1 吧勺")).toBe("5ml");
    expect(formatAmountAsMl("45ml")).toBe("45ml");
    expect(formatAmountAsMl("45")).toBe("45ml");
    // 非液体计量保留原文
    expect(formatAmountAsMl("1片")).toBe("1片");
    expect(formatAmountAsMl("8-10片")).toBe("8-10片");
    expect(formatAmountAsMl("适量")).toBe("适量");
    expect(formatAmountAsMl("薄荷叶 8片")).toBe("薄荷叶 8片");
  });
});

describe("recipe text parser", () => {
  it("detects and splits ingredient lines", () => {
    expect(looksLikeIngredientLine("金酒 45ml")).toBe(true);
    expect(looksLikeIngredientLine("- 青柠汁 3/4 oz")).toBe(true);
    expect(looksLikeIngredientLine("将所有材料摇和后滤入杯中即可享用")).toBe(false);

    expect(splitIngredientLine("金酒 45ml")).toEqual({ name: "金酒", amount: "45ml" });
    expect(splitIngredientLine("- 金巴利 30 ml")).toEqual({ name: "金巴利", amount: "30 ml" });
    expect(splitIngredientLine("2 dash 安高天娜苦精")).toEqual({
      name: "安高天娜苦精",
      amount: "2 dash",
    });
  });

  it("parses sectioned recipe text", () => {
    const text = [
      "金色黄昏",
      "配料:",
      "金酒 45ml",
      "柠檬汁 20ml",
      "蜂蜜糖浆 15ml",
      "做法:",
      "1. 摇酒壶加冰",
      "2. 摇和15秒后滤入库佩杯",
      "装饰:",
      "柠檬皮",
      "来源:自创",
    ].join("\n");
    const p = parseRecipeText(text);
    expect(p.name).toBe("金色黄昏");
    expect(p.ingredients.length).toBe(3);
    expect(p.ingredients[0]).toMatchObject({ name: "金酒", amount: "45ml" });
    expect(p.steps).toContain("摇酒壶加冰");
    expect(p.garnish).toBe("柠檬皮");
    expect(p.source).toBe("自创");
    expect(p.glass).toBe("库佩杯");
    expect(p.method).toBe("摇和");
    expect(p.baseSpirit).toBe("金酒");
  });

  it("parses unsectioned free-form text", () => {
    const text = [
      "玛格丽特",
      "龙舌兰 50ml",
      "君度 20ml",
      "青柠汁 15ml",
      "杯口抹盐,摇和后滤入马天尼杯。",
    ].join("\n");
    const p = parseRecipeText(text);
    expect(p.name).toBe("玛格丽特");
    expect(p.ingredients.length).toBe(3);
    expect(p.steps).toContain("杯口抹盐");
    expect(p.baseSpirit).toBe("龙舌兰");
  });

  it("handles empty input gracefully", () => {
    const p = parseRecipeText("   \n  ");
    expect(p.name).toBe("");
    expect(p.ingredients.length).toBe(0);
  });

  it("parses English recipe text", () => {
    const text = [
      "Negroni",
      "Ingredients:",
      "1 oz Gin",
      "1 oz Campari",
      "1 oz Sweet Vermouth",
      "Method:",
      "Stir with ice and strain into a rocks glass.",
      "Garnish:",
      "Orange peel",
    ].join("\n");
    const p = parseRecipeText(text);
    expect(p.name).toBe("Negroni");
    expect(p.ingredients.length).toBe(3);
    expect(p.ingredients[0]).toMatchObject({ name: "Gin", amount: "1 oz" });
    expect(p.garnish).toBe("Orange peel");
    expect(p.method).toBe("搅拌");
    expect(p.glass).toBe("古典杯");
    expect(p.baseSpirit).toBe("金酒");
  });

  it("parses English free-form text with part units", () => {
    const text = [
      "Daiquiri",
      "2 parts White Rum",
      "3/4 part Lime Juice",
      "1/2 part Simple Syrup",
      "Shake with ice and double strain into a coupe.",
    ].join("\n");
    const p = parseRecipeText(text);
    expect(p.name).toBe("Daiquiri");
    expect(p.ingredients.length).toBe(3);
    expect(p.method).toBe("摇和");
    expect(p.glass).toBe("库佩杯");
    expect(p.baseSpirit).toBe("朗姆");
  });
});

describe("bilingual support", () => {
  it("normalizes English ingredient names to Chinese", () => {
    expect(normalizeIngredientName("Gin")).toBe("金酒");
    expect(normalizeIngredientName("Sweet Vermouth")).toBe("甜味美思");
    expect(normalizeIngredientName("Lime Juice")).toBe("青柠汁");
    expect(normalizeIngredientName("金酒")).toBe("金酒");
  });

  it("matches bottles for English ingredient names", () => {
    const bottles = buildDefaultBottles();
    expect(matchBottle("Gin", bottles)?.category).toBe("金酒");
    expect(matchBottle("Campari", bottles)?.nameZh).toContain("金巴利");
    const sweet = matchBottle("Sweet Vermouth", bottles);
    expect(sweet).not.toBeNull();
    expect(/甜|红|rosso/i.test((sweet?.nameZh ?? "") + (sweet?.nameEn ?? "") + (sweet?.notes ?? ""))).toBe(true);
  });

  it("estimates cost for a fully English recipe", () => {
    const bottles = buildDefaultBottles();
    const est = estimateRecipeCost(
      [
        { id: "i1", name: "Gin", amount: "1 oz" },
        { id: "i2", name: "Campari", amount: "1 oz" },
        { id: "i3", name: "Sweet Vermouth", amount: "1 oz" },
      ],
      bottles,
    );
    expect(est.estimatedCount).toBe(3);
    expect(est.total).toBeGreaterThan(5);
  });

  it("formats English amounts as ml but keeps non-liquid words", () => {
    expect(formatAmountAsMl("1 oz")).toBe("30ml");
    expect(formatAmountAsMl("2 dashes")).toBe("1.8ml");
    expect(formatAmountAsMl("1 slice")).toBe("1 slice");
    expect(formatAmountAsMl("2 mint sprigs")).toBe("2 mint sprigs");
  });

  it("search matches across Chinese and English ingredient names", () => {
    const recipes = buildSampleRecipes();
    // 中文配料库,英文词搜索应能命中(gin -> 金酒)
    const byEnglish = filterRecipes(recipes, "gin", {});
    expect(byEnglish.some((r) => r.ingredients.some((i) => i.name.includes("金酒")))).toBe(true);

    // 构造英文配料的配方,用中文搜索应能命中
    const english = {
      ...recipes[0],
      id: "en-1",
      name: "English Negroni",
      ingredients: [
        { id: "e1", name: "Gin", amount: "30ml" },
        { id: "e2", name: "Campari", amount: "30ml" },
      ],
    };
    const byChinese = filterRecipes([english], "金酒", {});
    expect(byChinese.length).toBe(1);
  });
});
