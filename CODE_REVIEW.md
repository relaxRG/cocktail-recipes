# 鸡尾酒配方手册 App — 代码审查报告

> 审查日期：2026-07-15 | 审查范围：全部 `app/`、`lib/`、`server/` 文件

---

## 一、整体优点

本项目在架构设计和功能完整性上有多处值得肯定的地方。

**架构分层清晰。** `lib/` 目录按领域（recipes、bottles、homemade、menu、lab、i18n 等）分层，业务逻辑与 UI 层解耦良好。Store 层统一使用 AsyncStorage 持久化，无跨组件状态污染。

**i18n 体系完善。** 翻译文件 `lib/i18n/translations.ts` 覆盖了绝大多数 UI 文案，`useI18n()` Hook 的设计也使语言切换逻辑集中可维护。

**AI 功能集成度高。** 批量导入（文本/图片/PDF）、酒瓶 AI 补全、配方 AI 补全故事与风味、ABV 自动估算等功能均已落地，且服务端有超时保护（30s/60s AbortSignal）。

**成本计算链路完整。** `bottles/cost.ts` → `homemade/cost.ts` → `ice/cost.ts` → `recipes/smart-cost.ts` 形成了完整的成本核算链，支持 oz/ml/cl/dash/tsp/tbsp 等主流单位。

**配方匹配逻辑有同义词扩展。** `INGREDIENT_SYNONYMS` 数组和 `matchBottle()` 函数支持英文配料名到中文酒库的双向模糊匹配，覆盖了大多数常见烈酒。

---

## 二、已发现的 Bug（按严重程度排序）

### Bug 1 — Rye Whiskey 被错误归类为"波本威士忌" 【高危】

**文件：** `lib/bottles/cost.ts` 第 125 行

**问题代码：**
```ts
[/bourbon|rye\s*whisk(e)?y/i, "波本威士忌"],
```

Bourbon（波本）和 Rye Whiskey（黑麦威士忌）是两种风味截然不同的威士忌。将二者合并到同一个同义词条目，会导致：当配方中使用 Rye Whiskey 时，系统会尝试用用户酒库中的波本威士忌来匹配并计算成本，产生错误的成本估算和错误的"可制作"判断。

**更优方案：** 拆分为两条独立规则，并新增"黑麦威士忌"分类。
```ts
[/\brye\s*whisk(e)?y|\brye\b/i, "黑麦威士忌"],
[/bourbon/i, "波本威士忌"],
[/scotch|whisk(e)?y/i, "威士忌"],
```
同时在 `lib/classify.ts` 的 `BOTTLE_CUES` 中也需要拆分 `rye\b` 到独立条目，避免 Rye 被笼统归入"威士忌"。

---

### Bug 2 — `cups` 单位缺失导致成本计算返回错误值 【高危】

**文件：** `lib/bottles/cost.ts` 第 29-55 行（`UNIT_TO_ML`）

**问题：** `UNIT_TO_ML` 中没有 `cup/cups` 单位（1 cup ≈ 240ml）。当配方配料写 `"1 cup simple syrup"` 时，解析器找不到匹配单位，会回退到"无单位默认 ml"，将 `1 cup` 当作 `1 ml` 处理，导致成本计算偏差 **240 倍**。

**更优方案：** 在 `UNIT_TO_ML` 中补充 `cup/cups`：
```ts
[/\bcups?\b/i, 240],
[/\bpint\b/i, 473],
[/\bquart\b/i, 946],
```

---

### Bug 3 — `recipe/[id].tsx` 中 `STRENGTH_LABELS` 在英文模式下仍显示中文 【中危】

**文件：** `app/recipe/[id].tsx` 第 227-230 行

**问题：** 配方详情页的"酒精强度"元数据字段直接使用 `STRENGTH_LABELS[recipe.strength]`，而 `STRENGTH_LABELS` 的值是硬编码中文（`"轻盈"/"适中"/"浓烈"`）。与此形成对比的是，`recipes.tsx` 和 `compare.tsx` 中已正确做了 `lang === "en" ? t(...)  : STRENGTH_LABELS[...]` 的判断，但 `recipe/[id].tsx` 遗漏了这一处理。

**更优方案：** 统一使用 `lang === "en" ? t(\`strength.${recipe.strength}\`) : STRENGTH_LABELS[recipe.strength]`。

---

### Bug 4 — `extractRecipesFromText` 中 `lang` 参数定义但从未使用 【中危】

**文件：** `server/routers.ts` 第 669 行

**问题：** `extractRecipesFromText` 路由的 zod 输入模式中定义了 `lang: z.enum(["zh", "en", "auto"]).optional()`，但在实际构建 prompt 时完全没有使用 `input.lang`。无论用户切换到英文模式，AI 提取配方的 prompt 始终是中文，导致：英文模式下提取结果的 `nameZh`/`nameEn` 字段优先级可能不符合预期，且 prompt 中的示例字段名（如 `"配方名称（原文）"`）也始终是中文。

**更优方案：** 在 prompt 中根据 `input.lang` 动态调整输出语言偏好：
```ts
const langHint = input.lang === "en"
  ? "Prefer English for name field; fill nameZh if identifiable."
  : "优先中文填写 nameZh，nameEn 填英文原名。";
```

---

### Bug 5 — `matchPrep` 阈值边界导致 3 字中文词漏匹配 【中危】

**文件：** `lib/homemade/match.ts` 第 68 行

**问题：** 当配方配料名为 3 字中文（如"蜂蜜糖"）且自制库中存在"蜂蜜糖浆(3:1)"时，得分计算为 `50 + 3 = 53`，而阈值为 `54`，差 1 分导致漏匹配。4 字及以上中文词不受影响。

**更优方案：** 将 CJK 字符的最低长度要求从 `>= 3` 改为 `>= 2`，阈值保持不变（`>= 54`），或将阈值调整为 `>= 52`（允许 2 字中文词命中）：
```ts
else if (c.includes(q) && /[\u4e00-\u9fff]/.test(q) && q.length >= 2) score = 50 + q.length;
```

---

### Bug 6 — 大量 UI 文案使用 `lang === "zh" ? "中文" : "English"` 内联三元而非 `t()` 【低危/技术债】

**问题：** 经扫描，以下文件中存在大量绕过 i18n 体系的内联三元表达式：

| 文件 | 问题数量 | 典型示例 |
|------|---------|---------|
| `app/bottle-form.tsx` | 25 处 | `lang === "zh" ? "AI 识别补全" : "AI Lookup"` |
| `app/book-reader.tsx` | 33 处 | `zh ? "书籍不存在" : "Book not found"` |
| `app/bulk-import.tsx` | 11 处 | `lang === "zh" ? "文件过大" : "File too large"` |
| `app/recipe-form.tsx` | 18 处 | `lang === "zh" ? "AI 补全中…" : "AI filling…"` |
| `app/(tabs)/homemade.tsx` | 9 处 | `"AI 补全中… {done}/{total}"` 硬编码中文 |
| `app/(tabs)/bottles.tsx` | 4 处 | `"AI 补全中…"` 硬编码中文 |
| `app/(tabs)/index.tsx` | 3 处 | `` `共 ${recipes.length} 份配方` `` 硬编码中文 |

这些文案无法通过 `translations.ts` 统一管理，未来新增语言时需要逐文件修改。

**更优方案：** 将所有内联三元文案迁移到 `translations.ts`，通过 `t("key")` 调用。

---

### Bug 7 — 配方详情页缺少"复制配方"功能 【功能缺失】

**文件：** `app/recipe/[id].tsx`

**问题：** 配方详情页顶部操作栏仅有收藏、加入酒单、编辑、删除四个操作，缺少"复制/克隆配方"功能。在实际调酒工作中，基于经典配方创建变体是高频操作，用户目前只能手动新建并逐项填写。`lib/recipes/store.tsx` 中也没有 `duplicateRecipe` 方法。

**更优方案：** 在 store 中新增 `duplicateRecipe(id)` 方法，在详情页操作栏新增复制按钮（`doc.on.doc` 图标）。

---

## 三、设计层面的改进建议

### 建议 1 — `STRENGTH_LABELS` 应支持多语言

当前 `STRENGTH_LABELS` 是一个纯中文 Record，所有需要英文展示的地方都要单独写 `lang === "en" ? t(...) : STRENGTH_LABELS[...]`，容易遗漏（已在 `recipe/[id].tsx` 中遗漏一处）。更优方案是将其改为双语结构：
```ts
export const STRENGTH_LABELS: Record<Strength, { zh: string; en: string }> = {
  light: { zh: "轻盈", en: "Light" },
  medium: { zh: "适中", en: "Medium" },
  strong: { zh: "浓烈", en: "Strong" },
};
// 使用时：STRENGTH_LABELS[s][lang] ?? STRENGTH_LABELS[s].zh
```

### 建议 2 — `bulkImport.extract` 的 `llmExtract` 函数应接受 lang 参数

`EXTRACT_SYSTEM_PROMPT` 是纯中文 prompt，即使用户在英文模式下导入，AI 也会优先输出中文字段名。建议在 `llmExtract` 函数签名中加入 `lang` 参数，并在 prompt 末尾追加语言偏好指令。

### 建议 3 — `matchPrep` 和 `matchBottle` 应统一阈值策略

两个匹配函数的阈值逻辑不一致（`matchBottle` 无硬阈值，`matchPrep` 有 `>= 54` 阈值），容易造成"酒库能匹配但自制库匹配不到"的不对称体验。建议统一为基于覆盖率的相对阈值（如 `overlap / max(len_a, len_b) >= 0.6`）。

### 建议 4 — 配方详情页操作栏增加"复制配方"入口

详见 Bug 7。这是调酒师最常用的工作流之一，优先级较高。

### 建议 5 — AI 补全进度文案统一走 i18n

`"AI 补全中… {done}/{total}"` 这类带插值的进度文案目前散落在多个文件中，建议统一为 `t("common.aiProgress", { done, total })`，并在 `translations.ts` 中维护。

---

## 四、修复优先级总览

| 优先级 | Bug/建议 | 影响范围 | 修复难度 |
|--------|---------|---------|---------|
| P0 | Bug 1：Rye Whiskey 错误归类 | 成本计算、可制作判断 | 低（改 1 行正则） |
| P0 | Bug 2：`cups` 单位缺失 | 成本计算偏差 240× | 低（加 1 行映射） |
| P1 | Bug 3：强度标签英文模式显示中文 | 英文用户体验 | 低（加 lang 判断） |
| P1 | Bug 5：matchPrep 3 字漏匹配 | 自制库链接 | 低（改阈值） |
| P1 | Bug 4：lang 参数未使用 | AI 提取质量 | 中（改 prompt） |
| P2 | Bug 7：缺少复制配方功能 | 工作流效率 | 中（新增方法+UI） |
| P3 | Bug 6：i18n 技术债 | 可维护性 | 高（批量迁移） |
| P3 | 建议 1-5：架构优化 | 长期可维护性 | 中-高 |
