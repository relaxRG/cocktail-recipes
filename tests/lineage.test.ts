import { describe, expect, it } from "vitest";

import { analyzeLineage, inferVariantOf } from "../lib/recipes/lineage";

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
