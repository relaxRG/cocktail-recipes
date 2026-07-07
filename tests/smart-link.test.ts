import { describe, expect, it } from "vitest";
import { smartLinkIngredient, smartLinkAll } from "../lib/recipes/smart-link";
import type { Bottle } from "../lib/bottles/types";
import type { HomemadePrep } from "../lib/homemade/types";

const bottle = (partial: Partial<Bottle>): Bottle =>
  ({
    id: "b-" + Math.random().toString(36).slice(2, 8),
    nameZh: "",
    nameEn: "",
    brand: "",
    category: "金酒",
    style: "",
    volume: "700ml",
    priceCny: 100,
    abv: 40,
    notes: "",
    rating: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  }) as unknown as Bottle;

const prep = (partial: Partial<HomemadePrep>): HomemadePrep =>
  ({
    id: "p-" + Math.random().toString(36).slice(2, 8),
    name: "",
    nameAlt: "",
    type: "syrup",
    ...partial,
  }) as unknown as HomemadePrep;

const bottles: Bottle[] = [
  bottle({ nameZh: "必富达金酒", nameEn: "Beefeater London Dry Gin", brand: "Beefeater", category: "金酒" }),
  bottle({ nameZh: "安高天娜苦精", nameEn: "Angostura Aromatic Bitters", category: "苦精", priceCny: 88 }),
  bottle({ nameZh: "甜味美思", nameEn: "Sweet Vermouth", category: "味美思", notes: "rosso 甜型" }),
  bottle({ nameZh: "柠檬", nameEn: "Lemon", category: "原材料", priceCny: 2 }),
];

const preps: HomemadePrep[] = [
  prep({ name: "Honey Syrup", nameAlt: "蜂蜜糖浆" }),
  prep({ name: "Simple Syrup", nameAlt: "简单糖浆" }),
];

describe("smartLinkIngredient", () => {
  it("精确匹配酒库中文名", () => {
    const r = smartLinkIngredient("必富达金酒", bottles, preps);
    expect(r?.kind).toBe("bottle");
    if (r?.kind === "bottle") expect(r.bottle.nameEn).toContain("Beefeater");
  });

  it("精确匹配酒库英文名(大小写不敏感)", () => {
    const r = smartLinkIngredient("beefeater london dry gin", bottles, preps);
    expect(r?.kind).toBe("bottle");
  });

  it("精确匹配自制库中文名", () => {
    const r = smartLinkIngredient("蜂蜜糖浆", bottles, preps);
    expect(r?.kind).toBe("prep");
    if (r?.kind === "prep") expect(r.prep.name).toBe("Honey Syrup");
  });

  it("英文同义词规范化后匹配(gin → 金酒类)", () => {
    const r = smartLinkIngredient("London Dry Gin", bottles, preps);
    expect(r?.kind).toBe("bottle");
    if (r?.kind === "bottle") expect(r.bottle.category).toBe("金酒");
  });

  it("自制品模糊匹配优先于酒库(homemade honey syrup)", () => {
    const r = smartLinkIngredient("Homemade Honey Syrup", bottles, preps);
    expect(r?.kind).toBe("prep");
  });

  it("苦精英文名匹配到安高天娜", () => {
    const r = smartLinkIngredient("Angostura Bitters", bottles, preps);
    expect(r?.kind).toBe("bottle");
    if (r?.kind === "bottle") expect(r.bottle.nameZh).toContain("安高天娜");
  });

  it("空名与过短名返回 null", () => {
    expect(smartLinkIngredient("", bottles, preps)).toBeNull();
    expect(smartLinkIngredient("a", bottles, preps)).toBeNull();
  });

  it("完全无关名返回 null", () => {
    expect(smartLinkIngredient("量子计算机", bottles, preps)).toBeNull();
  });
});

describe("smartLinkAll", () => {
  it("批量匹配返回每个配料的链接", () => {
    const ings = [
      { id: "1", name: "必富达金酒" },
      { id: "2", name: "蜂蜜糖浆" },
      { id: "3", name: "不存在的东西xyz" },
    ];
    const map = smartLinkAll(ings, bottles, preps);
    expect(map.get("1")?.kind).toBe("bottle");
    expect(map.get("2")?.kind).toBe("prep");
    expect(map.get("3")).toBeNull();
  });
});
