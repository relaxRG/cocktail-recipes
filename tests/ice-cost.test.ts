import { describe, expect, it } from "vitest";

import {
  DEFAULT_ICE_SETTINGS,
  estimateIceCost,
  iceKindCostPerDrink,
  matchIceKind,
  type IceSettings,
} from "../lib/ice/cost";

const s: IceSettings = DEFAULT_ICE_SETTINGS;

describe("iceKindCostPerDrink", () => {
  it("摇冰按袋价/可摇杯数计:10元/8杯=1.25", () => {
    const shake = s.kinds.find((k) => k.isShakeIce)!;
    expect(iceKindCostPerDrink(shake)).toBeCloseTo(1.25);
  });
  it("方冰按克计:12元/1000g×120g=1.44", () => {
    const cubes = s.kinds.find((k) => k.id === "ice-cubes")!;
    expect(iceKindCostPerDrink(cubes)).toBeCloseTo(1.44);
  });
  it("大冰按颗计", () => {
    const big = s.kinds.find((k) => k.id === "ice-big")!;
    expect(iceKindCostPerDrink(big)).toBe(2);
  });
});

describe("matchIceKind 智能匹配", () => {
  const serveKinds = s.kinds.filter((k) => !k.isShakeIce);
  it("大方冰 → 大冰/冰球", () => {
    expect(matchIceKind("大方冰", serveKinds)?.id).toBe("ice-big");
  });
  it("碎冰 → 碎冰", () => {
    expect(matchIceKind("碎冰", serveKinds)?.id).toBe("ice-crushed");
  });
  it("直条冰 → 直条冰", () => {
    expect(matchIceKind("直条冰", serveKinds)?.id).toBe("ice-spear");
  });
  it("方冰 → 标准方冰", () => {
    expect(matchIceKind("方冰", serveKinds)?.id).toBe("ice-cubes");
  });
  it("空文本不匹配", () => {
    expect(matchIceKind("", serveKinds)).toBeNull();
  });
});

describe("estimateIceCost 智能计费", () => {
  it("摇和 + 方冰:摇冰 1.25 + 方冰 1.44", () => {
    const r = estimateIceCost("摇和", "方冰", s);
    expect(r.items).toHaveLength(2);
    expect(r.total).toBeCloseTo(2.69);
  });
  it("搅拌 + 大冰:摇冰 1.25 + 大冰 2", () => {
    const r = estimateIceCost("搅拌", "大方冰", s);
    expect(r.total).toBeCloseTo(3.25);
  });
  it("搅拌关闭消耗摇冰后只计出品冰", () => {
    const r = estimateIceCost("搅拌", "大方冰", { ...s, stirConsumesIce: false });
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(2);
  });
  it("直调 + 无冰:0 成本", () => {
    const r = estimateIceCost("直调", "无冰", s);
    expect(r.total).toBe(0);
  });
  it("neat/up 不计冰", () => {
    expect(estimateIceCost("搅拌", "up", { ...s, stirConsumesIce: false }).total).toBe(0);
  });
  it("搅打无 ice 字段默认碎冰", () => {
    const r = estimateIceCost("搅打", "", s);
    expect(r.items[0]?.kind.id).toBe("ice-crushed");
  });
  it("禁用后全部为 0", () => {
    expect(estimateIceCost("摇和", "方冰", { ...s, enabled: false }).total).toBe(0);
  });
  it("英文方法 Shake 也识别", () => {
    const r = estimateIceCost("Shake", "cubes", s);
    expect(r.items).toHaveLength(2);
  });
});
