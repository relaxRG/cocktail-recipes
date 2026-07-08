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
  (后续用户确认:Variant of 照旧展示,paradigm 不做特殊文案;paradigm 字段保留但展示层未用)

---

## Codex Family 三级优先级智能识别(2026-07-08)

需求:手动修改最高 > 导入文本明确声明(确认合法后采用) > 引擎自动判定;存量批量补齐空值。

### 已核实的接入点(文件:行号)
- `lib/recipes/types.ts:63` CODEX_FAMILIES 六值中文混写,如 "古典 Old-Fashioned"、"菲兹 Flip"(Flip 中文系早期误译,为兼容保留)。
- `lib/recipes/lineage.ts:596` inferFamily(roles, ingText, method) → FamilyKey(含 julep/duo_trio/tropical/snapper 扩展族)。
- `lib/recipes/lineage.ts:88` LineageVerdict { classic, family, ... };analyzeLineage 为主入口;inferVariantOf 已被 store 使用。
- `lib/recipes/store.tsx:154-161` 旧数据迁移处(variantOf 回填),codexFamily 批量补齐加在同一段。
- `lib/recipes/store.tsx:286,311` addRecipe/updateRecipe 保存时回填处。
- `lib/recipes/parser.ts:156` 文本字段解析注册表,已有 variantOf 正则;新增 codexFamily 声明解析(家族/Family/Codex 写法)。

### 实现方案
1. lineage.ts 新增 `toCodexFamily(verdict): string`:FamilyKey→CODEX_FAMILIES 字符串映射;
   julep→古典;tropical→椰浆乳脂判据→菲兹 Flip,柑橘酸甜→大吉利;duo_trio→乳脂→菲兹,纯利口酒→古典;
   snapper/unknown→ ""(不妄断)。依据 research/variant-lineage-research.md §八映射表。
2. lineage.ts 新增 `normalizeCodexFamilyDecl(raw): string`:把文本声明(中/英/别名,如 "Sour"→大吉利、
   "Daisy"→边车、"Spirit-forward"→马天尼)规范化为六值之一;非法返回 ""。
3. parser.ts 注册 `家族/Codex|Family` 字段正则 → normalizeCodexFamilyDecl 确认后写入 codexFamily。
4. store.tsx:迁移段+add/update 段,`!rec.codexFamily` 时用 toCodexFamily(analyzeLineage(rec)) 回填;
   手动值(表单已填)永不覆盖。
5. 测试:tests/lineage.test.ts 增加 toCodexFamily/normalizeCodexFamilyDecl 用例。

### 文献核对结论(已写入 variant-lineage-research.md §八)
- Codex 官方:Julep/Champagne Cocktail/Toddy→OF 族;Manhattan/Negroni→Martini 族;
  Margarita/White Lady→Sidecar 族(甜源=利口酒判据);White Russian/Piña Colada/Irish Coffee→Flip 族;
  Collins/Fizz/Buck/Mule→Highball 族。来源:VinePair 官方图解、Quizlet 原著摘录、
  Rusty Barrel 六部曲、r/bartenders 原著讨论(URL 已存研究文档)。

### 批跑结果(447 份 Waldorf)
马天尼125 / 大吉利122 / 古典94 / Flip40 / 高球39 / 边车20 / 未判定7。
抽查合理:苦艾菲兹→高球(Fizz 官方归 Highball 族)、Aviation→边车(利口酒甜源)、
亚历山大→Flip(乳脂)、越境→高球(姜汁啤酒 Buck)。
遗留:「鸟 Bird」(君度2oz+干邑1oz,纯利口酒 Duo)未判定——inferFamily 未走到 duo_trio 分支,
原因可能是君度被识别为柑橘利口酒甜源导致 roles 只有 sweet_liqueur 而无其他信号。
血腥玛丽类咸鲜(Snapper)不判定属预期。

修复后复跑:Bird→duo_trio→古典 OK,测试 345 过。剩余未判定 6 个:
血腥兔子/血腥玛丽(Snapper,预期);查理·罗斯(单一干邑纯饮,非鸡尾酒结构,预期);
桃子浸泡波本(浸渍酒非鸡尾酒,预期);Lucky George(Bushmills 威士忌+Giffard Banane 香蕉利口酒,
标准 Duo,应判但 Giffard Banane du Brésil 英文名未被 structure 识别为利口酒);
石围栏 Stone Fence(苹果酒+苹果白兰地,Highball 族 cider 长饮,cider 未在碳酸/长饮词表)。
结论:仅 2 例可改进且都是词表覆盖问题,不动引擎逻辑,补词表即可。

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

---

## 卡片 Apple 风格整理(2026-07-08 用户新指令)
需求:1) Variant of 去色块改纯文字与主名左对齐;经典本体标注「经典原方 Classic」;
2) 标签顺序整理避免截断;3) 卡片尺寸统一;4) 参照 Apple HIG 排版对齐。
已实现:
- variant-badge.tsx:compact 改纯文字(text-xs muted 无背景框);resolveVariantLabel 支持经典本体判定(isClassic);
  i18n 新增 variant.classicSelf(经典原方 Classic / Classic Original)。
- recipe-card.tsx:名称行 height 24 + baseline 对齐 + lineHeight 22;Variant 行 mt-0.5 独立一行;
  标签顺序=分类→Codex家族→基酒→烈度→评分→成本。
- recipe-group-card.tsx:组头同步名称行高/基线与标签顺序(版本数→分类→家族→基酒→烈度→对比)。
- 移动端 375x812 截图验收通过。
待办:全量测试;todo.md 勾选;checkpoint;交付。
