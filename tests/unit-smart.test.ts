import { describe, expect, it } from "vitest";
import { parseAmountToMl, classifyOzContext, resolveAmbiguousUnit } from "../lib/bottles/cost";

describe("classifyOzContext", () => {
  it("returns liquid for standard spirits", () => {
    expect(classifyOzContext("金酒")).toBe("liquid");
    expect(classifyOzContext("Bourbon Whiskey")).toBe("liquid");
    expect(classifyOzContext("Simple Syrup")).toBe("liquid");
  });
  it("returns solid for dry ingredients", () => {
    expect(classifyOzContext("可可粉")).toBe("solid");
    expect(classifyOzContext("salt")).toBe("solid");
    expect(classifyOzContext("sugar")).toBe("solid");
    expect(classifyOzContext("cinnamon")).toBe("solid");
    expect(classifyOzContext("matcha")).toBe("solid");
  });
  it("does NOT flag sugar syrup as solid", () => {
    expect(classifyOzContext("sugar syrup")).toBe("liquid");
    expect(classifyOzContext("cinnamon syrup")).toBe("liquid");
  });
});

describe("parseAmountToMl with oz context", () => {
  it("converts liquid oz normally", () => {
    expect(parseAmountToMl("1.5 oz", "金酒")).toBeCloseTo(45, 0);
    expect(parseAmountToMl("2 oz", "Bourbon")).toBeCloseTo(60, 0);
  });
  it("returns null for solid oz (weight oz, not volume)", () => {
    expect(parseAmountToMl("1 oz", "可可粉")).toBeNull();
    expect(parseAmountToMl("2 oz", "salt")).toBeNull();
  });
  it("still works without ingredientName (backward compat)", () => {
    expect(parseAmountToMl("1.5 oz")).toBeCloseTo(45, 0);
  });
});

describe("resolveAmbiguousUnit", () => {
  it("适量 bitters → 0.9ml (1 dash)", () => {
    expect(resolveAmbiguousUnit("适量", "苦精")).toBeCloseTo(0.9, 1);
    expect(resolveAmbiguousUnit("to taste", "bitters")).toBeCloseTo(0.9, 1);
  });
  it("适量 soda → 60ml (top up)", () => {
    expect(resolveAmbiguousUnit("适量", "苏打水")).toBeCloseTo(60, 0);
    expect(resolveAmbiguousUnit("as needed", "soda water")).toBeCloseTo(60, 0);
  });
  it("适量 unknown → null", () => {
    expect(resolveAmbiguousUnit("适量", "神秘配料")).toBeNull();
  });
  it("几滴 → 0.15ml", () => {
    expect(resolveAmbiguousUnit("几滴", "苦精")).toBeCloseTo(0.15, 2);
    expect(resolveAmbiguousUnit("a few drops", "bitters")).toBeCloseTo(0.15, 2);
  });
  it("一点 → 2ml", () => {
    expect(resolveAmbiguousUnit("一点", "糖浆")).toBeCloseTo(2, 0);
  });
  it("一瓶 beer → 330ml", () => {
    expect(resolveAmbiguousUnit("一瓶", "啤酒")).toBeCloseTo(330, 0);
    expect(resolveAmbiguousUnit("one bottle", "beer")).toBeCloseTo(330, 0);
  });
  it("一瓶 wine → 750ml", () => {
    expect(resolveAmbiguousUnit("一瓶", "葡萄酒")).toBeCloseTo(750, 0);
    expect(resolveAmbiguousUnit("one bottle", "champagne")).toBeCloseTo(750, 0);
  });
  it("一瓶 spirits → 700ml", () => {
    expect(resolveAmbiguousUnit("一瓶", "威士忌")).toBeCloseTo(700, 0);
  });
});

describe("new unit table entries", () => {
  it("part → 30ml", () => expect(parseAmountToMl("1 part")).toBeCloseTo(30, 0));
  it("measure → 25ml", () => expect(parseAmountToMl("1 measure")).toBeCloseTo(25, 0));
  it("nip → 30ml", () => expect(parseAmountToMl("1 nip")).toBeCloseTo(30, 0));
  it("finger → 44ml", () => expect(parseAmountToMl("1 finger")).toBeCloseTo(44, 0));
  it("squeeze → 15ml", () => expect(parseAmountToMl("1 squeeze")).toBeCloseTo(15, 0));
  it("pump → 10ml", () => expect(parseAmountToMl("1 pump")).toBeCloseTo(10, 0));
  it("scoop → 120ml", () => expect(parseAmountToMl("1 scoop")).toBeCloseTo(120, 0));
  it("酒盅 → 30ml", () => expect(parseAmountToMl("1 酒盅")).toBeCloseTo(30, 0));
  it("小匙 → 5ml", () => expect(parseAmountToMl("1 小匙")).toBeCloseTo(5, 0));
  it("大匙 → 15ml", () => expect(parseAmountToMl("1 大匙")).toBeCloseTo(15, 0));
});
