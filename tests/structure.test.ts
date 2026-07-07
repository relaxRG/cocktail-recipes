import { describe, expect, it } from "vitest";
import type { Ingredient } from "../lib/recipes/types";
import {
  analyzeStructure,
  inferStructureRole,
  structuralFormula,
} from "../lib/recipes/structure";

const ing = (name: string, amount: string, id = name): Ingredient => ({ id, name, amount });

describe("inferStructureRole", () => {
  it("识别陈酿烈酒基酒", () => {
    expect(inferStructureRole(ing("波本威士忌", "60ml"), 60)).toBe("base_aged");
    expect(inferStructureRole(ing("Cognac VSOP", "50ml"), 50)).toBe("base_aged");
  });
  it("识别纯正烈酒与龙舌兰基酒", () => {
    expect(inferStructureRole(ing("金酒", "45ml"), 45)).toBe("base_white");
    expect(inferStructureRole(ing("特其拉", "50ml"), 50)).toBe("base_agave");
  });
  it("识别鲜榨柑橘酸度调节剂", () => {
    expect(inferStructureRole(ing("鲜青柠汁", "20ml"), 60)).toBe("acid_citrus");
    expect(inferStructureRole(ing("fresh lemon juice", "22ml"), 60)).toBe("acid_citrus");
  });
  it("识别糖浆基甜度平衡剂与利口酒基复合平衡剂", () => {
    expect(inferStructureRole(ing("简单糖浆", "15ml"), 60)).toBe("sweet_syrup");
    expect(inferStructureRole(ing("君度橙皮酒", "20ml"), 60)).toBe("sweet_liqueur");
  });
  it("dash 级苦精为芳香苦精调味剂", () => {
    expect(inferStructureRole(ing("Angostura 苦精", "2 dash"), 60)).toBe("bitters");
  });
  it("识别碳酸延长剂与乳脂/蛋白质构剂", () => {
    expect(inferStructureRole(ing("苏打水", "适量"), 60)).toBe("lengthener_carbonated");
    expect(inferStructureRole(ing("蛋白", "1个"), 60)).toBe("texture_egg");
    expect(inferStructureRole(ing("淡奶油", "30ml"), 60)).toBe("texture_dairy");
  });
  it("识别加强酒修饰核心与苦味修饰剂", () => {
    expect(inferStructureRole(ing("干味美思", "30ml"), 60)).toBe("fortified");
    expect(inferStructureRole(ing("金巴利", "30ml"), 60)).toBe("bitter_modifier");
  });
  it("利口酒为最大量主体时视为利口酒基核心", () => {
    expect(inferStructureRole(ing("咖啡利口酒", "45ml"), 45)).toBe("base_liqueur");
  });
});

describe("analyzeStructure & structuralFormula", () => {
  const daiquiri = [
    ing("白朗姆酒", "60ml"),
    ing("鲜青柠汁", "20ml"),
    ing("简单糖浆", "15ml"),
  ];
  it("按结构权重排序:基酒在前", () => {
    const items = analyzeStructure([daiquiri[1], daiquiri[2], daiquiri[0]]);
    expect(items[0].role).toBe("base_white");
  });
  it("生成精密结构公式文本", () => {
    const f = structuralFormula(daiquiri, "zh");
    expect(f).toBe("纯正烈酒基酒 (60ml) + 鲜榨柑橘酸度调节剂 (20ml) + 糖浆基甜度平衡剂 (15ml)");
  });
  it("英文公式输出", () => {
    const f = structuralFormula(daiquiri, "en");
    expect(f).toContain("White Spirit Core (60ml)");
  });
  it("空配料返回空字符串", () => {
    expect(structuralFormula([], "zh")).toBe("");
  });
});
