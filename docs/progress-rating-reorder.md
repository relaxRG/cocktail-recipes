# 进度笔记:评分 + 长按拖拽排序 + 滑动评分(本轮需求)

## 需求
1. 评分系统:酒单/酒库/自制库均支持 1-10 分(整数,无半星),星星展示(10 颗小星)
2. 长按拖拽排序:酒单与自制库列表项长按拖动手动排序并持久化(sortIndex)
3. 滑动手势:右滑快捷操作由"收藏"改为"评分"(弹出 1-10 星选择)

## 已完成(数据层)
- lib/recipes/types.ts: Recipe 加 rating/sortIndex + normalizeRating 工具,normalizeRecipe 兼容
- lib/recipes/seed.ts: mk() Omit 列表加 rating/sortIndex + 默认 null
- lib/recipes/store.tsx: RecipeDraft.rating; addRecipe 默认值; setRating/reorderRecipes action 已注册进 value/deps
- lib/homemade/types.ts: HomemadePrep 加 rating/sortIndex,normalizePrep 兼容
- lib/homemade/seed.ts mk 补 rating/sortIndex 默认;homemade store setPrepRating/reorderPreps 已注册
- lib/bottles/types.ts: Bottle 加 rating,normalizeBottle 兼容;bottles seed 补 rating: null
- lib/bottles/store.tsx: BottleDraft 放宽 rating;addBottle 默认;setBottleRating 已注册
- components/star-rating.tsx: 已建(readonly 小星+数值 / 10星可点,再点当前分=清除)
- components/rating-sheet.tsx: 已建(Modal 底部弹层,useI18n 从 @/lib/i18n 导入)
- i18n 词条已加:rating.title/tapToRate/clear, sort.rating/manual, reorder.enter/done
- TS 编译 0 错误(此时点)

## 待完成
- [完成] 详情页三处评分卡片已加(recipe/homemade/bottle 详情)
- [完成] 列表三处评分小星徽章已加(recipe-card、homemade PrepRowInner、bottles 行)
- [完成] swipeable-recipe-row 右滑(leftActions)收藏改评分,弹 RatingSheet
- [完成] 自制库 PrepRow 左滑动作已改为评分(RatingSheet),做过仍在行内勾圈
- [完成] sort.ts:三库加 ratingDesc,recipe/prep 加 manual;i18n 补 sort.ratingDesc;面板 sortOptions 由 *_SORTS 常量自动带出新选项
- 拖拽:酒单 index.tsx 与 homemade.tsx 长按进入排序模式;方案:安装 react-native-draggable-flatlist(reanimated+gesture-handler 已有)或长按弹出上移/下移。优先尝试 draggable-flatlist
- 测试:tests/rating.test.ts(normalizeRating、normalizePrep rating、排序 manual/rating)
- todo.md 勾选 + checkpoint

## 本轮新增(拖拽+快捷筛选,2026-07-07)
- [完成] 三库拖拽:index/homemade/bottles 三页 sort==="manual" 时切 DraggableFlatList,行右侧 44px 把手(line.3.horizontal),onLongPress=drag,onDragEnd 调 reorderRecipes/reorderPreps/reorderBottles;顶部 reorder.enter 提示条
- [完成] hooks/use-persisted-state.ts:usePersistedState(key, initial) AsyncStorage 持久化
- [完成] components/quick-filter-chips.tsx:QuickFilterChips 通用组件;QuickSelection=Record<父值,子值[]>;点父 chip=选中+展开子行,再点=取消;子 chip 多选;“全部”清空;与 Filter 面板完全独立
- [完成] 三页接入:酒单 quick.recipes.v1(分类→基酒,filterRecipes 加 baseSpirits);酒库 quick.bottles.bottles.v1 / quick.bottles.materials.v1(类别→风格,分组各自持久化,切分组不清空);自制 quick.homemade.v1(分区→类型,原 section 状态已删)
- [完成] 两层过滤:快捷筛选先过滤,面板多选再过滤(交集);酒单收藏 chip 保留在 leading 可切换
- 遗留小项:三页残留未用 ScrollView/chipStyle/subChipStyle 警告(非错误);待跑 vitest、更新 todo.md、checkpoint

## 关键现状(压缩后备查)
- 酒单滑动组件:components/swipeable-recipe-row.tsx 封装 SwipeableRow(components/swipeable-row.tsx,基于 ReanimatedSwipeable),index.tsx 与 recipe-group-card.tsx 使用
- 自制库行:app/(tabs)/homemade.tsx PrepRow(约416行起)用 SwipeableRow,made 快捷键在 rightActions;PrepRowInner(约590行)行尾有做过勾圈+chevron
- recipe-card.tsx:右侧有做过勾圈+收藏星,两个 Pressable
- 排序引擎:lib/recipes/sort.ts(含 bottles 排序);筛选面板:components/filter-sort-sheet.tsx(通用,酒单/酒库/自制库共用)
- homemade store: lib/homemade/store.tsx togglePrepMade 已有;bottles store 路径 lib/bottles/store.tsx(待确认 normalizeBottle)
- 测试跑法:npx vitest run;现有 153 pass + 1 skip
