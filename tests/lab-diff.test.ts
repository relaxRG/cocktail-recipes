import { describe, expect, it } from "vitest";

import { buildCompareRows, diffSpecs } from "../lib/lab/diff";
import { LabSpec } from "../lib/lab/types";
import { LAB_TEMPLATES, specFromTemplate } from "../lib/lab/templates";

let n = 0;
const gid = () => `t${++n}`;

const spec = (
  ings: [string, string][],
  extra: Partial<Omit<LabSpec, "ingredients">> = {},
): LabSpec => ({
  ingredients: ings.map(([name, amount]) => ({ id: gid(), name, amount })),
  method: "搅拌",
  glass: "古典杯",
  ice: "大方冰",
  garnish: "橙皮",
  ...extra,
});

describe("diffSpecs 批次自动差异", () => {
  it("v1(无 parent)不产生差异", () => {
    expect(diffSpecs(null, spec([["波本", "60ml"]]))).toEqual([]);
  });

  it("同配料不同用量 → amount", () => {
    const a = spec([["波本威士忌", "60ml"], ["单糖浆", "5ml"]]);
    const b = spec([["波本威士忌", "50ml"], ["单糖浆", "5ml"]]);
    const changes = diffSpecs(a, b);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "amount",
      ingredientName: "波本威士忌",
      from: "60ml",
      to: "50ml",
    });
  });

  it("同用量换名称 → product(同槽位换件)", () => {
    const a = spec([["波本威士忌", "60ml"], ["单糖浆", "5ml"]]);
    const b = spec([["黑麦威士忌", "60ml"], ["单糖浆", "5ml"]]);
    const changes = diffSpecs(a, b);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "product",
      from: "波本威士忌",
      to: "黑麦威士忌",
    });
  });

  it("新增/移除配料 → add / remove", () => {
    const a = spec([["金酒", "45ml"], ["柠檬汁", "25ml"]]);
    const b = spec([["金酒", "45ml"], ["紫罗兰利口酒", "10ml"]]);
    const changes = diffSpecs(a, b);
    const types = changes.map((c) => c.type).sort();
    expect(types).toEqual(["add", "remove"]);
  });

  it("技法/冰/杯型/装饰变化 → technique/ice/glass/garnish", () => {
    const a = spec([["金酒", "45ml"]]);
    const b = spec([["金酒", "45ml"]], {
      method: "摇和",
      ice: "碎冰",
      glass: "碟形杯",
      garnish: "柠檬皮",
    });
    const types = diffSpecs(a, b).map((c) => c.type).sort();
    expect(types).toEqual(["garnish", "glass", "ice", "technique"]);
  });

  it("大小写与空白差异不算变化", () => {
    const a = spec([["Gin", "45 ml"]]);
    const b = spec([["gin", "45 ml"]]);
    expect(diffSpecs(a, b)).toEqual([]);
  });
});

describe("buildCompareRows 对比行对齐", () => {
  it("对齐同名配料并标记差异行", () => {
    const a = spec([["波本", "60ml"], ["单糖浆", "5ml"]]);
    const b = spec([["波本", "50ml"], ["单糖浆", "5ml"], ["苦精", "2 dash"]]);
    const rows = buildCompareRows([a, b]);
    expect(rows).toHaveLength(3);
    const bourbon = rows.find((r) => r.label === "波本")!;
    expect(bourbon.differs).toBe(true);
    expect(bourbon.cells[0]?.amount).toBe("60ml");
    expect(bourbon.cells[1]?.amount).toBe("50ml");
    const syrup = rows.find((r) => r.label === "单糖浆")!;
    expect(syrup.differs).toBe(false);
    const bitters = rows.find((r) => r.label === "苦精")!;
    expect(bitters.differs).toBe(true);
    expect(bitters.cells[0]).toBeNull();
  });
});

describe("经典框架模板库", () => {
  it("包含 12 个框架且六大母方齐全", () => {
    expect(LAB_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const ids = LAB_TEMPLATES.map((t) => t.id);
    for (const core of ["old-fashioned", "daiquiri", "martini", "sidecar", "highball", "flip"]) {
      expect(ids).toContain(core);
    }
  });

  it("每个框架槽位完整且能生成预填 spec", () => {
    for (const tpl of LAB_TEMPLATES) {
      expect(tpl.slots.length).toBeGreaterThanOrEqual(2);
      for (const s of tpl.slots) {
        expect(s.role.zh).toBeTruthy();
        expect(s.role.en).toBeTruthy();
        expect(s.defaultAmount).toBeTruthy();
        expect(s.swapHint.zh).toBeTruthy();
      }
      const zh = specFromTemplate(tpl, "zh", gid);
      expect(zh.ingredients.length).toBe(tpl.slots.length);
      expect(zh.method).toBeTruthy();
      const en = specFromTemplate(tpl, "en", gid);
      expect(en.ingredients[0].name).toBe(tpl.slots[0].defaultName.en);
    }
  });
});

