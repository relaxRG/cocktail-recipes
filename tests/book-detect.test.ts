import { describe, expect, it } from "vitest";
import {
  classifyCandidateKind,
  detectRecipesInBook,
  detectRecipesInText,
} from "../lib/import/detect";
import { batchImagesForOcr, htmlToText } from "../lib/import/extract";

describe("htmlToText", () => {
  it("块级标签断行,标题转 ## 前缀", () => {
    const html = "<h2>Martinez</h2><p>1.5 oz gin</p><p>0.75 oz sweet vermouth</p>";
    const text = htmlToText(html);
    expect(text).toContain("## Martinez");
    expect(text).toContain("1.5 oz gin");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("解码 HTML 实体并去除 script/style", () => {
    const html = "<style>p{}</style><p>Tom &amp; Jerry &#189; oz</p>";
    const text = htmlToText(html);
    expect(text).toBe("Tom & Jerry ½ oz");
  });
});

describe("detectRecipesInText", () => {
  it("识别英文鸡尾酒配方(名称+配料+做法)", () => {
    const text = [
      "## Old Fashioned",
      "2 oz bourbon",
      "1 tsp sugar",
      "2 dashes Angostura bitters",
      "Stir with ice, strain into rocks glass, garnish with orange peel.",
    ].join("\n");
    const found = detectRecipesInText(text, "Chapter O");
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Old Fashioned");
    expect(found[0].kind).toBe("cocktail");
    expect(found[0].parsed.ingredients.length).toBe(3);
    expect(found[0].parsed.steps).toContain("Stir");
    expect(found[0].sectionTitle).toBe("Chapter O");
  });

  it("识别中文配方", () => {
    const text = ["内格罗尼", "金酒 30ml", "金巴利 30ml", "甜味美思 30ml", "搅拌法,古典杯,橙皮装饰。"].join(
      "\n",
    );
    const found = detectRecipesInText(text);
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("内格罗尼");
    expect(found[0].parsed.glass).toBe("古典杯");
  });

  it("糖浆配方判为 prep", () => {
    const text = [
      "Ginger Syrup",
      "200 ml water",
      "200 g sugar",
      "50 g fresh ginger",
      "Simmer 15 minutes, strain and bottle.",
    ].join("\n");
    const found = detectRecipesInText(text);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("prep");
  });

  it("同一段文本中的多个配方分别识别", () => {
    const text = [
      "Daiquiri",
      "2 oz white rum",
      "1 oz lime juice",
      "0.75 oz simple syrup",
      "Shake and strain into coupe.",
      "",
      "Gimlet",
      "2 oz gin",
      "0.75 oz lime cordial",
      "Shake with ice.",
    ].join("\n");
    const found = detectRecipesInText(text);
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.name)).toEqual(["Daiquiri", "Gimlet"]);
  });

  it("普通叙述文字不产生候选", () => {
    const text = [
      "The bar opened in 1893 and quickly became famous.",
      "Many guests visited over the years.",
      "It closed during Prohibition.",
    ].join("\n");
    expect(detectRecipesInText(text)).toHaveLength(0);
  });

  it("配料不足 2 行不算配方", () => {
    const text = ["Some Title", "2 oz gin", "A long paragraph about history follows here."].join("\n");
    expect(detectRecipesInText(text)).toHaveLength(0);
  });
});

describe("classifyCandidateKind", () => {
  const parsedBase = {
    name: "",
    ingredients: [] as { id: string; name: string; amount: string }[],
    steps: "",
    glass: "",
    method: "",
    garnish: "",
    baseSpirit: "",
    variantOf: "",
    codexFamily: "",
    source: "",
  };

  it("名称含糖浆关键词 → prep", () => {
    expect(classifyCandidateKind("蜂蜜糖浆", { ...parsedBase })).toBe("prep");
    expect(classifyCandidateKind("Demerara Syrup", { ...parsedBase })).toBe("prep");
    expect(classifyCandidateKind("House-made Falernum", { ...parsedBase })).toBe("prep");
  });

  it("含烈酒配料的普通名称 → cocktail", () => {
    const parsed = {
      ...parsedBase,
      ingredients: [{ id: "1", name: "gin", amount: "2 oz" }],
    };
    expect(classifyCandidateKind("Martinez", parsed)).toBe("cocktail");
  });
});

describe("batchImagesForOcr", () => {
  const img = (len: number) => ({ base64: "x".repeat(len), mime: "image/jpeg" });

  it("按张数上限分批", () => {
    const batches = batchImagesForOcr(Array.from({ length: 14 }, () => img(10)), 6);
    expect(batches.map((b) => b.length)).toEqual([6, 6, 2]);
  });

  it("按体积预算分批", () => {
    const batches = batchImagesForOcr([img(60), img(60), img(60)], 6, 100);
    expect(batches.map((b) => b.length)).toEqual([1, 1, 1]);
  });

  it("空输入返回空数组", () => {
    expect(batchImagesForOcr([])).toEqual([]);
  });
});

describe("detectRecipesInBook", () => {
  it("跨章节汇总并按名称去重", () => {
    const recipeText = [
      "Daiquiri",
      "2 oz white rum",
      "1 oz lime juice",
      "0.75 oz simple syrup",
      "Shake and strain.",
    ].join("\n");
    const found = detectRecipesInBook([
      { title: "Ch 1", text: recipeText },
      { title: "Ch 2", text: recipeText },
    ]);
    expect(found).toHaveLength(1);
  });
});
