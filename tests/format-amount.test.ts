import { describe, expect, it } from "vitest";

import { formatAmountAsMl } from "../lib/bottles/cost";
import { estimateIngredientCostSmart, isPerishableWholeBottle } from "../lib/recipes/smart-cost";
import type { Bottle } from "../lib/bottles/types";

describe("formatAmountAsMl 液体单位换算", () => {
  it("oz 转 ml", () => {
    expect(formatAmountAsMl("1 oz.")).toBe("30ml");
    expect(formatAmountAsMl("1.5 oz.")).toBe("45ml");
    expect(formatAmountAsMl("0.25 oz.")).toBe("7.5ml");
  });
  it("dash/吧勺/茶匙 转 ml", () => {
    expect(formatAmountAsMl("2 dashes")).toBe("1.8ml");
    expect(formatAmountAsMl("1 bar spoon")).toBe("5ml");
    expect(formatAmountAsMl("1茶匙")).toBe("5ml");
  });
  it("已是 ml 的规范化", () => {
    expect(formatAmountAsMl("45ml")).toBe("45ml");
  });
});

describe("formatAmountAsMl 非液体计数保留原文", () => {
  const keep = [
    "1 个",
    "0.5 个",
    "12片",
    "2 块",
    "1 只",
    "适量",
    "少许",
    "Pinch",
    "1 sugar cube",
    "10 leaves",
    "12 mint",
    "3 cloves",
    "1 whole",
    "1 small",
    "0.5 egg white",
    "1 wedge",
    "1 peel",
    "rind of 1 lime",
    "8-10 leaves",
    "4 large ice cubes",
    "Toasted",
    "0.5 lime",
    "3 slices",
  ];
  for (const a of keep) {
    it(`保留 "${a}"`, () => {
      expect(formatAmountAsMl(a)).toBe(a);
    });
  }
  it("小纯数字视为计数不转换,大数字按 ml 简写", () => {
    expect(formatAmountAsMl("1")).toBe("1");
    expect(formatAmountAsMl("2")).toBe("2");
    expect(formatAmountAsMl("45")).toBe("45ml");
  });
  it("含 or/或 的多方案不转换", () => {
    expect(formatAmountAsMl("1 tsp. or 2 cubes")).toBe("1 tsp. or 2 cubes");
    expect(formatAmountAsMl("3 oz. or 2 oz.")).toBe("3 oz. or 2 oz.");
  });
});

function mkBottle(partial: Partial<Bottle>): Bottle {
  return {
    id: "b1",
    nameZh: "",
    nameEn: "",
    category: "软饮",
    style: "",
    brand: "",
    origin: "",
    volume: "330ml",
    abv: 0,
    priceCny: 3.5,
    notes: "",
    builtin: false,
    flavorTags: [],
    story: "",
    styleDesc: "",
    rating: null,
    sortIndex: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe("易失效产品按整瓶计成本", () => {
  it("软饮类识别为整瓶计", () => {
    expect(isPerishableWholeBottle(mkBottle({ nameZh: "可口可乐", nameEn: "Coca-Cola" }))).toBe(true);
    expect(isPerishableWholeBottle(mkBottle({ nameZh: "怡泉汤力水", nameEn: "Schweppes Tonic", category: "软饮" }))).toBe(true);
    expect(
      isPerishableWholeBottle(mkBottle({ nameZh: "农夫山泉橙汁", nameEn: "NFC Orange Juice", category: "原材料" })),
    ).toBe(true);
  });
  it("糖浆/苦精/鲜榨不按整瓶", () => {
    expect(isPerishableWholeBottle(mkBottle({ nameZh: "简单糖浆", nameEn: "Simple Syrup", category: "糖浆" }))).toBe(false);
    expect(isPerishableWholeBottle(mkBottle({ nameZh: "安高天娜苦精", nameEn: "Angostura Bitters", category: "苦精" }))).toBe(false);
    expect(
      isPerishableWholeBottle(mkBottle({ nameZh: "鲜榨柠檬汁", nameEn: "Fresh Lemon Juice", category: "原材料" })),
    ).toBe(false);
  });
  it("成本按整瓶价计,用量保持真实份量", () => {
    const cola = mkBottle({ nameZh: "可口可乐", nameEn: "Coca-Cola", volume: "330ml", priceCny: 3.5 });
    const r = estimateIngredientCostSmart({ id: "i1", name: "可口可乐", amount: "90ml" }, [cola], []);
    expect(r.wholeBottle).toBe(true);
    expect(r.cost).toBe(3.5);
    expect(r.amountMl).toBe(90);
  });
});
