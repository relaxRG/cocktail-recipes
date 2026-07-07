# 批量操作(多选模式)实施笔记

## 需求
酒单、酒库、自制库三个列表页支持:多选模式、批量删除(带确认)、批量更改标签/分类/分区。

## 已完成
### 数据层(全部完成, tsc 通过)
- `lib/recipes/store.tsx`: `deleteRecipes(ids)`, `bulkUpdateRecipes(ids, patch)` (patch 为 Partial<Recipe>, 已注册 value+deps)
- `lib/bottles/store.tsx`: `deleteBottles(ids)`, `bulkUpdateBottles(ids, patch)`
- `lib/homemade/store.tsx`: `deletePreps(ids)`, `bulkUpdatePreps(ids, patch)`

### 通用组件 `components/bulk-action-bar.tsx`(完成)
- `BulkActionBar`: props = { count, total, onSelectAll, onClearAll, actions: BulkAction[] }
  - BulkAction = { key, label, icon?, destructive?, onPress }
  - 底部絕对定位栏: 已选数量 + 全选/取消全选 + 横向滚动操作按钮
- `BulkEditSheet`: props = { visible, title, options: {key,label,color?}[], multi?, count, allowClear?, onApply(keys), onClose }
  - Modal 底部弹层, 单选/多选 chip, allowClear 时有"清除该字段"按钮(onApply([]))

### i18n 词条(lib/i18n/translations.ts, 在 bulk.clear 后)
- sel.enter(多选)/sel.exit(完成)/sel.count/sel.all/sel.none/sel.delete
- sel.delete.confirmTitle/confirmMsg({n})
- sel.setCategory/setStyle/setFlavor/setType/setSection
- sel.applied/sel.deleted/sel.sheet.title/sel.sheet.apply({n})/sel.sheet.clearField
- 注意: t() 不支持第二参数替换这些新词条时用 .replace("{n}", ...)(index.tsx 的 t 支持参数对象,但我用了 replace 写法保险)

### 酒单页 app/(tabs)/index.tsx(完成, tsc 通过)
- state: selectMode, selectedIds, bulkSheet("category"|"flavor"|null)
- store 解构增加 deleteRecipes, bulkUpdateRecipes
- visibleIds = sorted.map(id); toggleSelect/exitSelectMode/handleBulkDelete(web 用 window.confirm, native 用 Alert)/handleBulkApply
  - category: bulkUpdateRecipes(ids, { categoryId: keys[0] ?? null }) (allowClear 传 [] 清除)
  - flavor: bulkUpdateRecipes(ids, { flavors: keys }) (多选)
- 头部右侧"多选/完成"按钮(styles.selectBtn)
- 渲染: selectMode 时渲染平铺 FlatList(RecipeCard + 左侧勾选圈, pointerEvents="none" 包卡片), 隐藏 FAB, 显示 BulkActionBar + BulkEditSheet
- styles: selectBtn/selectBtnText/selRow/selCheckWrap

## 待办
1. ~~酒库页 bottles.tsx~~ 完成: 多选按钮在标题行右侧, 操作=改分类(单选, 全部三分组分类, 改分类同时清空 style)/改风格(bulkStyleOptions=所选条目分类并集的预设风格, allowClear)/删除; styles 补在 fab 后(注意 fab 属性中间插入过一次已修复)
2. **自制页 homemade.tsx**(进行中): 
   - store: `const { ready, preps, importSamples, sections, types, reorderPreps } = useHomemadeStore()` 行63; 需加 deletePreps, bulkUpdatePreps
   - PrepType = { key, en, zh, section }; prep.type 存 type 的 key; 类型标签 prepTypeLabelIn(types, key, lang); 分区标签 prepSectionLabelIn(sections, key, lang)
   - 批量改类型: bulkUpdatePreps(ids, { type: keys[0] }) — 分区/分组由 type 隐含带出; 批量改分区不单独做(类型选项按分区分组展示即可, BulkEditSheet options 平铺全部 types, label = 类型名(分区名))
   - 列表: 普通模式渲染 rows(带 header/group/row 三种), 多选模式直接平铺 sorted + PrepRowInner(props: prep,isFirst,isLast,bottles) + pointerEvents none
   - 标题行: 341 行 flex-row items-end, 在 flex-1 View 后加多选按钮
   - FAB 在 549 行; manualMode 分支 485 行
3. 三页 selectMode 时隐藏 FAB 与手动排序列表(酒单/酒库已做)
4. 测试 + todo.md 勾选 + checkpoint; i18n 键 sel.* 已存在; styles 需加 selectBtn/selectBtnText/selRow/selCheckWrap(样式与另两页一致)

## 关键参考
- 酒单页多选渲染 JSX 模式可直接复制到另两页(改数据源与卡片组件)
- bottles.tsx 列表数据变量名/结构需 grep; homemade.tsx 同
