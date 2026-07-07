import { describe, expect, it } from "vitest";
import {
  CODEX_FAMILIES,
  TAG_NAME_DICT,
  codexFamilyLabel,
  localizedTagName,
  migrateTagNameEn,
} from "../lib/recipes/types";
import { parseRecipeText } from "../lib/recipes/parser";

describe("杯型英文译名", () => {
  it("古典杯译为 Rocks Glass", () => {
    expect(TAG_NAME_DICT["古典杯"]).toBe("Rocks Glass");
    expect(localizedTagName("古典杯", "", "en")).toBe("Rocks Glass");
  });

  it("常见杯型统一带 Glass 后缀,专名保持 Mug/Cup", () => {
    expect(TAG_NAME_DICT["马天尼杯"]).toBe("Martini Glass");
    expect(TAG_NAME_DICT["高球杯"]).toBe("Highball Glass");
    expect(TAG_NAME_DICT["库佩杯"]).toBe("Coupe Glass");
    expect(TAG_NAME_DICT["提基杯"]).toBe("Tiki Mug");
    expect(TAG_NAME_DICT["铜杯"]).toBe("Copper Mug");
    expect(TAG_NAME_DICT["朱莉普杯"]).toBe("Julep Cup");
  });

  it("旧数据 nameEn=Rocks 自动升级为 Rocks Glass", () => {
    const migrated = migrateTagNameEn({ name: "古典杯", nameEn: "Rocks" });
    expect(migrated.nameEn).toBe("Rocks Glass");
  });

  it("用户自定义英文名不被覆盖", () => {
    const custom = migrateTagNameEn({ name: "我的杯子", nameEn: "Rocks" });
    expect(custom.nameEn).toBe("Rocks");
    const untouched = migrateTagNameEn({ name: "古典杯", nameEn: "My Custom Glass" });
    expect(untouched.nameEn).toBe("My Custom Glass");
  });
});

describe("粘贴导入杯型识别", () => {
  it("识别 Rocks Glass 多种写法", () => {
    for (const variant of ["Rocks Glass", "rocks glass", "Old Fashioned Glass", "lowball"]) {
      const r = parseRecipeText(`Negroni\nGin 30ml\nCampari 30ml\nGlass: ${variant}`);
      expect(r.glass).toBe("古典杯");
    }
  });

  it("显式杯型字段可省略 Glass 后缀", () => {
    const r = parseRecipeText("Daiquiri\nRum 60ml\nGlass: coupe");
    expect(r.glass).toBe("库佩杯");
  });

  it("全文推断需带 glass 后缀,不误判配料 Martini Rosso", () => {
    const r = parseRecipeText("Negroni Sbagliato\n马天尼红味美思 Martini Rosso 30ml\n金巴利 30ml");
    expect(r.glass ?? "").not.toBe("马天尼杯");
  });

  it("全文含 served in a rocks glass 时推断为古典杯", () => {
    const r = parseRecipeText("Old Pal\nRye 30ml\nCampari 30ml\nServe in a rocks glass with ice");
    expect(r.glass).toBe("古典杯");
  });
});

describe("Codex 家族按语言显示", () => {
  it("中文界面取中文段,英文界面取英文段", () => {
    expect(codexFamilyLabel("古典 Old-Fashioned", "zh")).toBe("古典");
    expect(codexFamilyLabel("古典 Old-Fashioned", "en")).toBe("Old-Fashioned");
    expect(codexFamilyLabel("马天尼 Martini", "en")).toBe("Martini");
    expect(codexFamilyLabel("大吉利 Daiquiri", "en")).toBe("Daiquiri");
    expect(codexFamilyLabel("高球 Highball", "zh")).toBe("高球");
  });

  it("全部六大家族英文界面均无中文", () => {
    for (const fam of CODEX_FAMILIES) {
      expect(/[\u4e00-\u9fa5]/.test(codexFamilyLabel(fam, "en"))).toBe(false);
    }
  });

  it("空值与无空格值安全回退", () => {
    expect(codexFamilyLabel("", "en")).toBe("");
    expect(codexFamilyLabel("Custom", "en")).toBe("Custom");
  });
});
