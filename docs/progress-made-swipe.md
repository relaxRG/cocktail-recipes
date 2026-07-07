# 进度笔记:做过状态 + 滑动手势(本轮)

## 已完成
- 数据层:Recipe.made / HomemadePrep.made 字段 + normalize 兼容;recipes store `toggleMade`、homemade store `togglePrepMade`;seed 补 made:false。TS 通过。
- 配方详情页 header:做过点击标记(checkmark.circle[.fill],绿色 success)。
- 自制品详情页 header:同上(togglePrepMade)。
- icon-symbol.tsx:新增 "checkmark.circle"→radio-button-unchecked、"checkmark.circle.fill"→check-circle。
- i18n:common.edit / made.badge(已做/Made)/ made.mark / made.unmark / swipe.favorite / swipe.unfavorite。
- recipe-card.tsx:已做绿色徽章(made.badge)。

## 待做
1. homemade.tsx PrepRowInner 徽章行加"已做"徽章(styles.badge + colors.success)。
2. 新建通用滑动组件 components/swipeable-row.tsx:
   - 用 react-native-gesture-handler 的 ReanimatedSwipeable(`react-native-gesture-handler/ReanimatedSwipeable`)
   - 左滑(renderRightActions):编辑(蓝 primary)+ 删除(红 error,带确认 Alert/confirm)
   - 右滑(renderLeftActions):酒单=收藏(星形,黄/primary);自制库=做过(绿 success)
   - 触觉反馈;web 平台降级(仍可用鼠标拖动,但删除确认用 window.confirm)
3. 酒单 index.tsx:RecipeCard 外层包 SwipeableRow(注意折叠组 RecipeGroupCard 内的行也要包)
   - index.tsx 列表项:单个配方行 + 组行(组行不包滑动,组内展开行包)
4. homemade.tsx:PrepRow/PrepRowInner 外层包 SwipeableRow(右滑=做过)
5. 编辑路由:配方 /recipe-form?id=,自制品 /homemade-form?id=
6. 删除 action:deleteRecipe(id) / deletePrep(id)
7. 测试:tests/made.test.ts(normalize made 默认 false、toggle 语义可测 store 纯函数部分);npx vitest run
8. todo.md 勾选、checkpoint、交付

## 注意
- GestureHandlerRootView 已在 app/_layout.tsx(模板自带,需确认)
- Pressable 不能用 className(全局禁用),用 style
- homemade.tsx 中行由 Pressable 包裹,SwipeableRow 包在 Pressable 外
