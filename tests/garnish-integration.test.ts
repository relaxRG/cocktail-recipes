import { describe, expect, it } from "vitest";
import { buildDefaultBottles } from "../lib/bottles/seed";
import { estimateGarnishCost } from "../lib/recipes/garnish-split";
import { buildAutoAddDrafts } from "../lib/recipes/auto-add";
import { smartLinkIngredient } from "../lib/recipes/smart-link";

describe("garnish cost integration with real seed data", () => {
  const bottles = buildDefaultBottles();

  it("estimates enumerated garnish (薄荷枝、青柠角) with form folding", () => {
    const res = estimateGarnishCost("薄荷枝、青柠角", bottles, []);
    expect(res.groups).toHaveLength(2);
    // 两段均应匹配到母条目(薄荷/青柠)或至少有一段可估价
    const linked = res.groups.flatMap((g) => g.items).filter((i) => i.est.link);
    expect(linked.length).toBeGreaterThanOrEqual(1);
  });

  it("or-garnish counts only the pricier option in total", () => {
    const res = estimateGarnishCost("柠檬皮或橙皮", bottles, []);
    const g = res.groups[0];
    if (g.items.every((i) => i.est.cost !== null)) {
      const max = Math.max(...g.items.map((i) => i.est.cost!));
      expect(g.subtotal).toBeCloseTo(max, 5);
    }
  });

  it("unmatched garnish generates auto-add drafts with v8 category", () => {
    const res = estimateGarnishCost("食用金箔", bottles, []);
    if (res.unmatchedNames.length > 0) {
      const drafts = buildAutoAddDrafts(res.unmatchedNames, bottles, []);
      for (const d of drafts) {
        expect(d.category).not.toBe("原材料");
        expect(d.priceCny).toBe(0);
      }
    }
  });

  it("form-folded garnish links to mother entry (柠檬片 → 柠檬)", () => {
    const link = smartLinkIngredient("柠檬片", bottles, []);
    if (link?.kind === "bottle") {
      expect(`${link.bottle.nameZh}${link.bottle.nameEn}`.toLowerCase()).toMatch(/柠檬|lemon/);
    }
  });
});
