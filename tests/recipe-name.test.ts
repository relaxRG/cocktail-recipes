import { describe, expect, it } from "vitest";
import { normalizeRecipe, splitBilingualName } from "../lib/recipes/types";
import { displayNames } from "../lib/utils";
import { filterRecipes } from "../lib/recipes/search";

describe("splitBilingualName", () => {
  it("splits mixed zh+en names", () => {
    expect(splitBilingualName("尼格罗尼 Negroni")).toEqual({ zh: "尼格罗尼", en: "Negroni" });
    expect(splitBilingualName("威士忌酸 Whiskey Sour")).toEqual({
      zh: "威士忌酸",
      en: "Whiskey Sour",
    });
    expect(splitBilingualName("临别一语 Last Word")).toEqual({ zh: "临别一语", en: "Last Word" });
  });
  it("returns null for single-language names", () => {
    expect(splitBilingualName("尼格罗尼")).toBeNull();
    expect(splitBilingualName("Negroni")).toBeNull();
    expect(splitBilingualName("")).toBeNull();
  });
});

describe("normalizeRecipe name migration", () => {
  it("splits legacy mixed names into name + nameEn", () => {
    const r = normalizeRecipe({ id: "1", name: "玛格丽特 Margarita" });
    expect(r.name).toBe("玛格丽特");
    expect(r.nameEn).toBe("Margarita");
  });
  it("keeps explicit nameEn untouched", () => {
    const r = normalizeRecipe({ id: "2", name: "尼格罗尼 Negroni", nameEn: "Negroni Sbagliato" });
    expect(r.name).toBe("尼格罗尼 Negroni");
    expect(r.nameEn).toBe("Negroni Sbagliato");
  });
  it("leaves pure-Chinese and pure-English names alone", () => {
    expect(normalizeRecipe({ id: "3", name: "金菲士" }).nameEn).toBe("");
    expect(normalizeRecipe({ id: "4", name: "Paper Plane" }).nameEn).toBe("");
  });
});

describe("bilingual display priority", () => {
  it("zh UI shows Chinese primary, English secondary", () => {
    const dn = displayNames("Negroni", "尼格罗尼", "zh");
    expect(dn.primary).toBe("尼格罗尼");
    expect(dn.secondary).toBe("Negroni");
  });
  it("en UI shows English primary, Chinese secondary", () => {
    const dn = displayNames("Negroni", "尼格罗尼", "en");
    expect(dn.primary).toBe("Negroni");
    expect(dn.secondary).toBe("尼格罗尼");
  });
  it("falls back when one language is missing", () => {
    expect(displayNames("", "金菲士", "en").primary).toBe("金菲士");
    expect(displayNames("Paper Plane", "", "zh").primary).toBe("Paper Plane");
  });
});

describe("search matches nameEn", () => {
  const recipes = [
    normalizeRecipe({ id: "1", name: "尼格罗尼 Negroni" }),
    normalizeRecipe({ id: "2", name: "金菲士" }),
  ];
  it("finds recipe by English name", () => {
    expect(filterRecipes(recipes, "negroni", {}).length).toBe(1);
  });
  it("finds recipe by Chinese name", () => {
    expect(filterRecipes(recipes, "尼格罗尼", {}).length).toBe(1);
  });
});

