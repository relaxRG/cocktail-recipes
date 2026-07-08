import { describe, expect, it } from "vitest";

import {
  analyzeLineage,
  inferVariantOf,
  inferCodexFamily,
  normalizeCodexFamilyDecl,
} from "../lib/recipes/lineage";
import { parseRecipeText } from "../lib/recipes/parser";

const ing = (name: string, amount = "30ml") => ({ id: name, name, amount });

const base = {
  name: "",
  nameEn: "",
  baseSpirit: "",
  glass: "",
  method: "",
};

describe("经典变体智能识别引擎", () => {
  it("识别标准尼格罗尼为 Negroni(高置信度)", () => {
    const v = analyzeLineage({
      ...base,
      name: "红调",
      baseSpirit: "金酒",
      method: "搅拌",
      ingredients: [ing("金酒"), ing("金巴利"), ing("甜味美思")],
    });
    expect(v.classic?.en).toBe("Negroni");
    expect(v.confidence).toBe("high");
    expect(v.narrative).toContain("经典源流判定");
    expect(v.narrative).toContain("历史演变因果");
    expect(v.narrative).toContain("文献依据");
  });

  it("Boulevardier(威士忌 Negroni 骨架)判定优先于 Negroni", () => {
    const v = analyzeLineage({
      ...base,
      name: "波本苦味特调",
      baseSpirit: "威士忌",
      method: "搅拌",
      ingredients: [ing("波本威士忌", "45ml"), ing("金巴利"), ing("甜味美思")],
    });
    expect(v.classic?.en).toBe("Boulevardier");
  });

  it("特其拉+君度+青柠判定为 Margarita(Sidecar 族)", () => {
    const v = analyzeLineage({
      ...base,
      name: "龙舌兰酸酒",
      baseSpirit: "龙舌兰",
      method: "摇和",
      ingredients: [ing("特其拉", "50ml"), ing("君度", "20ml"), ing("青柠汁", "15ml")],
    });
    expect(v.classic?.en).toBe("Margarita");
    expect(v.family).toBe("sidecar");
  });

  it("朗姆+青柠+糖浆判定为 Daiquiri", () => {
    const v = analyzeLineage({
      ...base,
      name: "白朗姆酸",
      baseSpirit: "朗姆",
      method: "摇和",
      ingredients: [ing("白朗姆", "60ml"), ing("青柠汁", "25ml"), ing("糖浆", "15ml")],
    });
    expect(v.classic?.en).toBe("Daiquiri");
  });

  it("威士忌+糖+苦精判定为 Old Fashioned", () => {
    const v = analyzeLineage({
      ...base,
      name: "烈性搅拌",
      baseSpirit: "威士忌",
      method: "搅拌",
      ingredients: [ing("黑麦威士忌", "60ml"), ing("方糖", "1块"), ing("安高天娜苦精", "2 dash")],
    });
    expect(v.classic?.en).toBe("Old Fashioned");
  });

  it("名称直接命中经典时拉满置信度", () => {
    const v = analyzeLineage({
      ...base,
      name: "曼哈顿",
      nameEn: "Manhattan",
      baseSpirit: "威士忌",
      ingredients: [ing("黑麦威士忌"), ing("甜味美思")],
    });
    expect(v.classic?.en).toBe("Manhattan");
    expect(v.score).toBeGreaterThanOrEqual(95);
  });

  it("无法匹配的自创配方回退到家族判定并给出决策树说明", () => {
    const v = analyzeLineage({
      ...base,
      name: "神秘特调",
      ingredients: [ing("抹茶", "10g"), ing("燕麦奶", "100ml")],
    });
    expect(v.classic).toBeNull();
    expect(v.confidence).toBe("low");
    expect(v.narrative).toContain("决策树");
  });

  it("inferVariantOf:配方本身即经典时不标注变体", () => {
    expect(
      inferVariantOf({
        ...base,
        name: "尼格罗尼",
        nameEn: "Negroni",
        baseSpirit: "金酒",
        ingredients: [ing("金酒"), ing("金巴利"), ing("甜味美思")],
      }),
    ).toBe("");
  });

  it("inferVariantOf:变体配方返回「中文 English」格式", () => {
    const v = inferVariantOf({
      ...base,
      name: "梅斯卡尔红调",
      baseSpirit: "梅斯卡尔",
      method: "搅拌",
      ingredients: [ing("梅斯卡尔"), ing("金巴利"), ing("甜味美思")],
    });
    expect(v).toMatch(/Negroni|Boulevardier/);
  });

  it("金汤力判定为 Gin & Tonic(Highball 族)", () => {
    const v = analyzeLineage({
      ...base,
      name: "金汤力",
      baseSpirit: "金酒",
      method: "直调",
      ingredients: [ing("金酒", "45ml"), ing("汤力水", "120ml")],
    });
    expect(v.classic?.en).toBe("Gin & Tonic");
    expect(v.family).toBe("highball");
  });
});

describe("Codex Family 智能识别(三级优先级中的引擎判定级)", () => {
  it("normalizeCodexFamilyDecl 规范化中英正名与别名", () => {
    expect(normalizeCodexFamilyDecl("Sidecar")).toBe("边车 Sidecar");
    expect(normalizeCodexFamilyDecl("大吉利")).toBe("大吉利 Daiquiri");
    expect(normalizeCodexFamilyDecl("Sour")).toBe("大吉利 Daiquiri");
    expect(normalizeCodexFamilyDecl("Daisy 雏菊")).toBe("边车 Sidecar");
    expect(normalizeCodexFamilyDecl("spirit-forward")).toBe("马天尼 Martini");
    expect(normalizeCodexFamilyDecl("Collins")).toBe("高球 Highball");
    expect(normalizeCodexFamilyDecl("eggnog")).toBe("菲兹 Flip");
    expect(normalizeCodexFamilyDecl("古典 Old-Fashioned")).toBe("古典 Old-Fashioned");
    expect(normalizeCodexFamilyDecl("随便写的")).toBe("");
    expect(normalizeCodexFamilyDecl("")).toBe("");
  });

  it("柑橘+利口酒甜源 → 边车族(Codex 甜源判据:Margarita 原著归 Sidecar)", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "龙舌兰酸酒",
        baseSpirit: "特其拉",
        method: "摇和",
        ingredients: [ing("特其拉", "50ml"), ing("君度", "20ml"), ing("青柠汁", "15ml")],
      }),
    ).toBe("边车 Sidecar");
  });

  it("柑橘+糖浆 → 大吉利族(Sour 范式)", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "威士忌酸",
        baseSpirit: "威士忌",
        method: "摇和",
        ingredients: [ing("波本威士忌", "45ml"), ing("柠檬汁", "25ml"), ing("糖浆", "15ml")],
      }),
    ).toBe("大吉利 Daiquiri");
  });

  it("Julep → 古典族(Codex 官方:Mint Julep 为 OF 衍生)", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "薄荷朱莉普",
        baseSpirit: "威士忌",
        method: "直调",
        ingredients: [ing("波本威士忌", "60ml"), ing("薄荷叶", "8片"), ing("糖浆", "10ml")],
      }),
    ).toBe("古典 Old-Fashioned");
  });

  it("椰浆乳脂热带(Piña Colada)→ 菲兹 Flip 族(Codex 乳脂判据)", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "椰林飘香",
        baseSpirit: "朗姆",
        method: "搅打",
        ingredients: [ing("白朗姆", "50ml"), ing("椰浆", "50ml"), ing("菠萝汁", "100ml")],
      }),
    ).toBe("菲兹 Flip");
  });

  it("烈酒+加香酒 → 马天尼族;碳酸长饮 → 高球族", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "曼哈顿",
        nameEn: "Manhattan",
        baseSpirit: "威士忌",
        method: "搅拌",
        ingredients: [ing("黑麦威士忌", "50ml"), ing("甜味美思", "20ml"), ing("安高天娜苦精", "2抖")],
      }),
    ).toBe("马天尼 Martini");
    expect(
      inferCodexFamily({
        ...base,
        name: "金汤力",
        baseSpirit: "金酒",
        method: "直调",
        ingredients: [ing("金酒", "45ml"), ing("汤力水", "120ml")],
      }),
    ).toBe("高球 Highball");
  });

  it("证据不足(咸鲜/空配料)不妄断", () => {
    expect(
      inferCodexFamily({
        ...base,
        name: "血腥玛丽",
        nameEn: "Bloody Mary",
        baseSpirit: "伏特加",
        method: "滚动",
        ingredients: [ing("伏特加", "45ml"), ing("番茄汁", "90ml"), ing("伍斯特酱", "2抖")],
      }),
    ).toBe("");
    expect(inferCodexFamily({ ...base, name: "空", ingredients: [] })).toBe("");
  });

  it("parseRecipeText 识别文本明确声明的家族字段并规范化(非法声明不采用)", () => {
    const p = parseRecipeText(
      ["白色丽人 White Lady", "家族:Sidecar", "配料:", "金酒 40ml", "君度 30ml", "柠檬汁 20ml"].join("\n"),
    );
    expect(p.codexFamily).toBe("边车 Sidecar");
    const p2 = parseRecipeText(["测试酒", "Codex Family: Sour", "配料:", "朗姆 45ml"].join("\n"));
    expect(p2.codexFamily).toBe("大吉利 Daiquiri");
    const p3 = parseRecipeText(["无声明酒", "配料:", "金酒 45ml"].join("\n"));
    expect(p3.codexFamily).toBe("");
  });
});
