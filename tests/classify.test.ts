import { describe, expect, it } from "vitest";
import { inferDrinkDuration, inferOccasion } from "../lib/recipes/classify";

const ing = (...names: string[]) => names.map((n, i) => ({ id: `i${i}`, name: n, amount: "30ml" }));

describe("inferDrinkDuration", () => {
  it("Waldorf 分类直接映射", () => {
    expect(inferDrinkDuration({ categoryId: "cat-waldorf-short", glass: "", ingredients: [], method: "" })).toBe("短饮");
    expect(inferDrinkDuration({ categoryId: "cat-waldorf-long", glass: "", ingredients: [], method: "" })).toBe("长饮");
  });
  it("高球杯/柯林斯杯 → 长饮", () => {
    expect(inferDrinkDuration({ categoryId: null, glass: "高球杯", ingredients: [], method: "直调" })).toBe("长饮");
    expect(inferDrinkDuration({ categoryId: null, glass: "柯林斯杯", ingredients: [], method: "摇和" })).toBe("长饮");
  });
  it("含苏打水等延长配料 → 长饮", () => {
    expect(
      inferDrinkDuration({ categoryId: null, glass: "古典杯", ingredients: ing("金酒", "苏打水"), method: "直调" }),
    ).toBe("长饮");
  });
  it("马天尼杯/库佩杯 → 短饮", () => {
    expect(inferDrinkDuration({ categoryId: null, glass: "马天尼杯", ingredients: ing("金酒"), method: "搅拌" })).toBe("短饮");
    expect(inferDrinkDuration({ categoryId: null, glass: "库佩杯", ingredients: ing("朗姆"), method: "摇和" })).toBe("短饮");
  });
  it("古典杯无延长配料默认短饮", () => {
    expect(
      inferDrinkDuration({ categoryId: null, glass: "古典杯", ingredients: ing("威士忌", "糖浆"), method: "搅拌" }),
    ).toBe("短饮");
  });
});

describe("inferOccasion", () => {
  it("Waldorf 分类直接映射", () => {
    expect(inferOccasion({ categoryId: "cat-waldorf-aperitif", glass: "", ingredients: [], abv: null, codexFamily: "" })).toBe("餐前酒");
    expect(inferOccasion({ categoryId: "cat-waldorf-digestif", glass: "", ingredients: [], abv: null, codexFamily: "" })).toBe("餐后酒");
  });
  it("奶油/咖啡类 → 餐后酒", () => {
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("伏特加", "咖啡利口酒", "淡奶油"), abv: 20, codexFamily: "" }),
    ).toBe("餐后酒");
  });
  it("金巴利/味美思低度 → 餐前酒", () => {
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("金巴利", "甜味美思", "苏打水"), abv: 12, codexFamily: "" }),
    ).toBe("餐前酒");
  });
  it("尼格罗尼(金巴利,高度)仍为餐前酒", () => {
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("金酒", "金巴利", "甜味美思"), abv: 28, codexFamily: "" }),
    ).toBe("餐前酒");
  });
  it("曼哈顿(味美思,高度) → 睡前酒", () => {
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("黑麦威士忌", "甜味美思"), abv: 30, codexFamily: "" }),
    ).toBe("睡前酒");
  });
  it("提基/椰浆 → 派对酒;无酒精 → 全天酒", () => {
    expect(
      inferOccasion({ categoryId: "cat-waldorf-tiki", glass: "", ingredients: [], abv: 15, codexFamily: "" }),
    ).toBe("派对酒");
    expect(
      inferOccasion({ categoryId: "cat-waldorf-na", glass: "", ingredients: ing("青柠汁", "糖浆"), abv: 0, codexFamily: "" }),
    ).toBe("全天酒");
  });
  it("高度烈酒无苦味特征 → 睡前酒;普通中低度 → 全天酒", () => {
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("干邑", "糖浆"), abv: 35, codexFamily: "" }),
    ).toBe("睡前酒");
    expect(
      inferOccasion({ categoryId: null, glass: "", ingredients: ing("朗姆", "青柠汁", "糖浆"), abv: 18, codexFamily: "" }),
    ).toBe("全天酒");
  });
});
