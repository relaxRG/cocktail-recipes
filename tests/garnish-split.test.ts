import { describe, expect, it } from "vitest";
import { estimateGarnishCost, splitGarnish } from "../lib/recipes/garnish-split";
import { buildAutoAddDrafts, draftFromName, splitCompoundName } from "../lib/recipes/auto-add";
import { splitBottleDraft, type BottleDraft } from "../lib/bottles/store";
import type { Bottle } from "../lib/bottles/types";

const mkBottle = (over: Partial<Bottle>): Bottle => ({
  id: Math.random().toString(36).slice(2),
  nameZh: "",
  nameEn: "",
  category: "果蔬",
  style: "",
  brand: "",
  origin: "",
  volume: "500g",
  abv: 0,
  priceCny: 0,
  notes: "",
  builtin: true,
  rating: null,
  sortIndex: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const bottles: Bottle[] = [
  mkBottle({ nameZh: "柠檬", nameEn: "Fresh Lemons", priceCny: 8, volume: "500g" }),
  mkBottle({ nameZh: "橙", nameEn: "Orange", priceCny: 10, volume: "500g" }),
  mkBottle({ nameZh: "青柠", nameEn: "Fresh Limes", priceCny: 6, volume: "500g" }),
  mkBottle({ nameZh: "薄荷", nameEn: "Mint", priceCny: 5, volume: "50g" }),
];

describe("splitGarnish", () => {
  it("splits enumerations into separate and-groups", () => {
    const g = splitGarnish("薄荷枝、青柠角");
    expect(g).toHaveLength(2);
    expect(g[0].mode).toBe("and");
    expect(g[0].parts[0].name).toBe("薄荷枝");
    expect(g[1].parts[0].name).toBe("青柠角");
  });

  it("splits 或 into an or-group", () => {
    const g = splitGarnish("柠檬皮或橙皮");
    expect(g).toHaveLength(1);
    expect(g[0].mode).toBe("or");
    expect(g[0].parts.map((p) => p.name)).toEqual(["柠檬皮", "橙皮"]);
  });

  it("splits English or", () => {
    const g = splitGarnish("lemon twist or orange peel");
    expect(g[0].mode).toBe("or");
    expect(g[0].parts.map((p) => p.name)).toEqual(["lemon twist", "orange peel"]);
  });

  it("splits 与/及/和 into and-groups", () => {
    for (const text of ["盐边与青柠角", "盐边及青柠角", "盐边和青柠角"]) {
      const g = splitGarnish(text);
      expect(g).toHaveLength(1);
      expect(g[0].mode).toBe("and");
      expect(g[0].parts.map((p) => p.name)).toEqual(["盐边", "青柠角"]);
    }
  });

  it("extracts leading counts", () => {
    const g = splitGarnish("2片柠檬与1枝薄荷");
    expect(g[0].parts[0]).toMatchObject({ name: "柠檬", amount: "2片" });
    expect(g[0].parts[1]).toMatchObject({ name: "薄荷", amount: "1枝" });
  });

  it("handles empty and plain single garnish", () => {
    expect(splitGarnish("")).toEqual([]);
    const g = splitGarnish("橙皮");
    expect(g).toHaveLength(1);
    expect(g[0].parts[0].name).toBe("橙皮");
  });
});

describe("estimateGarnishCost", () => {
  it("or-group takes the higher-cost option", () => {
    // 柠檬皮:500g/120g≈4.17件→¥1.92/件→皮1/6≈¥0.32
    // 橙皮:500g/200g=2.5件→¥4/件→皮1/6≈¥0.67(较高,应选中)
    const res = estimateGarnishCost("柠檬皮或橙皮", bottles, []);
    expect(res.groups).toHaveLength(1);
    const g = res.groups[0];
    expect(g.group.mode).toBe("or");
    const chosen = g.items.filter((i) => i.chosen);
    expect(chosen).toHaveLength(1);
    expect(chosen[0].part.name).toBe("橙皮");
    expect(g.subtotal).toBeCloseTo(chosen[0].est.cost!, 5);
    expect(res.total).toBeCloseTo(g.subtotal, 5);
  });

  it("and-group accumulates all parts", () => {
    const res = estimateGarnishCost("柠檬皮与橙皮", bottles, []);
    const g = res.groups[0];
    expect(g.group.mode).toBe("and");
    const costs = g.items.map((i) => i.est.cost ?? 0);
    expect(g.subtotal).toBeCloseTo(costs[0] + costs[1], 5);
  });

  it("enumeration accumulates across groups", () => {
    const res = estimateGarnishCost("柠檬皮、薄荷枝", bottles, []);
    expect(res.groups).toHaveLength(2);
    expect(res.total).toBeCloseTo(res.groups[0].subtotal + res.groups[1].subtotal, 5);
  });

  it("collects unmatched names for auto-add", () => {
    const res = estimateGarnishCost("食用金箔或龙眼干", bottles, []);
    expect(res.unmatchedNames.length).toBeGreaterThan(0);
  });
});

describe("auto-add engine", () => {
  it("splits compound names with connectors", () => {
    expect(splitCompoundName("青柠与柠檬")).toEqual(["青柠", "柠檬"]);
    expect(splitCompoundName("薄荷或罗勒")).toEqual(["薄荷", "罗勒"]);
    expect(splitCompoundName("金酒")).toEqual(["金酒"]);
  });

  it("builds drafts with v8 material categories", () => {
    const d = draftFromName("食用干玫瑰花");
    expect(d).not.toBeNull();
    expect(d!.priceCny).toBe(0);
    expect(d!.category).toBeTruthy();
    expect(d!.category).not.toBe("原材料");
  });

  it("strips form words before drafting (mother-entry principle)", () => {
    const d = draftFromName("百香果片");
    expect(d).not.toBeNull();
    expect(`${d!.nameZh}${d!.nameEn}`).toContain("百香果");
    expect(`${d!.nameZh}${d!.nameEn}`).not.toContain("片");
  });

  it("skips names already in the library and dedupes batch", () => {
    const drafts = buildAutoAddDrafts(["柠檬", "柠檬", "食用金箔"], bottles, []);
    const names = drafts.map((d) => d.nameZh + d.nameEn);
    expect(names.some((n) => n.includes("柠檬") && !n.includes("金箔"))).toBe(false);
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it("skips homemade-like names (left to homemade flow)", () => {
    expect(draftFromName("迷迭香糖浆")).toBeNull();
  });
});

describe("splitBottleDraft (library-entry connector split)", () => {
  const base: BottleDraft = {
    nameZh: "",
    nameEn: "",
    category: "果蔬",
    style: "",
    brand: "",
    origin: "",
    volume: "500g",
    abv: 0,
    priceCny: 6,
    notes: "",
  };

  it("splits zh names joined by 与/或/、 into separate drafts", () => {
    expect(splitBottleDraft({ ...base, nameZh: "青柠与柠檬" }).map((d) => d.nameZh)).toEqual([
      "青柠",
      "柠檬",
    ]);
    expect(splitBottleDraft({ ...base, nameZh: "薄荷或罗勒" }).map((d) => d.nameZh)).toEqual([
      "薄荷",
      "罗勒",
    ]);
    expect(splitBottleDraft({ ...base, nameZh: "丁香、八角" }).map((d) => d.nameZh)).toEqual([
      "丁香",
      "八角",
    ]);
  });

  it("aligns zh/en segments when counts match", () => {
    const out = splitBottleDraft({ ...base, nameZh: "青柠与柠檬", nameEn: "Lime and Lemon" });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ nameZh: "青柠", nameEn: "Lime" });
    expect(out[1]).toMatchObject({ nameZh: "柠檬", nameEn: "Lemon" });
    // 共享其余字段
    expect(out[1].priceCny).toBe(6);
    expect(out[1].volume).toBe("500g");
  });

  it("keeps names without connectors intact", () => {
    expect(splitBottleDraft({ ...base, nameZh: "柠檬", nameEn: "Lemon" })).toHaveLength(1);
  });
});
