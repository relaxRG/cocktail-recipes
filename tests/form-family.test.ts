import { describe, expect, it } from "vitest";

import { familyBaseOf, findExactBottle, groupFormFamilies } from "../lib/bottles/form-family";
import { normalizeBottle, type Bottle } from "../lib/bottles/types";
import { smartLinkIngredient } from "../lib/recipes/smart-link";

let seq = 0;
function mk(nameZh: string, nameEn: string, category: string, extra: Partial<Bottle> = {}): Bottle {
  return normalizeBottle({
    id: `t-${++seq}`,
    nameZh,
    nameEn,
    category,
    priceCny: 10,
    volume: "500g",
    ...extra,
  });
}

describe("familyBaseOf 母名提取", () => {
  it("柠檬皮/柠檬片/柠檬汁 → 柠檬", () => {
    expect(familyBaseOf("柠檬皮")).toBe("柠檬");
    expect(familyBaseOf("柠檬片")).toBe("柠檬");
    expect(familyBaseOf("柠檬汁")).toBe("柠檬");
  });
  it("橙瓣 → 橙;橙皮 → 橙", () => {
    expect(familyBaseOf("橙瓣")).toBe("橙");
    expect(familyBaseOf("橙皮")).toBe("橙");
  });
  it("母条目本名无形态词 → null", () => {
    expect(familyBaseOf("柠檬")).toBeNull();
    expect(familyBaseOf("薄荷")).toBeNull();
  });
});

describe("groupFormFamilies 形态族折叠", () => {
  it("柠檬 + 柠檬汁 + 柠檬皮 聚合为一族,母条目为柠檬", () => {
    const lemon = mk("柠檬", "Fresh Lemons", "果蔬");
    const juice = mk("柠檬汁", "Lemon Juice", "果蔬");
    const peel = mk("柠檬皮", "Lemon Peel", "果蔬");
    const mint = mk("薄荷", "Mint", "香料与草本");
    const { families, singles, memberOf } = groupFormFamilies([lemon, juice, peel, mint]);
    expect(families).toHaveLength(1);
    expect(families[0].base?.id).toBe(lemon.id);
    expect(families[0].variants.map((v) => v.nameZh).sort()).toEqual(["柠檬汁", "柠檬皮"]);
    expect(memberOf.get(juice.id)).toBe(families[0].key);
    expect(singles.map((b) => b.id)).toEqual([mint.id]);
  });

  it("橙皮与柠檬片分属不同族,不互相混淆", () => {
    const orange = mk("橙", "Fresh Oranges", "果蔬");
    const lemon = mk("柠檬", "Fresh Lemons", "果蔬");
    const orangePeel = mk("橙皮", "Orange Peel", "果蔬");
    const lemonSlice = mk("柠檬片", "Lemon Slice", "果蔬");
    const { families } = groupFormFamilies([orange, lemon, orangePeel, lemonSlice]);
    const fOrange = families.find((f) => f.base?.id === orange.id);
    const fLemon = families.find((f) => f.base?.id === lemon.id);
    expect(fOrange?.variants.map((v) => v.nameZh)).toEqual(["橙皮"]);
    expect(fLemon?.variants.map((v) => v.nameZh)).toEqual(["柠檬片"]);
  });

  it("孤立形态条目(无母条目且同族仅 1 条)不折叠", () => {
    const lonely = mk("青柠角", "Lime Wedge", "果蔬");
    const { families, singles } = groupFormFamilies([lonely]);
    expect(families).toHaveLength(0);
    expect(singles).toHaveLength(1);
  });

  it("无母条目但同母名形态 ≥2 也成族(首条为头)", () => {
    const juice = mk("西柚汁", "Grapefruit Juice", "果蔬");
    const peel = mk("西柚皮", "Grapefruit Peel", "果蔬");
    const { families } = groupFormFamilies([juice, peel]);
    expect(families).toHaveLength(1);
    expect(families[0].base).toBeNull();
    expect(families[0].variants).toHaveLength(2);
  });

  it("非材料组条目不参与折叠", () => {
    const gin = mk("金酒", "Gin", "金酒");
    const ginX = mk("金酒皮", "Gin Peel", "金酒");
    const { families } = groupFormFamilies([gin, ginX]);
    expect(families).toHaveLength(0);
  });
});

describe("配方匹配:库内形态条目优先于系数换算", () => {
  it("库内存在'柠檬皮'条目 → 精确命中该条目(无 form 换算)", () => {
    const lemon = mk("柠檬", "Fresh Lemons", "果蔬");
    const peel = mk("柠檬皮", "Lemon Peel", "果蔬", { priceCny: 5, volume: "10个" });
    const link = smartLinkIngredient("柠檬皮", [lemon, peel], []);
    expect(link?.kind).toBe("bottle");
    if (link?.kind === "bottle") {
      expect(link.bottle.id).toBe(peel.id);
      expect(link.form).toBeUndefined();
    }
  });

  it("库内无'柠檬皮'条目 → 回退母条目'柠檬'×皮系数", () => {
    const lemon = mk("柠檬", "Fresh Lemons", "果蔬");
    const link = smartLinkIngredient("柠檬皮", [lemon], []);
    expect(link?.kind).toBe("bottle");
    if (link?.kind === "bottle") {
      expect(link.bottle.id).toBe(lemon.id);
      expect(link.form?.key).toBe("皮");
    }
  });
});

describe("findExactBottle", () => {
  it("中英文名均可精确命中", () => {
    const peel = mk("柠檬皮", "Lemon Peel", "果蔬");
    expect(findExactBottle([peel], "柠檬皮")?.id).toBe(peel.id);
    expect(findExactBottle([peel], "lemon peel")?.id).toBe(peel.id);
    expect(findExactBottle([peel], "柠檬")).toBeNull();
  });
});
