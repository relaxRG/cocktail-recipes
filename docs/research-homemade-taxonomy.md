# 自制库专业分类体系调研与设计(含酒精/无酒精分组)

## 资料来源
- A Bar Above《Craft Mocktails Guide》: 无酒精自制原料 = 果汁、糖浆(syrups)、shrubs(醋饮)、tinctures、零度烈酒(zero-proof spirits)、无酒精苦精
- Feast+West《Homemade Zero-Proof Spirits》: 零度烈酒 = 茶/香料/草本水基浸取,模拟 gin/vodka/whiskey/tequila
- Kevin Kos / The Double Strainer: tincture = 高度酒精萃取浓缩液(含酒精,通常伏特加基);tinctured syrups
- Cocktail Codex / Death & Co: 自制分为 syrups、infusions(浸渍烈酒)、house liqueurs/cordials、bitters、shrubs、cordial(酸甜汁)
- Liquid Intelligence(Dave Arnold): 工艺向 = 澄清(clarified)、奶洗/milk punch、fat-wash(油脂洗)、carbonation、快速浸渍(iSi)
- Punch《Clarified Milk Punch》: 奶洗澄清预调 = 含酒精批量预调(batched/pre-mix)

## 酒精属性划分标准(abvGroup)
- alcoholic(含酒精): 浸渍烈酒(infused spirits)、自制利口酒/cordials(酒基)、tinctures(酒精萃取)、自制苦精(酒基)、fat-washed 烈酒、奶洗/澄清预调、自酿(发酵含酒精: 姜汁啤酒可>0.5%、米酒)、快手味美思等加强酒改制
- non_alcoholic(无酒精): 糖浆类(simple/rich/honey/orgeat/grenadine/oleo saccharum)、shrubs 醋饮、鲜榨果汁/cordial(柠檬水基)、零度烈酒(水基浸取)、无酒精发酵(康普茶/水开菲尔,≤0.5%)、乳制品/蛋白预制、装饰物(dehydrated citrus 等)、盐/糖边、泡沫/bitters替代(甘油基)
- 判定标准: 基液含酒精(烈酒/加强酒/利口酒浸渍或萃取)→ alcoholic;水/糖/醋/果汁基且无酒精添加 → non_alcoholic;发酵类按成品 ABV>0.5% 划分(自酿姜汁啤酒/米酒→含酒精,康普茶→无酒精,可手动调整)

## 新自制库顶层分组(类似酒库三分组)
- 含酒精自制 (alcoholic): 分区 = 浸渍烈酒/自制利口酒/自制苦精与酊剂/改制与预调(奶洗澄清、fat-wash、batched)/自酿发酵酒
- 无酒精自制 (non_alcoholic): 分区 = 自制糖浆/鲜榨与cordial/醋饮shrub/零度烈酒替代/无酒精发酵/装饰与其他

## 实施要点
1. HomemadePrep 增加 abvGroup 字段("alcoholic"|"non_alcoholic"),列表页顶层 segment 切换(同酒库三分组样式)
2. 迁移: 依据现有 type/section/abv 字段 + 关键词引擎自动归组;abv>0 → alcoholic
3. 智能识别: classify 引擎增加酒精属性判定(关键词: 浸渍/infused/利口酒/liqueur/tincture/苦精/bitters/奶洗/milk wash/fat wash/自酿/brew/vermouth → alcoholic;syrup/糖浆/juice/果汁/shrub/醋饮/zero-proof/无酒精/cordial水基/康普茶 → non_alcoholic)
4. 表单: 自动识别并预选 abvGroup,可手动切换;批量导入 LLM schema 增加 abvGroup 字段
5. 分区(PrepSection)增加 group 归属,标签管理中可调整;旧分区自动映射

## 现状代码关键信息(实施依据)
- `lib/homemade/types.ts`: HomemadePrep{id,name,nameAlt,type,ingredients[],recipe,yield,shelfLife,storage,notes,builtin,made,rating,sortIndex,createdAt,updatedAt}(无 abvGroup 字段)。PREP_SECTIONS=[homemade-syrup,homemade-liqueur,flavored-liquid,homemade-spirit,misc];PREP_TYPES 16 个(syrup/cordial/shrub→syrup区;liqueur/amaro→liqueur区;infusion/tincture/bitters/solution/juice→flavored区;fermented/fortified/redistilled→spirit区;batch/garnish/other→misc)。PrepSection{key,en,zh} 无 group 字段。工具函数:prepTypeLabelIn/prepSectionOfIn/prepSectionLabelIn(自定义列表+回退默认)。normalizePrep 兜底。
- `lib/homemade/store.tsx`: keys=homemade.preps.v1/sections.v1/types.v1;HomemadeProvider 提供 preps/sections/types 与 addPrep/updatePrep/deletePrep/togglePrepMade/setPrepRating/reorderPreps/importSamples/getPrep + section/type 管理(addSection/renameSection/deleteSection/reorderSections/addType/renameType/moveType/deleteType/reorderTypes)。filterPreps(preps,query,type?,section?,typesList?)。
- 实施: PrepSection 增加 `group?: "alcoholic" | "non_alcoholic"`;types.ts 加 PREP_GROUPS 常量与 prepGroupOf(sectionKey,sections) 函数;store 加载时迁移(旧分区映射:homemade-liqueur/homemade-spirit→alcoholic;homemade-syrup→non_alcoholic;flavored-liquid 按类型拆分:infusion/tincture/bitters→alcoholic 新区,juice/solution→non_alcoholic;misc 默认 non_alcoholic)。注意 flavored-liquid 区含混合酒精属性,需新增分区拆分并迁移类型归属。
- 智能识别引擎在 `lib/homemade/` 或 `lib/recipes/` 附近(classify/craft 关键词引擎),需 grep `craft\|classify` 确认文件名。

## 实施进度(阶段2数据层已完成)
- types.ts: 新增 PrepGroup("alcoholic"|"non_alcoholic")、PREP_GROUPS、prepGroupLabel、prepGroupOfSection、prepGroupOf(prep,sections,types)、classifyPrepGroup(智能关键词归组)、guessPrepType(text,types)(智能类型推断)、PREP_SECTION_MIGRATION({"flavored-liquid":"bitters-tincture"})。HomemadePrep 加 abvGroup: PrepGroup|null(null=跟随类型推断)。PrepSection 加 group?: PrepGroup。
- 新 11 分区: 含酒精=infused-spirit(浸渍烈酒)/homemade-liqueur(自制利口酒)/bitters-tincture(苦精与酊剂)/modified-spirit(改制与预调)/homemade-spirit(自酿发酵酒); 无酒精=homemade-syrup(自制糖浆)/juice-cordial(鲜榨与康迪奥)/shrub-vinegar(醋饮)/zero-proof(零度替代)/na-ferment(无酒精发酵)/misc(装饰与其他)。
- 新类型: fat-wash/rapid-infusion/falernum/rich-syrup/orgeat/oleo/zero-spirit/na-bitters/kombucha 等,共 24 个。
- store.tsx: TAXONOMY_V2_KEY="homemade.taxonomy.v2" 迁移标记;加载时 migrateSectionsV2/migrateTypesV2(默认体系替换+自定义保留补 group);旧条目类型不在新体系时用 classifyPrepGroup 归组。新增 setPrepGroup(id,group)、moveSection(key,group);addSection 加 group 参数;addPrep 的 abvGroup 可选。
- seed.ts: mk 补 abvGroup:null。

## 剩余适配点(阶段3/4)
1. homemade.tsx 列表页: 顶层加"含酒精/无酒精"segment(参考 bottles.tsx 三分组),quickSel 按组分 key(quick.homemade.alc.v1/quick.homemade.na.v1),分区 chip/子类型按组过滤,列表按组过滤(prepGroupOf)。
2. homemade-form.tsx: 类型选择按 分组→分区 层级展示;可加酒精属性覆盖开关(自动/含酒精/无酒精)。
3. bulk-import.tsx matchPrepType: 改用 guessPrepType(`${category} ${nameZh} ${nameEn} ${notes} ${ingredients}`)。
4. prep-taxonomy-manager.tsx(标签管理): 新建分区选归属组(addSection 第三参),行内显示组标签,moveSection 切组。
5. server/routers.ts EXTRACT_SYSTEM_PROMPT: prep 提示补充酒精属性说明(可选)。
6. i18n: hm.group.alcoholic/na 词条;homemade.tsx subtitle。
7. compare.tsx / app/homemade/[id].tsx 引用 prepTypeLabelIn 无破坏;详情页可显示组徽章(可选)。
8. 测试: tests/recipes.test.ts 可能引用旧 PREP_TYPES/sections;新增 classifyPrepGroup/guessPrepType 测试。

## 实施进度(阶段4 全部完成,tsc 0 错误)
- homemade.tsx: 顶层"含酒精自制/无酒精自制"segment(usePersistedState "homemade.group.v1"),
  两组独立快捷筛选 key(quick.homemade.alc.v1 / quick.homemade.na.v1),分区按 prepGroupOfSection
  过滤,条目按 prepGroupOf 过滤(abvGroup 覆盖优先),兜底 rest 展示;样式 groupSeg/groupSegText。
- homemade-form.tsx: 类型选择按 分组→分区→类型 三层展示(色点 warning/success 区分),
  名称失焦 guessPrepType 自动预填类型(typeTouched 后不覆盖)。
- bulk-import.tsx: guessPrepType 智能识别 + 入库带 classifyPrepGroup 的 abvGroup。
- prep-taxonomy-manager.tsx: 新建分区可选归属组(groupChip),分区行内分组标签
  (secGroupTag,点击切换 moveSection),排序函数更名 moveSectionOrder 避免与 store.moveSection 冲突。
- 截图验证: 列表 segment、表单三层类型选择、标签管理页均正常渲染。
- 剩余: vitest 全量回归、todo.md 勾选、检查点交付。
