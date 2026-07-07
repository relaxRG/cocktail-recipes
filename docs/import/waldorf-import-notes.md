# Waldorf 酒书导入进展笔记 (2026-07-08)

## 数据状态
- EPUB 已解压: docs/import/waldorf/OEBPS/xhtml (47 个 xhtml)
- 章节文本: docs/import/waldorf-text/ (A-Z 章节, 共 492 个 ## 标题)
- 分块文件: docs/import/waldorf-chunks/chunk_01..33.txt (每块约15配方)
- 合并结果: docs/import/waldorf-recipes-merged.json — 447 个配方(去重后)
  - 字段: nameEn/nameZh/category/baseSpirit/codexFamily/glass/method/ice/ingredients[{name,amount}]/steps/garnish/source/story/abvHint/notesEn
  - 质量: nameZh 无缺失, ingredients 无缺失, ice 缺1个
  - chunk_28 (S字母部分约15配方) 提取失败, 用户明确说跳过
- map 结果文件: /home/ubuntu/extract_waldorf_recipes.json (含各块 S3 URL)

## 用户需求(本轮)
1. 书中配方+关键信息导入应用 ✔ 数据已提取
2. 新建配方表单增加"冰块类型"选择字段(大方冰/标准方冰/碎冰/球冰/无冰/长条冰)
3. CREATOR/创作者等信息归入"引用来源"字段 ✔ 已在 source 中
4. 参考淘宝/京东/美团等中国平台为酒款/原料填充合理偏低价格(后续:导入配料对应酒款时)
5. 用户说"跳过未完成任务,展示现有结果" → 用447个配方直接导入

## 导入方案
- 应用配方存储: AsyncStorage,由 lib/recipes store 管理(React Context)
- 导入方式选项: A) 生成种子 JSON 由 app 内置导入入口加载; B) 写入内置 seed 文件由 store 初始化加载
- 注意: 之前酒库种子数据被要求删除(空库),但酒单配方导入是用户明确要求的
- ice 字段需加入 Recipe 类型 + 表单 + 详情 + 双语翻译
- 沙盒文件系统有同步延迟问题: webdev_apply_patch 新建文件可能延迟落盘,用 shell cat> 写文件更稳
- server/routers.ts 有未提交的报价表增强改动(供应商报价表 prompt);最新 git HEAD=ec50bd3e,检查点 93c1b94b 存在于 webdev 检查点列表但 git log 无(注意!)

## 关键文件
- lib/ 下 recipe store 具体路径待查: lib/recipes/ 或 lib/recipe-store.tsx
- 表单页: app/recipe-form.tsx (待确认)
- 翻译: lib/i18n/translations.ts

## 已完成 (2026-07-08 第二轮)
- ice 字段: types.ts(Recipe接口+normalizeRecipe+ICE_TYPES常量+TAG_NAME_DICT词典6种冰) ✔
- store.tsx: RecipeDraft.ice?可选 + addRecipe 默认 "" ✔
- seed.ts: 4处 mk draft 补 ice:"" (sed在method行后插入) ✔
- recipe-form.tsx: ice state + draft.ice + 杯型后 ChipGroup(可再点取消) + import ICE_TYPES ✔
- translations.ts: form.ice(209行) detail.meta.ice(151行) ✔
- app/recipe/[id].tsx: metaItems 加冰块条目(有值才显示) ✔
- TS 0 errors

## 导入实现方案(确定)
- 生成 lib/recipes/waldorf.ts (或 assets json + loader): 包含447配方 Recipe[] 完整字段
- store.tsx 加载时: 检查 AsyncStorage 键 WALDORF_IMPORTED_KEY,未导入则 append 到现有配方并置位,避免重复
- 分类: 需确保 categories 中存在对应分类(经典/当代创作等)→ 映射到 cat-classic 或新建分类
- 字段映射: nameEn→nameEn, nameZh→name, category→categoryId(映射), baseSpirit(需匹配 BASE_SPIRITS 或标签), codexFamily("古典"→"古典 Old-Fashioned"格式), glass, method, ice, ingredients(补id), steps, garnish, source, story, abvHint→abv?(用估算), notesEn→notes
- 杯型词汇: 数据中有 碟形杯/马天尼杯/柯林斯杯 等,应用 GLASSES 用 库佩杯/柯林杯,需映射: 碟形杯→库佩杯, 柯林斯杯→柯林杯
- 基酒: 数据 朗姆酒→朗姆, 苦艾酒/利口酒/葡萄酒/香槟→需保留(标签库有 苦艾酒/香槟 词典), 龙舌兰→龙舌兰
- codexFamily 映射: 古典→"古典 Old-Fashioned", 马天尼→"马天尼 Martini", 大吉利→"大吉利 Daiquiri", 边车→"边车 Sidecar", 高球→"高球 Highball", 菲兹→"菲兹 Flip"(注意 CODEX_FAMILIES 里菲兹对应 Flip)
- category 映射: 经典鸡尾酒→cat-classic; 其余(当代创作/提基热带/餐前酒/餐后酒/长饮/短饮/无酒精)→ 新建 Category(生成固定id cat-waldorf-xx)
- 价格任务(用户要求): 之后为主要酒款/原料生成中国市场偏低参考价,导入酒库 — 可从447配方提取高频品牌酒款清单,LLM/搜索估价,批量入酒库(lib/bottles)

## 已完成 (第三轮)
- assets/waldorf-recipes.json: 447配方规范化(杯型/基酒/分类/冰/方法映射+source统一含书名)
- lib/recipes/waldorf.ts: buildWaldorfRecipes/buildWaldorfCategories + WALDORF_DATASET_KEY
- store.tsx 启动时一次性合入(按nameEn去重,7个新分类 cat-waldorf-*)
- tests/waldorf.test.ts 6/6 通过;预览显示"共447份配方"
- 剩余: 酒款/原料中国参考价填充(待用户确认范围) + 保存检查点
