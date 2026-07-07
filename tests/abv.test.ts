import { describe, expect, it } from "vitest";
import {
  abvOfKeyword,
  abvOfPrep,
  bandOfAbv,
  dilutionOfMethod,
  estimateRecipeAbv,
} from "../lib/recipes/abv";
import { Ingredient } from "../lib/recipes/types";
import { Bottle, normalizeBottle } from "../lib/bottles/types";
import { HomemadePrep, normalizePrep } from "../lib/homemade/types";

const ing = (name: string, amount: string): Ingredient => ({
  id: Math.random().toString(36).slice(2),
  name,
  amount,
});

const bottle = (nameZh: string, abv: number, extra?: Partial<Bottle>): Bottle =>
  normalizeBottle({ id: nameZh, nameZh, abv, ...extra });

describe("dilutionOfMethod", () => {
  it("maps methods to Epicurious dilution factors", () => {
    expect(dilutionOfMethod("摇和")).toBe(0.3);
    expect(dilutionOfMethod("搅拌")).toBe(0.25);
    expect(dilutionOfMethod("直调")).toBe(0.2);
    expect(dilutionOfMethod("分层")).toBe(0);
    expect(dilutionOfMethod("搅打")).toBe(0.4);
    expect(dilutionOfMethod("未知方法")).toBe(0.25);
  });
});

describe("bandOfAbv", () => {
  it("maps ABV to the 7 strength bands", () => {
    expect(bandOfAbv(5)).toBe("lt10");
    expect(bandOfAbv(12)).toBe("b10_15");
    expect(bandOfAbv(17)).toBe("b15_20");
    expect(bandOfAbv(22)).toBe("b20_25");
    expect(bandOfAbv(27)).toBe("b25_30");
    expect(bandOfAbv(33)).toBe("b30_35");
    expect(bandOfAbv(40)).toBe("gt35");
  });
});

describe("abvOfKeyword", () => {
  it("resolves common spirits bilingually", () => {
    expect(abvOfKeyword("金酒")).toBe(43);
    expect(abvOfKeyword("London Dry Gin")).toBe(43);
    expect(abvOfKeyword("伏特加")).toBe(40);
    expect(abvOfKeyword("Campari")).toBe(25);
    expect(abvOfKeyword("甜味美思")).toBe(17);
    expect(abvOfKeyword("香槟")).toBe(12);
  });
  it("returns null for non-alcoholic ingredients", () => {
    expect(abvOfKeyword("青柠汁")).toBeNull();
    expect(abvOfKeyword("糖浆")).toBeNull();
    expect(abvOfKeyword("苏打水")).toBeNull();
  });
  it("honors explicit percentage in the name", () => {
    expect(abvOfKeyword("自制利口酒 30%")).toBe(30);
  });
});

describe("abvOfPrep", () => {
  it("uses heuristic ABV by prep type", () => {
    expect(abvOfPrep(normalizePrep({ id: "1", name: "Coffee Liqueur", type: "liqueur" }))).toBe(25);
    expect(abvOfPrep(normalizePrep({ id: "2", name: "Vanilla Syrup", type: "syrup" }))).toBe(0);
  });
  it("prefers explicit ABV notation in text", () => {
    const p: HomemadePrep = normalizePrep({
      id: "3",
      name: "Limoncello",
      type: "liqueur",
      notes: "约 32% abv",
    });
    expect(abvOfPrep(p)).toBe(32);
  });
});

describe("estimateRecipeAbv", () => {
  it("computes a Negroni (stirred) around 24-28%", () => {
    // 30ml gin 43% + 30ml campari 25% + 30ml sweet vermouth 17%
    // alcohol = 12.9 + 7.5 + 5.1 = 25.5ml; total 90ml × 1.25 = 112.5 → 22.7%
    const est = estimateRecipeAbv(
      [ing("金酒", "30ml"), ing("金巴利", "30ml"), ing("甜味美思", "30ml")],
      "搅拌",
      [],
      [],
    );
    expect(est.abv).not.toBeNull();
    expect(est.abv!).toBeGreaterThan(20);
    expect(est.abv!).toBeLessThan(26);
    expect(est.band).toBe("b20_25");
    expect(est.strength).toBe("medium");
  });

  it("computes a shaken Margarita in the medium range", () => {
    // 50ml tequila 40% + 20ml triple sec 40% + 15ml lime 0%
    // alcohol = 20 + 8 = 28ml; total 85 × 1.3 = 110.5 → 25.3%
    const est = estimateRecipeAbv(
      [ing("龙舌兰", "50ml"), ing("橙皮利口酒", "20ml"), ing("青柠汁", "15ml")],
      "摇和",
      [],
      [],
    );
    expect(est.abv!).toBeGreaterThan(22);
    expect(est.abv!).toBeLessThan(28);
  });

  it("treats top-up ingredients as ~90ml and dilutes a highball", () => {
    const est = estimateRecipeAbv(
      [ing("白朗姆", "45ml"), ing("青柠汁", "20ml"), ing("糖浆", "15ml"), ing("苏打水", "适量补满")],
      "直调",
      [],
      [],
    );
    // 18ml alcohol / (170 × 1.2) ≈ 8.8% → light
    expect(est.abv!).toBeGreaterThan(6);
    expect(est.abv!).toBeLessThan(12);
    expect(est.strength).not.toBe("strong");
  });

  it("prefers bottle-library ABV over keyword table", () => {
    const est = estimateRecipeAbv(
      [ing("金酒", "60ml")],
      "搅拌",
      [bottle("金酒", 47)],
      [],
    );
    const item = est.items[0];
    expect(item.source).toBe("bottle");
    expect(item.abv).toBe(47);
  });

  it("uses homemade prep ABV when no bottle matches", () => {
    const prep = normalizePrep({
      id: "hm1",
      name: "Coffee Liqueur",
      nameAlt: "自制咖啡利口酒",
      type: "liqueur",
    });
    const est = estimateRecipeAbv([ing("自制咖啡利口酒", "30ml")], "搅拌", [], [prep]);
    expect(est.items[0].source).toBe("homemade");
    expect(est.items[0].abv).toBe(25);
  });

  it("ignores garnish amounts and returns null with no measurable volume", () => {
    const est = estimateRecipeAbv([ing("薄荷叶", "8-10片")], "直调", [], []);
    expect(est.abv).toBeNull();
    expect(est.band).toBeNull();
    expect(est.strength).toBeNull();
  });

  it("layered shot keeps full strength (no dilution)", () => {
    // 20ml kahlua 20% + 20ml baileys 17% + 20ml grand marnier 40%
    const est = estimateRecipeAbv(
      [ing("咖啡利口酒", "20ml"), ing("百利甜", "20ml"), ing("Grand Marnier", "20ml")],
      "分层",
      [],
      [],
    );
    // alcohol = 4 + 3.4 + 8 = 15.4 / 60 → 25.7%
    expect(est.dilution).toBe(0);
    expect(est.abv!).toBeGreaterThan(24);
    expect(est.abv!).toBeLessThan(27);
  });
});
