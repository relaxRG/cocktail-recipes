# 同名折叠 + 对比分析 实现笔记(工作进度)

## 需求
1. 同名配方/自制品多版本时,列表折叠为一组,可展开查看各版本
2. 产品对比分析页,参考苹果官网对比界面:多列并排、行分组规格对比

## 关键代码位置
- 酒单首页: `app/(tabs)/index.tsx` — FlatList 直接渲染 `filtered`(RecipeCard, isFirst/isLast 圆角);筛选 filterRecipes(recipes, query, {categoryId,favoritesOnly,codexFamily,flavor})
- RecipeCard: `components/recipe-card.tsx`(props: recipe, isFirst, isLast;内部显示双语名/ABV徽章/成本徽章)
- 自制库列表: `app/(tabs)/homemade.tsx` — rows = header + item(kind union), PrepRow(prep,isFirst,isLast,bottles);已有 technique 筛选
- Recipe 类型: `lib/recipes/types.ts`(name, nameEn, abv, strength, strengthBand, methodKey?, glass, spiritTags, flavorTags, ingredients[{name,amount}], steps, story, source, categoryId, variantOf...) — recipeDisplayNames 工具
- HomemadePrep: `lib/homemade/types.ts`(name, nameAlt, type, ingredients[string], recipe, yield, shelfLife, storage, notes)
- 成本: `lib/bottles/cost.ts` estimateRecipeCost(recipe,bottles,preps?) / `lib/homemade/cost.ts` estimatePrepCost(prep,bottles)
- ABV: `lib/recipes/abv.ts` estimateRecipeAbv;strength 标签 i18n key: strength.light/medium/strong
- 工艺: `lib/homemade/technique.ts` detectPrepTechniques/techniqueLabel
- i18n: `lib/i18n/translations.ts`(dict key 类型受限,新 key 必须先加词典)
- displayNames(en, zh, lang) 来自 `lib/utils.ts`;recipe 用 recipeDisplayNames(recipe, lang)

## 设计决策
- 同名分组 key:名称规范化(去空格/大小写/中英点缀)后 zh 名或 en 名任一相同即同组;实现于 lib/recipes/grouping.ts(新)与自制库复用 normalizeNameKey
- 折叠 UI:组头显示名称 + 版本数徽章(如 "3 个版本"),点击展开/收起;单个不折叠
- 对比页:app/compare.tsx(recipes)与 app/compare-preps.tsx 或统一 app/compare.tsx?type=recipe|prep&ids=...
  - 苹果风格:顶部各列产品名固定,下方分组行(基本信息/配料/做法),横向 ScrollView 支持 >2 列,每列宽 ~160
- 入口:组头"对比"按钮(≥2 版本时);详情页可加"加入对比"(暂缓)

## todo.md 待勾选项
- 同名折叠(酒单/自制库)、对比入口、苹果风格对比页、自制品对比
