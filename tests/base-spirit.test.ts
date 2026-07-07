import { describe, expect, it } from "vitest";
import {
  baseSpiritLabel,
  detectBaseSpiritsInText,
  detectPrepBaseSpirits,
  primaryBaseSpirit,
} from "../lib/homemade/base-spirit";
import { normalizePrep } from "../lib/homemade/types";

const mkPrep = (over: Record<string, unknown>) =>
  normalizePrep({ id: "t1", name: "", nameAlt: "", ...over } as any);

describe("base-spirit 基酒识别引擎", () => {
  it("从配料表识别金酒", () => {
    const p = mkPrep({
      name: "Earl Grey Infusion",
      nameAlt: "伯爵茶浸渍",
      ingredients: ["700ml 金酒", "10g 伯爵茶叶"],
    });
    expect(detectPrepBaseSpirits(p)).toContain("gin");
    expect(primaryBaseSpirit(p)).toBe("gin");
  });

  it("配料表优先于名称:名称含伏特加但配料是朗姆时取朗姆", () => {
    const p = mkPrep({
      name: "Vodka-Style Punch Base",
      nameAlt: "",
      ingredients: ["500ml 白朗姆", "100g 菠萝"],
    });
    expect(detectPrepBaseSpirits(p)).toEqual(["rum"]);
  });

  it("配料无烈酒时回退名称识别威士忌", () => {
    const p = mkPrep({
      name: "Bacon Fat-Washed Bourbon",
      nameAlt: "培根油脂洗波本",
      ingredients: ["培根脂 50g"],
    });
    expect(detectPrepBaseSpirits(p)).toContain("whisky");
  });

  it("英文文本识别龙舌兰(mezcal)", () => {
    expect(detectBaseSpiritsInText("chili-infused mezcal")).toContain("agave");
  });

  it("无酒精自制品识别为空", () => {
    const p = mkPrep({
      name: "Raspberry Syrup",
      nameAlt: "树莓糖浆",
      ingredients: ["500g 树莓", "500g 白砂糖", "500ml 水"],
      recipe: "小火加热溶解后过滤",
    });
    expect(detectPrepBaseSpirits(p)).toEqual([]);
    expect(primaryBaseSpirit(p)).toBeNull();
  });

  it("双语标签", () => {
    expect(baseSpiritLabel("gin", "zh")).toBe("金酒");
    expect(baseSpiritLabel("gin", "en")).toBe("Gin");
    expect(baseSpiritLabel("wine", "zh")).toBe("葡萄酒与加强酒");
  });

  it("味美思归入葡萄酒与加强酒", () => {
    expect(detectBaseSpiritsInText("干味美思 500ml")).toContain("wine");
  });
});
