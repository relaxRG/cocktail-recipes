import { describe, expect, it } from "vitest";
import { extractSourceFromNotes } from "../lib/homemade/store";

describe("extractSourceFromNotes:自制备注中来源类文字提取归入 source", () => {
  it("中文「来源:」行被提取并从 notes 删除", () => {
    const [src, notes] = extractSourceFromNotes("来源:华尔道夫酒吧手册\n冷藏保存两周");
    expect(src).toBe("华尔道夫酒吧手册");
    expect(notes).toBe("冷藏保存两周");
  });

  it("英文 Source: 行被提取", () => {
    const [src, notes] = extractSourceFromNotes("Source: The Waldorf Astoria Bar Book\nShake well");
    expect(src).toBe("The Waldorf Astoria Bar Book");
    expect(notes).toBe("Shake well");
  });

  it("Adapted from 行被提取", () => {
    const [src] = extractSourceFromNotes("Adapted from Frank Caiafa's recipe");
    expect(src).toBe("Frank Caiafa's recipe");
  });

  it("短句书名行(Waldorf Astoria Bar Book)被提取", () => {
    const [src, notes] = extractSourceFromNotes(
      "The Waldorf Astoria Bar Book · Frank Caiafa\n用前摇匀",
    );
    expect(src).toContain("Waldorf Astoria Bar Book");
    expect(notes).toBe("用前摇匀");
  });

  it("无来源信息时返回 null 且 notes 不变", () => {
    const [src, notes] = extractSourceFromNotes("冷藏两周,使用前摇匀");
    expect(src).toBeNull();
    expect(notes).toBe("冷藏两周,使用前摇匀");
  });

  it("多行来源合并为 · 分隔", () => {
    const [src] = extractSourceFromNotes("来源:某书\nSource: Some Bar\n正常备注");
    expect(src).toBe("某书 · Some Bar");
  });

  it("空 notes 直接返回", () => {
    const [src, notes] = extractSourceFromNotes("");
    expect(src).toBeNull();
    expect(notes).toBe("");
  });
});
