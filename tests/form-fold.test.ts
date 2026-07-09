import { describe, expect, it } from "vitest";
import {
  defaultPieceGrams,
  formCost,
  formFactorOf,
  parseFormCount,
  stripForm,
} from "../lib/recipes/form-fold";
import type { Bottle } from "../lib/bottles/types";

const mkBottle = (over: Partial<Bottle>): Bottle => ({
  id: "b1",
  nameZh: "柠檬",
  nameEn: "Fresh Lemons",
  category: "果蔬",
  style: "Citrus",
  brand: "",
  origin: "",
  volume: "500g",
  abv: 0,
  priceCny: 8,
  notes: "",
    flavorTags: [],
    story: "",
    styleDesc: "",
  builtin: true,
  rating: null,
  sortIndex: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("form-fold engine", () => {
  it("strips Chinese form suffixes", () => {
    expect(stripForm("柠檬皮")).toMatchObject({ base: "柠檬", form: "皮" });
    expect(stripForm("黄瓜片")).toMatchObject({ base: "黄瓜", form: "片" });
    expect(stripForm("青柠角")).toMatchObject({ base: "青柠", form: "角" });
    expect(stripForm("薄荷枝")).toMatchObject({ base: "薄荷", form: "枝" });
    expect(stripForm("薄荷叶")).toMatchObject({ base: "薄荷", form: "叶" });
    expect(stripForm("橙皮卷")).toMatchObject({ base: "橙", form: "皮" });
  });

  it("strips English form suffixes", () => {
    expect(stripForm("Lemon Twist")).toMatchObject({ base: "Lemon", form: "皮" });
    expect(stripForm("orange peel")).toMatchObject({ base: "orange", form: "皮" });
    expect(stripForm("lime wedge")).toMatchObject({ base: "lime", form: "角" });
    expect(stripForm("cucumber slice")).toMatchObject({ base: "cucumber", form: "片" });
    expect(stripForm("mint sprig")).toMatchObject({ base: "mint", form: "枝" });
  });

  it("keeps names without form words intact", () => {
    expect(stripForm("金酒").form).toBeNull();
    expect(stripForm("柠檬").form).toBeNull();
    expect(stripForm("Angostura Bitters").form).toBeNull();
  });

  it("does not over-strip too-short bases", () => {
    // "果皮" 剥离后 base="果" 有 1 个汉字,允许;纯英文 "rind" 剥离后为空 → 不剥
    expect(stripForm("rind").form).toBeNull();
    expect(stripForm("皮").form).toBeNull();
  });

  it("parses form counts from amounts", () => {
    expect(parseFormCount("2片")).toBe(2);
    expect(parseFormCount("1 条")).toBe(1);
    expect(parseFormCount("3 leaves")).toBe(3);
    expect(parseFormCount("适量")).toBe(1);
    expect(parseFormCount("")).toBe(1);
  });

  it("computes form cost from weight pack via piece grams", () => {
    const lemon = mkBottle({});
    // 500g / 120g ≈ 4.17 个;单件价 ≈ ¥1.92;皮 1/6 ≈ ¥0.32
    const fc = formCost(lemon, "皮", 1 / 6, 1);
    expect(fc).not.toBeNull();
    expect(fc!.piecePrice).toBeCloseTo(8 / (500 / 120), 2);
    expect(fc!.cost).toBeCloseTo(fc!.piecePrice / 6, 3);
  });

  it("computes form cost from piece pack", () => {
    const eggs = mkBottle({ nameZh: "鸡蛋", nameEn: "Eggs", volume: "10枚", priceCny: 12 });
    const fc = formCost(eggs, "整个", 1, 2);
    expect(fc).not.toBeNull();
    expect(fc!.piecePrice).toBeCloseTo(1.2, 5);
    expect(fc!.cost).toBeCloseTo(2.4, 5);
  });

  it("respects user-defined factor overrides on the bottle", () => {
    const lemon = mkBottle({ formFactors: { 皮: 0.25, _pieceGrams: 100 } });
    expect(formFactorOf(lemon, "皮", 1 / 6)).toBe(0.25);
    const fc = formCost(lemon, "皮", 1 / 6, 1);
    // 500g/100g = 5 件 → 单件 ¥1.6 → 皮 0.25 → ¥0.4
    expect(fc!.piecePrice).toBeCloseTo(1.6, 5);
    expect(fc!.cost).toBeCloseTo(0.4, 5);
  });

  it("returns null when price or pack missing", () => {
    expect(formCost(mkBottle({ priceCny: 0 }), "皮", 1 / 6, 1)).toBeNull();
    expect(formCost(mkBottle({ volume: "" }), "皮", 1 / 6, 1)).toBeNull();
  });

  it("provides sensible default piece grams", () => {
    expect(defaultPieceGrams("柠檬 Lemon")).toBe(120);
    expect(defaultPieceGrams("青柠 Lime")).toBe(80);
    expect(defaultPieceGrams("unknown thing")).toBe(150);
  });
});
