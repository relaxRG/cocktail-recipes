# 实施计划:酒库自定义专业分类 + 删种子 + Tags 区整合(2026-07-07)

## 现状
- 酒库分类:硬编码 BOTTLE_CATEGORIES(zh 值) + BOTTLE_CATEGORY_EN 映射 + BOTTLE_STYLES(Record<zh分类, string[]>);Bottle.category 存中文分类名,Bottle.style 存风格字符串
- 自制库:PrepSection/PrepType 已可自定义(homemade store,SECTIONS_KEY/TYPES_KEY),管理页在 app/prep-sections.tsx
- Tags 管理页:app/(tabs)/categories.tsx,SectionKey = "category" | "spirit" | "glass" | "flavor",板块切换 + DraggableRow 拖拽 + 中英名编辑 + 颜色
- 种子:lib/bottles/seed.ts buildDefaultBottles() 318 行;store.tsx 里 seed/merge 逻辑 + SEED_VERSION="5";tests/recipes.test.ts 大量用 buildDefaultBottles() 测成本匹配

## 设计
1. 新文件 lib/bottles/taxonomy.tsx:BottleTaxonomyProvider
   - BottleCategoryDef { key, zh, en, group: "bottles"|"materials" }
   - BottleStyleDef { key, zh?, en, category: key }
   - 默认体系 DEFAULT_BOTTLE_CATEGORIES / DEFAULT_BOTTLE_STYLES 按调研笔记(docs/research-bottle-taxonomy.md)细化
   - AsyncStorage 持久化 "bottles.categories.v1" / "bottles.styles.v1";API: add/rename(双语)/delete/reorder,类似 homemade sections
   - Bottle.category 继续存中文名(兼容旧数据+现有匹配逻辑),category def 的 zh 即存储值;删除分类时该分类下酒款归"其他"
   - style 同理存字符串(en 优先显示按 def)
2. 种子删除:buildDefaultBottles() 保留导出(供成本测试),但 store 初始化不再 seed;SEED_VERSION="6" 迁移:删除所有 builtin===true 的酒款
   - 测试改动:成本估算测试仍用 buildDefaultBottles() 纯函数(数据保留在 seed.ts 仅作测试/参考,不进入运行时)——或将测试所需最小数据内联;先保留 seed.ts 导出最简单
3. Tags 区整合:categories.tsx SECTION_KEYS 增加 "bottleCat"(酒库分类)、"bottleStyle"(酒库风格,按分类分组显示)、"prepSection"(自制分区)、"prepType"(自制类型,按分区分组)
   - bottleStyle 用 groupId=categoryKey 分组渲染(复用 groupedBlocks);prepType 用 section 分组
   - 板块切换 UI 改为横向滚动 chips(7 个板块)
4. 页面接入:bottles.tsx / bottle-form.tsx / bottle/[id].tsx 改从 taxonomy store 取分类与风格;filter 面板、快捷筛选沿用现有逻辑(输入变为动态列表)
5. 默认新分类体系(zh 存储值):金酒/伏特加/朗姆/威士忌/龙舌兰与阿加维/白兰地/利口酒/苦精/味美思/阿玛罗与开胃酒/加强酒/起泡酒/葡萄酒/清酒烧酒/中式白酒/果汁/软饮/糖浆/原材料/其他
   - 新增"阿玛罗与开胃酒"(替代旧"开胃酒")、"加强酒"(Port/Sherry/Madeira/Marsala)、"果汁"独立分类
   - 旧数据迁移:开胃酒→阿玛罗与开胃酒;葡萄酒中 Sherry/Port/Madeira style→加强酒(仅对 builtin 已删除后用户数据保守处理:只改"开胃酒"重命名)

## 顺序
A. [完成] lib/bottles/taxonomy.tsx 已建:BottleTaxonomyProvider/useBottleTaxonomy,API=addCategory(zh,en,group)/renameCategory/deleteCategory/reorderCategories/addStyle(category,name,zh)/renameStyle/deleteStyle/reorderStyles/categoryLabel(zhName,lang)/stylesOf(categoryZh)/categoriesOfGroup(group)/groupOf;存储键 bottles.taxonomy.categories.v1 / bottles.taxonomy.styles.v1;CATEGORY_MIGRATION_V6={开胃酒→阿玛罗与开胃酒};默认分类20个含新增"阿玛罗与开胃酒/加强酒/果汁";还需挂 provider 到 app/_layout.tsx
B. [完成] store.tsx v6:seeded!==\"6\" 时删 builtin + CATEGORY_MIGRATION_V6 改名;不再初始 seed;seed.ts 保留仅供测试
C. [完成] bottles.tsx / bottle-form.tsx / bottle/[id].tsx 已接入 useBottleTaxonomy(categoryLabel/stylesOf/categoriesOfGroup/groupOf);BottleCard 内自取 hook;_layout.tsx 已挂 BottleTaxonomyProvider
D. [进行中] 新组件已建:components/bottle-taxonomy-manager.tsx(BottleTaxonomyManager)与 components/prep-taxonomy-manager.tsx(PrepTaxonomyManager),均自带添加卡片+分类卡片(chevron 展开子级)。剩余:categories.tsx 加 SECTION_KEYS "bottleCat"/"prepSec" 两板块,active 时渲染新组件并隐藏旧的 add/tag-group/rows UI;板块切换 segment 改为可横向滚动;i18n 词条已加(tags.section.bottleCat/bottleStyle/prepSection/prepType/tags.bottleCount/tags.prepCount/tags.group.bottles/tags.group.materials)
E. 测试 + checkpoint

=== 验证结果(2026-07-07) ===
- tsc 0 错误;vitest 153 passed / 1 skipped
- /categories:6 板块横向滚动 segment 正常(分类/基酒/杯型/风味/酒库分类/自制分区)
- /bottles:空库空态正常,快捷 chip 显示新 taxonomy 分类(金酒/伏特加/朗姆...)
- /bottle-form:分类 chip 全部 20 个新分类,选中"金酒"时风格显示 8 种金酒风格+自填输入
- /homemade:空态正常,"导入常用自制示例"按钮保留
- / 酒单:正常
剩余:todo.md 勾选、checkpoint、交付

注意:categories.tsx 的 SECTION_LABEL_KEY/segment 行在 L30-38 与 L393-423;rows 空态判断 L582;新板块渲染直接在 ScrollView 内 early-branch 即可。tests/recipes.test.ts L106-120 断言旧 BOTTLE_CATEGORIES/bottleGroupOf(静态 types.ts 仍在,不受 taxonomy 影响,应仍通过)。

## 关键接入点备忘
- app/_layout.tsx:Provider 嵌套处需加 BottleTaxonomyProvider
- bottles.tsx 行号参考:quickParents 约 L99-113(用 BOTTLE_STYLES[cat]),styleOptions L115-126,dimensions L128-160
- bottle-form.tsx:L140 BOTTLE_CATEGORIES.map,L167-173 BOTTLE_STYLES[category]
- bottle/[id].tsx:L55 BOTTLE_CATEGORY_EN
- categories.tsx:SectionKey/SECTION_KEYS L30-38;rows L154;groupedBlocks L186;handleAdd L244;confirmDelete L257;renderRow 结构 L588+;styles 底部
- homemade store:useHomemadeStore 提供 sections/types 管理(addSection/renameSection/deleteSection/reorderSections/addType/...需确认函数名,见 lib/homemade/store.tsx L211-256)
- tests/recipes.test.ts 用 buildDefaultBottles 测成本;保留 seed.ts 导出仅供测试
