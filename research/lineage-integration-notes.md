# 变体说明功能接入点笔记(内部)

## 进度(2026-07-08)
- 引擎完成:signature 已改为 string[][](组=同义词数组,组内任一命中即组命中);
  评分权重:基酒25(不合兜底8)/角色25/签名35(<50%命中扣至-20)/方法10/家族5;名称直判95。
- 已接入:详情页「变体说明」区块(i18n: detail.lineage / detail.lineage.hint,位于 detail.notFound 后)、
  store addRecipe/updateRecipe/加载迁移自动回填 variantOf(人工优先)。
- 测试:tests/lineage.test.ts 10/10 通过;全仓 337 通过。
- Waldorf 全量 447:high=260 medium≈99 low≈88;variantOf 回填 311/447。
- 已修:Dark'n'Stormy 加黑朗姆签名组、新增 Buck/Mule 范式锚点、Tequila Sunrise 加特其拉签名、
  Amaretto Sour 双计签名、5 处锚点中文名占位清理。
- 运行时曾报「s.toLowerCase is not a function」于 store 加载(00:50-00:51,signature 结构过渡期的旧代码),
  修复后测试全过;需重启 dev server/刷新预览确认消失。
- 待办:重跑批量脚本验证越境(姜汁啤酒+梅斯卡尔)现应判 Buck/Mule;详情页截图验收;更新 todo.md;保存检查点。
- 调试脚本:/tmp/batch-lineage.ts /tmp/spot.ts /tmp/repro.ts(绝对路径导入)。

## 呈现方式改版(2026-07-08 用户新指令)
- 用户确认:详情页只展示一行「Variant of 经典名」标注,点按弹底部资料浮层(完整论证);
  列表卡片也展示「Variant of ××」小标签(仅名称,不可点开);本身即经典不显示;人工 variantOf 优先。
- 已实现:components/variant-badge.tsx(VariantBadge full/compact 两模式 + resolveVariantLabel);
  详情页 [id].tsx 已用 <VariantBadge mode="full"> 替换原长文区块(约263行处);
  recipe-card.tsx 标签行加 <VariantBadge mode="compact">(codexFamily 徽章后);
  i18n 新增 variant.of / variant.sheet.title;icon-symbol 加 book.fill→menu-book。
- 又修:medium 判定收紧(签名核心<50%命中上限压59)、Tequila Sunrise 加特其拉签名组、
  Buck/Mule 锚点已加。全量:high=260 med=98 low=89,回填310/447;337 测试全过。
- 待办:recipe-group-card.tsx 组头是否加标签(暂不加,组内版本卡片已有);
  验证 compact 标签在卡片高度 24 行内不溢出;跑全量测试;更新 todo.md;检查点;截图验收。
- 验收截图发现:出现「Variant of 高球/嗨棒 Highball」「Variant of 巴克/骡子范式 Buck / Mule」
  这类"范式/家族"锚点被当作具体经典展示,观感不严谨。处理:锚点增加 paradigm 标记,
  paradigm 锚点在 Variant of 标注中显示为「××家族」文案(variant.family i18n),避免误导。

已完成:
- research/variant-lineage-research.md:多文献研究文档(Codex/Regan/Embury/Wondrich/Difford/Death&Co)
- lib/recipes/lineage.ts:经典变体识别引擎(60+ 锚点、家族决策树、加权评分 30/30/15/15/10、
  deviations 推导、narrative 生成、inferVariantOf)

接入点:
1. app/recipe/[id].tsx:大标题下方(约 262 行 recipe.variantOf 区块处)加「变体说明」纯文本区块;
   人工 variantOf 优先展示;调用 analyzeLineage(recipe) 实时计算(纯本地,无需缓存)。
2. lib/recipes/store.tsx:addRecipe/updateRecipe 中若 draft.variantOf 为空调用 inferVariantOf 自动回填;
   加载迁移(约 152 行 classifyRecipe 处)对存量空 variantOf 的配方批量回填(migrated 标记)。
3. lib/i18n/translations.ts:新增 detail.lineage 标题("变体说明"/"Variant Analysis")与
   detail.lineage.hint(基于专业文献智能判定说明)。
4. tests/lineage.test.ts:验证 Negroni/Margarita/Old Fashioned/Boulevardier/未知配方等判定。

关键既有接口:
- analyzeStructure(ingredients) → StructureItem[]{role} (lib/recipes/structure.ts)
- Recipe 字段:variantOf: string; codexFamily: string (lib/recipes/types.ts)
- 详情页 i18n:t("detail.variantOf", {name}) 已存在(translations.ts:270)
- store 迁移模式:normalizeRecipe→estimateRecipeAbv→classifyRecipe→migrated 标记(store.tsx:136-154)
- 详情页结构公式区块已用 analyzeStructure/structuralFormula(detail.structure @ translations.ts:322)
