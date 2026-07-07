import { describe, expect, it } from "vitest";

import {
  buildWaldorfBottles,
  buildWaldorfPreps,
  WALDORF_ALIAS_MAP,
  WALDORF_STEPS_EN,
} from "../lib/bottles/waldorf-ingredients";
import { BOTTLE_CATEGORIES } from "../lib/bottles/types";
import { PREP_TYPES } from "../lib/homemade/types";
import {
  garnishDisplayText,
  ingredientDisplayName,
  stepsDisplayText,
} from "../lib/recipes/ingredient-display";

describe("Waldorf ingredient dataset", () => {
  it("builds 400+ bottles with bilingual names", () => {
    const bottles = buildWaldorfBottles();
    expect(bottles.length).toBeGreaterThan(400);
    for (const b of bottles) {
      expect(b.nameZh.length).toBeGreaterThan(0);
      expect(b.nameEn.length).toBeGreaterThan(0);
      expect(BOTTLE_CATEGORIES).toContain(b.category);
    }
  });

  it("most bottles have a positive CNY price", () => {
    const bottles = buildWaldorfBottles();
    const priced = bottles.filter((b) => b.priceCny > 0);
    expect(priced.length / bottles.length).toBeGreaterThan(0.9);
  });

  it("builds homemade preps with valid types", () => {
    const preps = buildWaldorfPreps();
    expect(preps.length).toBeGreaterThan(40);
    const keys = new Set(PREP_TYPES.map((t) => t.key));
    for (const p of preps) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.nameAlt.length).toBeGreaterThan(0);
      expect(keys.has(p.type)).toBe(true);
    }
  });

  it("has 900+ alias mappings", () => {
    expect(Object.keys(WALDORF_ALIAS_MAP).length).toBeGreaterThan(890);
  });

  it("bottle ids are unique", () => {
    const bottles = buildWaldorfBottles();
    expect(new Set(bottles.map((b) => b.id)).size).toBe(bottles.length);
  });
});

describe("Bilingual ingredient display", () => {
  it("resolves alias-mapped names per language", () => {
    const [raw, v] = Object.entries(WALDORF_ALIAS_MAP)[0];
    expect(ingredientDisplayName(raw, "en")).toBe(v.en);
    expect(ingredientDisplayName(raw, "zh")).toBe(v.zh);
  });

  it("falls back to raw text for unknown names", () => {
    expect(ingredientDisplayName("完全未知的配料XYZ", "en")).toBe("完全未知的配料XYZ");
  });

  it("translates common garnish words", () => {
    expect(garnishDisplayText("柠檬皮", "en")).toBe("Lemon twist");
    expect(garnishDisplayText("柠檬皮", "zh")).toBe("柠檬皮");
  });

  it("translates steps lines when mapping exists", () => {
    const entries = Object.entries(WALDORF_STEPS_EN);
    expect(entries.length).toBeGreaterThan(300);
    const [zh, en] = entries[0];
    expect(stepsDisplayText(zh, "en")).toBe(en);
    expect(stepsDisplayText(zh, "zh")).toBe(zh);
  });

  it("keeps untranslated step lines as-is", () => {
    const text = "这是一行没有翻译的步骤。";
    expect(stepsDisplayText(text, "en")).toBe(text);
  });
});
