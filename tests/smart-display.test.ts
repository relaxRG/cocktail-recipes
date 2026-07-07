import { describe, it, expect } from "vitest";
import { smartLinkIngredient, smartLinkDisplayName } from "../lib/recipes/smart-link";
import { buildWaldorfBottles } from "../lib/bottles/waldorf-ingredients";
import type { HomemadePrep } from "../lib/homemade/types";

const bottles = buildWaldorfBottles();

const preps: HomemadePrep[] = [
  {
    id: "hm-1",
    name: "蜂蜜糖浆",
    nameAlt: "Honey Syrup",
    type: "syrup_flavored",
    ingredients: [],
    steps: "",
    yield: "",
    shelfLifeDays: null,
    notes: "",
    rating: null,
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as HomemadePrep,
];

describe("smartLinkDisplayName 名称直接替换", () => {
  it("Angostura 苦精 → 酒库规范名(中文界面显示中文主名)", () => {
    const link = smartLinkIngredient("Angostura 苦精", bottles, preps);
    expect(link).not.toBeNull();
    expect(link!.kind).toBe("bottle");
    const d = smartLinkDisplayName(link, "zh");
    expect(d).not.toBeNull();
    expect(d!.primary).toMatch(/[\u4e00-\u9fff]/); // 主名是中文
    expect(d!.primary).toContain("安高天娜");
  });

  it("英文界面主名为英文", () => {
    const link = smartLinkIngredient("Angostura 苦精", bottles, preps);
    const d = smartLinkDisplayName(link, "en");
    expect(d!.primary.toLowerCase()).toContain("angostura");
  });

  it("自制品:蜂蜜糖浆按语言取主名", () => {
    const link = smartLinkIngredient("honey syrup", bottles, preps);
    expect(link!.kind).toBe("prep");
    expect(smartLinkDisplayName(link, "zh")!.primary).toBe("蜂蜜糖浆");
    expect(smartLinkDisplayName(link, "en")!.primary).toBe("Honey Syrup");
  });

  it("未匹配返回 null", () => {
    expect(smartLinkDisplayName(null, "zh")).toBeNull();
  });
});
