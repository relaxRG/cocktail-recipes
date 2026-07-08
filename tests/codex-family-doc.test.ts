import { describe, expect, it } from "vitest";

import { CODEX_FAMILIES, codexFamilyLabel } from "../lib/recipes/types";
// 直接读取组件文件校验内容库覆盖(组件含 JSX,改用文本方式验证键覆盖)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Codex family doc coverage", () => {
  const src = readFileSync(
    resolve(__dirname, "../components/codex-family-badge.tsx"),
    "utf8",
  );

  it("每个 CODEX_FAMILIES 取值在内容库中都有对应说明", () => {
    for (const fam of CODEX_FAMILIES) {
      expect(src.includes(`"${fam}":`), `missing doc for ${fam}`).toBe(true);
    }
  });

  it("每族说明含结构公式/代表成员/文献依据(中英)", () => {
    for (const key of ["formulaZh", "formulaEn", "bodyZh", "bodyEn"]) {
      const count = src.split(`${key}:`).length - 1;
      expect(count, `${key} entries`).toBeGreaterThanOrEqual(6);
    }
    expect(src.includes("文献依据")).toBe(true);
    expect(src.includes("Sources:")).toBe(true);
  });

  it("codexFamilyLabel 双语取段正确", () => {
    expect(codexFamilyLabel("古典 Old-Fashioned", "zh")).toBe("古典");
    expect(codexFamilyLabel("古典 Old-Fashioned", "en")).toBe("Old-Fashioned");
  });
});
