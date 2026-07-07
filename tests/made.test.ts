import { describe, expect, it } from "vitest";

import { normalizeRecipe } from "../lib/recipes/types";
import { normalizePrep } from "../lib/homemade/types";

describe("made status normalization", () => {
  it("defaults recipe.made to false for legacy data", () => {
    const r = normalizeRecipe({
      id: "r1",
      name: "尼格罗尼",
      ingredients: [],
    });
    expect(r.made).toBe(false);
  });

  it("preserves recipe.made=true", () => {
    const r = normalizeRecipe({ id: "r2", name: "Daiquiri", made: true, ingredients: [] });
    expect(r.made).toBe(true);
  });

  it("defaults prep.made to false for legacy data", () => {
    const p = normalizePrep({ id: "p1", name: "糖浆" });
    expect(p.made).toBe(false);
  });

  it("preserves prep.made=true", () => {
    const p = normalizePrep({ id: "p2", name: "油脂洗威士忌", made: true });
    expect(p.made).toBe(true);
  });
});
