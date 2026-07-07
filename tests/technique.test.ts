import { describe, expect, it } from "vitest";

import {
  detectPrepTechniques,
  detectTechniquesInText,
  primaryTechnique,
  techniqueLabel,
  TECHNIQUES,
} from "../lib/homemade/technique";
import { HomemadePrep, normalizePrep } from "../lib/homemade/types";

function mkPrep(partial: Partial<HomemadePrep>): HomemadePrep {
  return normalizePrep({ id: "t1", ...partial });
}

describe("detectTechniquesInText", () => {
  it("识别低温慢煮(中文)", () => {
    expect(detectTechniquesInText("将沙姜与伏特加真空密封,低温慢煮 55°C 2小时")).toContain(
      "sous_vide",
    );
  });

  it("识别 sous vide(英文)", () => {
    expect(detectTechniquesInText("Seal in bag, sous vide at 135F for 2 hours")).toContain(
      "sous_vide",
    );
  });

  it("识别冷藏静置/冷萃", () => {
    expect(detectTechniquesInText("咖啡豆加水冷萃,冰箱静置 12 小时")).toContain("cold_steep");
  });

  it("识别常温浸渍", () => {
    expect(detectTechniquesInText("香草荚放入朗姆酒中常温浸泡两周")).toContain("room_steep");
  });

  it("识别快速风味注入(奶油枪/N2O)", () => {
    expect(detectTechniquesInText("用 iSi 奶油枪充入 N2O,加压 2 分钟后泄压")).toContain(
      "rapid_infusion",
    );
  });

  it("识别油脂洗", () => {
    expect(detectTechniquesInText("Melt bacon fat and fat wash the bourbon, freeze overnight")).toContain(
      "fat_wash",
    );
  });

  it("识别奶洗澄清", () => {
    expect(detectTechniquesInText("倒入热牛奶使其凝乳,奶洗后过滤澄清")).toContain("milk_wash");
  });

  it("识别旋转蒸馏", () => {
    expect(detectTechniquesInText("使用 rotovap 减压蒸馏捕获香气")).toContain("rotovap");
    expect(detectTechniquesInText("旋转蒸馏提取桂花香气")).toContain("rotovap");
  });

  it("识别离心分离", () => {
    expect(detectTechniquesInText("离心 10 分钟取上清液")).toContain("centrifuge");
  });

  it("识别冷冻加压 sous pression", () => {
    expect(detectTechniquesInText("真空袋冷冻 24 小时 sous pression 萃取荔枝")).toContain(
      "sous_pression",
    );
  });

  it("识别发酵", () => {
    expect(detectTechniquesInText("加入 ginger bug 常温发酵 3 天")).toContain("fermentation");
  });

  it("识别桶陈", () => {
    expect(detectTechniquesInText("入橡木桶陈放 6 周 barrel aging")).toContain("barrel_age");
  });

  it("识别碳酸化/烟熏/酸调/油糖萃取", () => {
    expect(detectTechniquesInText("装入苏打枪充 CO2 碳酸化")).toContain("carbonation");
    expect(detectTechniquesInText("用烟熏枪熏制 30 秒")).toContain("smoke");
    expect(detectTechniquesInText("加入柠檬酸与苹果酸制作 super juice")).toContain("acid_adjust");
    expect(detectTechniquesInText("柠檬皮与糖制作 oleo saccharum")).toContain("oleo");
  });

  it("识别加热熬煮", () => {
    expect(detectTechniquesInText("糖与水小火煮至溶解")).toContain("heat_cook");
  });

  it("特种工艺优先于通用工艺", () => {
    const found = detectTechniquesInText("低温慢煮 55°C,之后冷藏静置过夜");
    expect(found[0]).toBe("sous_vide");
    expect(found).toContain("cold_steep");
  });

  it("油脂洗优先于加热(融化油脂涉及加热)", () => {
    const found = detectTechniquesInText("融化黄油后 fat wash,加热搅拌均匀再冷冻");
    expect(found[0]).toBe("fat_wash");
  });

  it("空文本返回空数组", () => {
    expect(detectTechniquesInText("")).toEqual([]);
  });
});

describe("detectPrepTechniques / primaryTechnique", () => {
  it("综合名称与做法识别", () => {
    const prep = mkPrep({
      name: "Sous Vide Ginger Vodka",
      nameAlt: "低温慢煮姜味伏特加",
      recipe: "Vacuum seal, water bath 2h",
    });
    expect(primaryTechnique(prep)).toBe("sous_vide");
  });

  it("发酵类型兜底:文本未命中时按类型返回 fermentation", () => {
    const prep = mkPrep({ name: "Ginger Beer", type: "fermented", recipe: "" });
    expect(detectPrepTechniques(prep)).toEqual(["fermentation"]);
  });

  it("奶洗类型兜底", () => {
    const prep = mkPrep({ name: "Special Rum", type: "redistilled", recipe: "" });
    expect(detectPrepTechniques(prep)).toEqual(["milk_wash"]);
  });

  it("未识别返回空数组", () => {
    const prep = mkPrep({ name: "Mystery Mix", recipe: "combine and serve" });
    // "combine and serve" 不含关键词
    expect(detectPrepTechniques(prep)).toEqual([]);
  });
});

describe("techniqueLabel & taxonomy", () => {
  it("双语标签", () => {
    expect(techniqueLabel("sous_vide", "zh")).toBe("低温慢煮");
    expect(techniqueLabel("sous_vide", "en")).toBe("Sous Vide");
    expect(techniqueLabel("rotovap", "zh")).toBe("旋转蒸馏");
    expect(techniqueLabel("rapid_infusion", "zh")).toBe("快速风味注入");
  });

  it("分类体系包含用户要求的全部工艺", () => {
    const keys = TECHNIQUES.map((t) => t.key);
    for (const k of [
      "sous_vide",
      "cold_steep",
      "room_steep",
      "rapid_infusion",
      "fat_wash",
      "milk_wash",
      "rotovap",
      "centrifuge",
      "sous_pression",
      "fermentation",
      "barrel_age",
      "carbonation",
      "smoke",
      "acid_adjust",
      "oleo",
      "heat_cook",
    ]) {
      expect(keys).toContain(k);
    }
  });
});
