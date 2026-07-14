import { describe, expect, it } from "vitest";

import { filterBottles } from "../lib/bottles/store";
import { buildDefaultBottles } from "../lib/bottles/seed";
import {
  BOTTLE_CATEGORIES,
  bottleGroupOf,
  categoriesOfGroup,
  migrateBottleCategory,
  normalizeBottle,
} from "../lib/bottles/types";
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
import {
  CODEX_FAMILIES,
  bandsOfStrength,
  buildDefaultTags,
  genId,
  normalizeRecipe,
  strengthOfBand,
} from "../lib/recipes/types";
import { buildSamplePreps } from "../lib/homemade/seed";
import { filterPreps } from "../lib/homemade/store";
import { matchPrep, suggestPrep } from "../lib/homemade/match";
import {
  estimateHomemadeIngredientCost,
  estimatePrepCost,
  matchMaterial,
  matchMaterialBottle,
  parsePackToUnit,
  parseQuantity,
  parseYieldToMl,
} from "../lib/homemade/cost";
import { suggestIngredients } from "../lib/suggest";
import { displayNames } from "../lib/utils";
import { analyzeUnknownIngredient, classifyIngredient, splitBilingualName } from "../lib/classify";
import {
  PREP_SECTIONS,
  PREP_TYPES,
  buildDefaultPrepSections,
  buildDefaultPrepTypes,
  joinPrepIngredient,
  prepSectionLabel,
  prepSectionOf,
  prepSectionLabelIn,
  prepSectionOfIn,
  prepTypeLabelIn,
  prepTypeLabel,
  splitPrepIngredientLine,
} from "../lib/homemade/types";

describe("homemade preps", () => {
  it("splits stored ingredient lines into amount + name for structured editing", () => {
    expect(splitPrepIngredientLine("200g white sugar 白砂糖")).toEqual({
      amount: "200g",
      name: "white sugar 白砂糖",
    });
    expect(splitPrepIngredientLine("100ml fresh ginger juice")).toEqual({
      amount: "100ml",
      name: "fresh ginger juice",
    });
    expect(splitPrepIngredientLine("1 vanilla bean")).toEqual({
      amount: "1",
      name: "vanilla bean",
    });
    expect(splitPrepIngredientLine("2根 香草荚")).toEqual({
      amount: "2根",
      name: "香草荚",
    });
    expect(splitPrepIngredientLine("约300ml 伏特加")).toEqual({
      amount: "约300ml",
      name: "伏特加",
    });
    // No leading quantity → whole line is the name
    expect(splitPrepIngredientLine("Angostura bitters")).toEqual({
      amount: "",
      name: "Angostura bitters",
    });
    expect(splitPrepIngredientLine("")).toEqual({ amount: "", name: "" });
  });

  it("round-trips split + join back to the stored line format", () => {
    const lines = [
      "200g white sugar 白砂糖",
      "100ml fresh ginger juice",
      "1 vanilla bean",
      "Angostura bitters",
    ];
    for (const line of lines) {
      const { amount, name } = splitPrepIngredientLine(line);
      expect(joinPrepIngredient(amount, name)).toBe(line);
    }
    expect(joinPrepIngredient("", "")).toBe("");
    expect(joinPrepIngredient("50ml", "")).toBe("50ml");
  });

  it("merges raw-material cost library into bottle library with group split", () => {
    const bottles = buildDefaultBottles();
    const materials = bottles.filter((b) => bottleGroupOf(b.category) === "materials");
    expect(materials.length).toBeGreaterThanOrEqual(40);
    for (const m of materials) {
      expect(m.priceCny).toBeGreaterThan(0);
      expect(parsePackToUnit(m.volume)).not.toBeNull();
      expect(m.abv).toBe(0);
    }
    expect(bottleGroupOf("原材料")).toBe("materials");
    expect(bottleGroupOf("金酒")).toBe("spirits");
    expect(bottleGroupOf("威士忌")).toBe("spirits");
    expect(bottleGroupOf("利口酒")).toBe("bottles");
    expect(categoriesOfGroup("materials")).toContain("糖与甜味剂");
    expect(categoriesOfGroup("materials")).toContain("果蔬");
    expect(categoriesOfGroup("materials")).toContain("花卉");
    expect(categoriesOfGroup("materials")).not.toContain("原材料");
    expect(categoriesOfGroup("bottles")).not.toContain("原材料");
    expect(categoriesOfGroup("bottles")).not.toContain("金酒");
    expect(categoriesOfGroup("spirits")).toContain("金酒");
    expect(BOTTLE_CATEGORIES).toContain("糖与甜味剂");
    expect(BOTTLE_CATEGORIES).toContain("乳蛋");
    expect(BOTTLE_CATEGORIES).not.toContain("原材料");
  });

  it("moves fresh juices out of bottle seed into homemade samples", () => {
    const bottles = buildDefaultBottles();
    expect(
      bottles.some((b) => /^fresh (lime|lemon|orange) juice$/i.test(b.nameEn.trim())),
    ).toBe(false);
    const preps = buildSamplePreps();
    const juices = preps.filter((p) => p.type === "juice");
    expect(juices.length).toBeGreaterThanOrEqual(3);
    expect(juices.some((p) => /lime/i.test(p.name))).toBe(true);
    expect(juices.some((p) => /lemon/i.test(p.name))).toBe(true);
    expect(juices.some((p) => /orange/i.test(p.name))).toBe(true);
  });

  it("parses pack sizes for material pricing", () => {
    expect(parsePackToUnit("1kg")).toEqual({ qty: 1000, unit: "g" });
    expect(parsePackToUnit("500g")).toEqual({ qty: 500, unit: "g" });
    expect(parsePackToUnit("500ml")).toEqual({ qty: 500, unit: "ml" });
    expect(parsePackToUnit("1L")).toEqual({ qty: 1000, unit: "ml" });
    expect(parsePackToUnit("10枚")).toEqual({ qty: 10, unit: "piece" });
    expect(parsePackToUnit("1根")).toEqual({ qty: 1, unit: "piece" });
    expect(parsePackToUnit("")).toBeNull();
  });

  it("prefers bottle-library material prices over built-in table in prep cost", () => {
    const bottles = buildDefaultBottles();
    const sugar = bottles.find((b) => b.nameEn === "White Sugar")!;
    expect(sugar).toBeTruthy();
    const hit = matchMaterialBottle("200g white sugar 白砂糖", bottles);
    expect(hit?.id).toBe(sugar.id);
    const prep = {
      id: "p1",
      name: "Simple Syrup",
      nameAlt: "单糖浆",
      type: "syrup",
      ingredients: ["200g white sugar 白砂糖", "200g hot water 热水"],
      recipe: "stir",
      yield: "~300ml",
      shelfLife: "",
      storage: "",
      notes: "",
    flavorTags: [],
    story: "",
    styleDesc: "",
      builtin: false,
      createdAt: 0,
      updatedAt: 0,
    };
    const est = estimatePrepCost(prep as any, bottles);
    const sugarItem = est.items[0];
    expect(sugarItem.bottleId).toBe(sugar.id);
    expect(sugarItem.cost).toBeCloseTo((sugar.priceCny / 1000) * 200, 5);
    // After user edits the library price, the estimate follows
    const edited = bottles.map((b) => (b.id === sugar.id ? { ...b, priceCny: 16 } : b));
    const est2 = estimatePrepCost(prep as any, edited);
    expect(est2.items[0].cost).toBeCloseTo(3.2, 5);
  });

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
    expect(prepSectionOf("infusion")).toBe("infused-spirit");
    expect(prepSectionOf("bitters")).toBe("bitters-tincture");
    expect(prepSectionOf("fermented")).toBe("homemade-spirit");
    expect(prepSectionOf("unknown")).toBe("misc");
    expect(prepSectionLabel("homemade-liqueur", "zh")).toBe("自制利口酒");
    expect(prepSectionLabel("homemade-liqueur", "en")).toBe("House Liqueurs & Cordials");
  });

  it("filters preps by section and samples cover new sections", () => {
    const preps = buildSamplePreps();
    const sections = new Set(preps.map((p) => prepSectionOf(p.type)));
    for (const key of ["homemade-syrup", "homemade-liqueur", "homemade-spirit"]) {
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

  it("classifies unknown ingredients into bottle / material / homemade", () => {
    // Spirits & mixers → bottle library with the right category
    const vodka = classifyIngredient("Grey Goose Vodka");
    expect(vodka?.library).toBe("bottle");
    expect(vodka?.category).toBe("伏特加");
    const whisky = classifyIngredient("高原骑士威士忌");
    expect(whisky?.library).toBe("bottle");
    expect(whisky?.category).toBe("威士忌");
    const tonic = classifyIngredient("Fever Tree Tonic");
    expect(tonic?.library).toBe("bottle");
    expect(tonic?.category).toBe("软饮");
    // Raw ingredients → material library with sub-category style
    const sugar = classifyIngredient("Muscovado Sugar");
    expect(sugar?.library).toBe("material");
    expect(sugar?.category).toBe("糖与甜味剂");
    const herb = classifyIngredient("鼠尾草叶");
    expect(herb?.library).toBe("material");
    expect(herb?.category).toBe("香料与草本");
    // Homemade-style items → homemade library with prep type
    const syrup = classifyIngredient("Rosemary Syrup");
    expect(syrup?.library).toBe("homemade");
    expect(syrup?.category).toBe("syrup");
    const infusion = classifyIngredient("Chili-Infused Tequila");
    expect(infusion?.library).toBe("homemade");
    expect(infusion?.category).toBe("infusion");
    // Unknown fallback → material with low confidence
    const unknown = classifyIngredient("Dragon Pearl");
    expect(unknown?.library).toBe("material");
    expect(unknown!.confidence).toBeLessThan(0.5);
  });

  it("splits bilingual names into en/zh prefill", () => {
    const r = splitBilingualName("Rosemary Syrup 迷迭香糖浆");
    expect(r.en).toBe("Rosemary Syrup");
    expect(r.zh).toBe("迷迭香糖浆");
    const zhOnly = splitBilingualName("迷迭香糖浆");
    expect(zhOnly.en).toBe("");
    expect(zhOnly.zh).toBe("迷迭香糖浆");
  });

  it("analyzeUnknownIngredient skips ingredients already in a library", () => {
    const bottles = buildDefaultBottles();
    const preps = buildSamplePreps();
    // Existing bottle / material / homemade entries → null (nothing to add)
    expect(analyzeUnknownIngredient("Gin", bottles, preps)).toBeNull();
    expect(analyzeUnknownIngredient("汤力水", bottles, preps)).toBeNull();
    expect(analyzeUnknownIngredient("Simple Syrup", bottles, preps)).toBeNull();
    // Truly unknown → classification suggestion
    const c = analyzeUnknownIngredient("Batavia Arrack", bottles, preps);
    expect(c).not.toBeNull();
    const rosemary = analyzeUnknownIngredient("Rosemary Honey Syrup", bottles, preps);
    expect(rosemary?.library).toBe("homemade");
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

  it("builds editable default sections/types and resolves labels from custom lists", () => {
    const sections = buildDefaultPrepSections();
    const types = buildDefaultPrepTypes();
    expect(sections.map((s) => s.key)).toEqual(PREP_SECTIONS.map((s) => s.key));
    expect(types.map((t) => t.key)).toEqual(PREP_TYPES.map((t) => t.key));

    // Custom rename + custom section flow through the *In helpers
    const customSections = [
      { key: "my-sec", zh: "我的分区", en: "My Section" },
      ...sections,
    ];
    const customTypes = types.map((t) =>
      t.key === "syrup" ? { ...t, zh: "改名糖浆", en: "Renamed Syrup", section: "my-sec" } : t,
    );
    expect(prepTypeLabelIn(customTypes, "syrup", "zh")).toBe("改名糖浆");
    expect(prepTypeLabelIn(customTypes, "syrup", "en")).toBe("Renamed Syrup");
    expect(prepSectionOfIn(customTypes, "syrup")).toBe("my-sec");
    expect(prepSectionLabelIn(customSections, "my-sec", "zh")).toBe("我的分区");
    expect(prepSectionLabelIn(customSections, "my-sec", "en")).toBe("My Section");
    // Unknown keys fall back gracefully
    expect(prepTypeLabelIn(customTypes, "nope", "en")).toBe("nope");
    expect(prepSectionOfIn(customTypes, "nope")).toBe("misc");

    // New custom type is filterable
    const preps = buildSamplePreps().map((p, i) =>
      i === 0 ? { ...p, type: "my-type" } : p,
    );
    const withCustomType = [
      ...customTypes,
      { key: "my-type", zh: "自定义类型", en: "Custom Type", section: "my-sec" },
    ];
    const hits = filterPreps(preps, "", "my-type", undefined, withCustomType);
    expect(hits.length).toBe(1);
    const secHits = filterPreps(preps, "", undefined, "my-sec", withCustomType);
    expect(secHits.some((p) => p.type === "my-type")).toBe(true);
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
    expect(flavors.length).toBe(17);
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

describe("bilingual tags", () => {
  it("default tags and categories carry English names", () => {
    const tags = buildDefaultTags();
    for (const tag of tags) {
      expect((tag.nameEn ?? "").length).toBeGreaterThan(0);
    }
    const cats = buildDefaultCategories();
    for (const c of cats) {
      expect((c.nameEn ?? "").length).toBeGreaterThan(0);
    }
  });

  it("auto-fills the other language when adding common tag names", async () => {
    const { autoFillTagNames, migrateTagNameEn } = await import("../lib/recipes/types");
    // zh input → en auto-filled from dictionary
    expect(autoFillTagNames("金酒").nameEn).toMatch(/gin/i);
    // en input → zh name resolved from reverse dictionary
    const gin = autoFillTagNames("Gin");
    expect(gin.name).toContain("金酒");
    expect(gin.nameEn).toBe("Gin");
    // unknown English name keeps itself on both sides
    const unknown = autoFillTagNames("Dragon Pearl Foam");
    expect(unknown.name).toBe("Dragon Pearl Foam");
    expect(unknown.nameEn).toBe("Dragon Pearl Foam");
    // unknown Chinese name keeps zh, leaves en empty
    const zhUnknown = autoFillTagNames("龙珠泡沫");
    expect(zhUnknown.name).toBe("龙珠泡沫");
    expect(zhUnknown.nameEn).toBe("");
    // legacy data migration fills nameEn from dictionary
    const migrated = migrateTagNameEn<{ name: string; nameEn?: string }>({ name: "金酒" });
    expect(migrated.nameEn).toMatch(/gin/i);
    const untouched = migrateTagNameEn({ name: "金酒", nameEn: "Custom Gin" });
    expect(untouched.nameEn).toBe("Custom Gin");
  });

  it("displayNames gives language-priority rendering for tags", () => {
    expect(displayNames("Gin", "金酒", "en").primary).toBe("Gin");
    expect(displayNames("Gin", "金酒", "zh").primary).toBe("金酒");
    // Missing English name falls back to Chinese
    expect(displayNames("", "自定义标签", "en").primary).toBe("自定义标签");
  });
});

describe("strength bands (ABV ranges)", () => {
  it("maps bands to broad strength: <15 light, 15-25 medium, 25+ strong", () => {
    expect(strengthOfBand("lt10")).toBe("light");
    expect(strengthOfBand("b10_15")).toBe("light");
    expect(strengthOfBand("b15_20")).toBe("medium");
    expect(strengthOfBand("b20_25")).toBe("medium");
    expect(strengthOfBand("b25_30")).toBe("strong");
    expect(strengthOfBand("b30_35")).toBe("strong");
    expect(strengthOfBand("gt35")).toBe("strong");
  });

  it("groups bands under each strength for form display", () => {
    expect(bandsOfStrength("light")).toEqual(["lt10", "b10_15"]);
    expect(bandsOfStrength("medium")).toEqual(["b15_20", "b20_25"]);
    expect(bandsOfStrength("strong")).toEqual(["b25_30", "b30_35", "gt35"]);
  });

  it("normalizeRecipe keeps old data working and fixes inconsistent strength", () => {
    const legacy = normalizeRecipe({ id: "r1", name: "Old", strength: "medium" } as any);
    expect(legacy.strengthBand).toBe("");
    expect(legacy.strength).toBe("medium");
    const fixed = normalizeRecipe({ id: "r2", name: "X", strength: "light", strengthBand: "gt35" } as any);
    expect(fixed.strength).toBe("strong");
  });
});
