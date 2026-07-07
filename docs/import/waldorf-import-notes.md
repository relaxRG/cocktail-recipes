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

## 沙盒重置事件 (2026-07-08 第三轮)
- 沙盒被重置,项目恢复到检查点 4be89cea(447配方+冰块字段已交付版本,该部分安全)
- 丢失未提交改动(需重建):
  1. lib/bottles/waldorf-ingredients.ts (配料导入模块: buildWaldorfBottles/buildWaldorfPreps/WALDORF_ALIAS_MAP)
  2. assets/waldorf-ingredients.json (474 bottles + 72 preps + 903 aliasMap)
  3. lib/bottles/store.tsx + lib/homemade/store.tsx 的 Waldorf 合入逻辑(键: cocktail_waldorf_ingredients_v1 / homemade.waldorf.v1)
  4. lib/recipes/ingredient-display.ts (双语显示工具: resolveIngredientNames/ingredientDisplayName/garnishDisplayText + 常用词词典)
  5. app/recipe/[id].tsx 三处接入(配料行/装饰/成本区)
  6. /home/ubuntu/normalize_waldorf_ingredients.json (map结果,S3 URL已丢失,需重跑 map 或从 CSV 恢复)
- map 结果 CSV/JSON 在 /home/ubuntu/ 下,已被清除;19块 ing-chunks 输入文件也丢失
- 重建路径: 重新运行 scripts/collect-ingredients.py(如还在) → 若脚本丢失全部重写 → 重跑 map(19块)
- 步骤翻译任务(828条 steps+garnish 句子, 4块)尚未执行
## 双语显示方案(已定)
- 配料: ingredientDisplayName(raw, lang, bottles, preps) 优先级: Waldorf aliasMap → 酒库双语 → 自制库双语 → 通用词词典 → 原文
- 装饰: garnishDisplayText 整体解析+分隔符逐段解析
- 步骤: 触发 map 翻译707句中文步骤+装饰词组 → 生成 zh→en 映射 assets/waldorf-steps-en.json → stepsDisplayText 按行查映射

## 重建完成 (2026-07-08 第三轮续)
- map 重跑: 23块(19 ing + 4 steps), 21成功; steps_1/steps_2 失败(用户要求跳过,未翻译句子回退中文)
- 903配料全部规范化; 资产 assets/waldorf-ingredients.json: bottles 481 / preps 63 / alias 903 / stepsEn 388
- 已重建: lib/bottles/waldorf-ingredients.ts, lib/recipes/ingredient-display.ts
- store 合入: bottles(键 cocktail.bottles.waldorf.v1), homemade(键 homemade.waldorf.v1)
- 详情页4处接入双语显示(配料/步骤/装饰/成本区)
- 测试: 169 passed(waldorf-ingredients.test.ts 10项新测试)
- 截图验证: 酒单447配方正常; 酒库基酒库179款(伏特加/龙舌兰/朗姆/金酒等,中英名+参考价)
- 价格覆盖率: 468/481

## 私密网页版阶段(2026-07-08)
- DB: 新表 sync_data(userId,storageKey,value,clientUpdatedAt 唯一索引 user+key) 与 app_config(configKey unique)。迁移已用 webdev_execute_sql 应用。
- server/db.ts: getSyncData/upsertSyncData(LWW)/getAppConfigValue/setAppConfigValue。
- server/routers.ts: sync 路由(access/pull/push, protectedProcedure),ensureOwner:第一个登录用户 openId 写入 app_config.ownerOpenId,之后仅 owner 放行,否则 FORBIDDEN。
- lib/sync/engine.ts: SYNC_KEYS 18个键;notifySyncChange(key)→脏键 debounce 3s push;runInitialSync 按 clientUpdatedAt LWW 合并,云端新→覆盖本地并 web reload;本地新→分批(8/批)上传。时间戳键前缀 sync.ts.。
- lib/sync/provider.tsx: SyncProvider(useAuth 驱动;pull 失败 FORBIDDEN→accessAllowed=false);login 动态 import constants/oauth startOAuthLogin。
- components/web-auth-gate.tsx: web 未登录→登录页;非 owner→拒绝页;native 不拦截。
- app/_layout.tsx: I18nProvider > SyncProvider > WebAuthGate > RecipeProvider...
- stores 已接 notifySyncChange(脚本 scripts/wire-sync-notify.py,相对路径导入 ../sync/engine 以兼容 vitest 无 @/ 别名)。
- me.tsx 加了云端同步卡片(icloud.fill→cloud 映射已加)。translations.ts 加 gate.*/sync.* 键。
- global.css 加 Apple 风格: >=768px 时 #root>div max-width 560px 居中+阴影+径向渐变背景、系统字体栈、细滚动条。截图验证:1440px 下登录门居中但容器阴影未见(#root>div 可能不是直接子层,待验证已登录主界面)。
- /api/auth/me 未登录 403→401 是模板正常行为。
- 170 tests pass。TS 0 errors。上个检查点 9586e643。

## 放弃网页版(2026-07-08)
- 用户决定只要 App 版,不要网页版、不修网页 OAuth 登录问题。
- 已修复: global.css 还原为仅 3 行 tailwind 指令(此前 Apple 风格 CSS 的 radial-gradient 简写导致 react-native-css-interop parseDeclaration 崩溃, Metro 报 Cannot read properties of undefined reading '0')。
- 已移除: app/_layout.tsx 中 WebAuthGate(登录门),保留 SyncProvider(云端同步可选:me 页登录则同步)。
- components/web-auth-gate.tsx 文件保留但未引用。sync 后端路由/表保留。
- 重启 dev server 后无新崩溃。App web 预览恢复正常显示 447 配方。
- 当前预览域名: 8081-ifz0mpj8uabc1h83acyj6-1a396481.sg1.manus.computer (二维码 expo-qr-code.png 已按此生成)。

## 修复 maximum update depth exceeded(2026-07-08)
- 根因: sync/engine.ts setState 每次创建新 state 对象并通知订阅者,未登录时 SyncProvider effect 每次运行 disableSync→emit 新对象→SyncProvider setState→重渲染→effect 依赖 utils/pushMutation(每渲染新引用)再次运行→死循环。
- 修复: engine.setState 仅在实际值变化时 emit;provider 中 pushMutation/utils 改用 ref,effect 依赖收敛为 [authLoading, isAuthenticated, user?.id, pushFn],未登录分支 setAccessAllowed 加条件。
- 验证: 测试 169 通过,web 预览 / 与 /me 正常渲染,日志无新报错。

## 智能配料链接功能(2026-07-08 进行中)
任务: 配料自动链接酒库/自制库产品,应用到详情页与新建/编辑表单。
已完成:
- lib/recipes/smart-link.ts 已创建: smartLinkIngredient(name,bottles,preps) 多级匹配(精确→Waldorf别名→同义词→模糊matchPrep/matchBottle→规范名模糊),返回 {kind:"bottle",bottle}|{kind:"prep",prep}|null; smartLinkAll 批量。
待做:
1. 详情页 app/recipe/[id].tsx: 配料行现只用 matchPrep(preps) 链接自制品(约267行),改用 smartLinkIngredient 同时支持跳酒库 /bottle/[id](需确认酒库详情路由名: 查 app/bottle*)与自制 /homemade/[id]; 链接文案 detail.homemade.link 已有,需加 detail.bottle.link 翻译键(lib/i18n/translations.ts)。
2. 表单 app/recipe-form.tsx: 配料行(608行起)已有 suggestIngredients(lib/suggest.ts)与 analyzeUnknownIngredient(lib/classify.ts); 增加实时匹配指示:输入配料名后用 smartLinkIngredient 显示"已链接到 XX"(绿色勾/图标),未匹配显示灰色提示。焦点行 focusedIngredientId state 已存在。
3. 测试: tests/ 下加 smart-link.test.ts(引用相对路径导入,vitest 无 @/ 别名)。
关键事实:
- Ingredient 类型 {id,name,amount} 在 lib/recipes/types.ts,无需加字段(运行时动态匹配,不持久化链接)。
- 成本估算 estimateRecipeCost(lib/bottles/cost.ts) 用 matchBottle;详情页 fallback estimateHomemadeIngredientCost。
- 酒库详情路由需确认: ls app 查看 bottle 路由文件名。
- 翻译文件 lib/i18n/translations.ts, key 风格 "detail.homemade.link": {zh,en}。
- 169 测试通过为基线;沙盒内存高压,注意 drop_caches。

### 智能链接功能完成(2026-07-08)
- lib/recipes/smart-link.ts: smartLinkIngredient/smartLinkAll 多级匹配引擎
- 详情页 app/recipe/[id].tsx: 配料行链接酒库(link图标+detail.bottle.link)与自制(sparkles+detail.homemade.link),可跳转 /bottle/[id] 或 /homemade/[id]
- 表单 app/recipe-form.tsx: 输入配料实时显示"已链接酒库:{name}"(form.bottle.matched)或"已在自制库:{name}",点击可跳转;未匹配走 suggestPrep/classification 建议入库
- icon-symbol.tsx 添加 "link": "link" 映射
- 真实数据验证: 1883 配料匹配 1874 (99.5%), 酒库1665/自制209; 未匹配仅冷水/冰水/蛋/大方冰等通用词(合理)
- 179 项测试通过(新增 tests/smart-link.test.ts 9项), TS 零错误

## 2026-07-08 智能成本估算修复(进行中)
- 用户需求1: 配料名直接替换为酒库/自制库规范名+点击跳转 → 已完成(详情页+成本区+表单)
  - smart-link.ts 加了 smartLinkDisplayName(link, lang) 返回 {primary, secondary}
  - 表单 recipe-form.tsx: 匹配提示旁增加"替换为规范名"按钮(pickSuggestion 替换输入)
  - 翻译键 form.replaceCanonical (393行后), 图标 arrow.triangle.2.circlepath→sync (icon-symbol.tsx 49行后)
  - tests/smart-display.test.ts 4项通过
- 用户需求2: 修复成本估算价格不显示/总成本算不出
  - 诊断: 旧 estimateRecipeCost 只用 matchBottle, 1883配料中732 no_bottle, 其中636可被 smartLink 修复
  - 新建 lib/recipes/smart-cost.ts: estimateRecipeCostSmart 复用 smartLinkIngredient 五级匹配
    + parseAmountLoose 支持 dash(0.9ml)/drop/pinch/rinse/barspoon/tsp/tbsp/splash/float/top
    + 自制品走 estimateHomemadeIngredientCost (来自 lib/homemade/cost.ts 362行)
  - 待办: 详情页 [id].tsx 64-75行改用 estimateRecipeCostSmart; 成本区渲染(396-490行)已用 cLink/cSmart 智能名
  - 诊断脚本: scripts/diag-cost.ts (旧) / diag-cost2.ts (新,待运行)
- 详情页成本区当前结构: costEst.items.map 内 row 变量 + cLink 智能链接 + Pressable 跳转 (415-490行)

## 2026-07-08 新维度:饮用时长+饮用场合

## 2026-07-08 单位智能转换统一(本轮)
- formatAmountAsMl(lib/bottles/cost.ts): 非液体 NON_LIQUID_RE(片/个/块/cube/leaves/mint/cloves/whole/small/rind/egg等)原样保留;
  含 or/或 多方案不转换;纯数字无单位视为计数不转;液体单位(oz/cl/dash/tsp/吧勺)→ml
- 应用位置: 详情页配料区+结构公式(formatAmountAsMl 作为 structuralFormula 第3参)、对比页配料行
- abv.ts NON_LIQUID_RE 词表已同步扩充
- 审计脚本 scripts/audit-amounts.py(扫描 assets/waldorf-recipes.json 非标单位)
- 结构公式区块已移至 做法/装饰 之后(app/recipe/[id].tsx)
- 引用来源结构化: lib/recipes/source-parse.ts parseSource(venue/creator/season/year),详情页来源区分行展示,无法解析回退原文
- 易失效产品整瓶计成本: smart-cost.ts isPerishableWholeBottle(软饮类别或碳酸/果汁关键词,排除糖浆/苦精/鲜榨),
  cost=整瓶价, wholeBottle=true, amountMl 保持真实用量;详情页注记 detail.cost.wholeBottle
资料依据: IBA官方分类(Before Dinner/After Dinner/All Day/Longdrink), 维基"餐前酒和餐后酒", 知乎/搜狐中文调酒资料(按饮用时间场合分:餐前/餐后/晚餐/睡前/派对)
设计:
- duration 维度(tag kind="duration"): 短饮 Short Drink / 长饮 Long Drink
- occasion 维度(tag kind="occasion"): 餐前酒 Aperitif / 餐后酒 Digestif / 全天酒 All Day / 佐餐酒 With Dinner / 睡前酒 Nightcap / 派对酒 Party
- 均为可自定义标签(标签管理),配方字段 drinkDuration / occasion (string, 存标签name)
- 自动归类规则: 现有 categoryId(短饮/长饮/餐前酒/餐后酒等) + codexFamily + ABV + 成分特征

### 新维度实现进度(types.ts 已完成)
- TagKind 增加 "duration"|"occasion"; TAG_KIND_LABELS 增补; Recipe 增 drinkDuration/occasion 字段(normalizeRecipe/默认值已补)
- DRINK_DURATIONS=[短饮,长饮], OCCASIONS=[餐前酒,餐后酒,全天酒,佐餐酒,睡前酒,派对酒], buildDefaultTags 已生成
- TAG_NAME_DICT 增补: 短饮→Short Drink,长饮→Long Drink,餐前酒→Aperitif,餐后酒→Digestif,全天酒→All Day,佐餐酒→With Dinner,睡前酒→Nightcap,派对酒→Party
- 待办: store.tsx 老用户注入新kind默认标签(tagList 里无 duration/occasion 时追加); waldorf.ts/seed.ts 补字段;
  自动归类(cat-waldorf-short→短饮 等映射+ABV/杯型推断); recipe-form 两个选择区; 详情页显示; 首页筛选; tags.tsx 管理页新增两个 section

### 新维度进度2(已完成部分)
- types.ts / seed.ts / waldorf.ts / store.tsx(RecipeDraft待确认) 均补 drinkDuration/occasion 字段, TS 0 errors
- classify.ts 归类引擎已建: inferDrinkDuration(cat-waldorf-short/long → 直接; 杯型LONG/SHORT_GLASSES; LENGTHENERS软饮→长饮; 兜底方法), inferOccasion(cat-waldorf-aperitif/digestif直接; DIGESTIF_INGREDIENTS奶油咖啡→餐后; APERITIF_INGREDIENTS苦味加强酒+abv≤25→餐前,金巴利/阿佩罗恒餐前,高酒精其他→睡前; tiki/椰浆→派对; na→全天; abv≥30→睡前; 其余全天)
- store.tsx 加载迁移: classifyRecipe(rec) 补全存量; 老用户 tags 注入 duration/occasion 默认标签
- tags.tsx 管理页已接入两个新 section + i18n(tags.section.duration/occasion)
- 表单页结构: state 在 ~114 行(flavors), draft 提交在 ~259 行, flavors chips 区在 482-539, Codex 区在 441-467; ChipGroup 组件可复用(options/value/onChange/labelOf)
- 待办: recipe-form 加 duration/occasion 单选 ChipGroup(state+draft+编辑回填); RecipeDraft 接口补可选字段; 详情页显示两个徽章; 首页筛选面板接入; i18n form.duration/form.occasion/detail 词条; 单元测试 classify.test.ts

## 结构构成公式(structural formula)设计
资料: Cocktail Codex(core/balance/seasoning), David Embury《The Fine Art of Mixing Drinks》(base/modifier/accent), Proof Cocktails anatomy(8:3:2), IBA 六大根源家族
角色术语体系(中/英,精密描述):
1. 基酒核心 base_core: 纯正烈酒基酒/陈酿烈酒基酒/agave烈酒基酒(金朗伏威龙白兰地等,量最大)
2. 副核心 co_base: 第二烈酒(拆分基酒)
3. 加强酒修饰核心 fortified_modifier: 味美思/雪莉/波特/金鸡纳酒(Martini家族修饰)
4. 酸度调节剂 acid: 柑橘酸(柠檬/青柠/葡萄柚)/发酵酸(醋/康普茶) → "鲜榨柑橘酸度调节剂"
5. 甜度平衡剂 sweet: 糖浆基平衡剂(simple/demerara/蜂蜜/orgeat)/利口酒基复合平衡剂(triple sec等,兼具风味)
6. 苦味调味剂 bitter_seasoning: 苦精(dash级)→"芳香苦精调味剂"
7. 苦味修饰剂 amaro_modifier: 金巴利/阿玛罗(量大的苦味成分)
8. 延长剂 lengthener: 苏打水/汤力/姜汁啤酒/香槟 →"碳酸延长剂";果汁大量→"果汁延长剂"
9. 质构剂 texture: 蛋白/全蛋/奶油/椰浆 →"蛋白质构剂/乳脂质构剂"
10. 稀释调节 dilution: 水/冰(明确列出时)
11. 芳香点缀 aromatic_accent: 苦艾酒涮杯/floats/苦精表面/盐边
输出格式: 陈酿烈酒基酒 (60ml) + 鲜榨柑橘酸度调节剂 (20ml) + 糖浆基甜度平衡剂 (15ml) + 芳香苦精调味剂 (2dash)
判定信号: 智能配料匹配(bottles category/style) + 名称关键词 + 用量(ml/dash) + 位次

## 原材料库分类重构设计(2026-07-08)
参考:The Bartender's Pantry(十类非酒精材料框架, 1984858670)、Liquid Intelligence(sugar/acid/dairy 功能分类)、Cocktail Codex。
决定的新分类(拆除笼统"原材料",group=materials):
1. 糖与甜味剂 Sugars & Sweeteners — 白砂糖/红糖/蜂蜜/枫糖浆等;按重量(g)或体积计价
2. 新鲜果蔬 Fresh Produce — 柑橘/浆果/黄瓜等新鲜果蔬;按重量(g)或按个计价
3. 香料与草本 Spices & Botanicals — 干香料(肉桂/丁香)+新鲜香草(薄荷/迷迭香)统一为 botanical;子风格区分 Dried Spice / Fresh Herb / Bittering Botanical
4. 茶与咖啡 Tea & Coffee — 浸萃风味源;按重量(g)计价
5. 坚果与谷物 Nuts & Grains — 杏仁(orgeat)/可可碎等;按重量(g)计价
6. 乳蛋 Dairy & Egg — 牛奶/奶油/鸡蛋;ml 或按枚计价
7. 酸类与添加剂 Acids & Additives — 柠檬酸/盐/花水/酵母;按重量或体积计价
迁移:旧 category="原材料" 按 style 映射到新分类;style 保留更细子风格。
单位/成本:parsePackToUnit 已支持 g/ml/piece 三种基准;成本引擎按 类别默认单位 换算,g↔ml 密度近似、piece 按类均值。
UI: bottles.tsx materials 分组改为 categoriesOfGroup("materials") 动态列表;bottle-form 新增按分类预填。
引用点需改:types.ts(bottleGroupOf/categoriesOfGroup)、taxonomy.tsx(默认分类+迁移v8)、seed.ts(原材料条目改新分类)、waldorf-ingredients.ts(mapCategory)、classify.ts、homemade/cost.ts(matchMaterialBottle 改按 group)、bottles.tsx(handleAdd)。

### 原材料分类修正(用户反馈)
- 新增: 8. 花卉 Flowers & Florals — 干花(洋甘菊/木槿洛神/接骨木花/桂花/薰衣草)、食用鲜花、花水(橙花水/玫瑰水从酸类添加剂迁入);干花按g、花水按ml计价
- "新鲜香草"不再独立,并入 香料与草本 的 Fresh Herb 子风格
- "坚果茶咖"拆分: 茶与咖啡 Tea & Coffee 独立; 坚果与谷物 Nuts & Grains 独立

### 原材料库最终设计(2026-07-08 用户确认方向)
8大分类+子风格(style),全部严谨化;计价基准 g/ml/piece:
1. 糖与甜味剂: 精制糖(白砂/细砂,g)|原糖与黑糖(德梅拉拉/黑糖,g)|方糖(piece)|蜂蜜与花蜜(g或ml)|糖蜜与浓缩汁(枫糖浆/龙舌兰蜜/糖蜜,ml)
2. 新鲜果蔬: 柑橘类(g或piece)|浆果类(g)|热带水果(g或piece)|核果仁果(g或piece)|瓜果蔬菜(g或piece)
3. 香料与草本: 干制香料(肉桂/丁香/豆蔻,g)|新鲜草本(薄荷/罗勒/迷迭香,g或束)|苦味草本(龙胆/金鸡纳,g)
4. 花卉: 干花(洋甘菊/木槿/桂花,g)|新鲜食用花(piece或束)|花水花露(橙花水/玫瑰水,ml)
5. 茶与咖啡: 茶叶(g)|咖啡(豆/粉,g)|可可(g)
6. 坚果与谷物: 坚果(杏仁/榛子,g)|谷物籽实(燕麦/芝麻,g)
7. 乳蛋: 奶与奶油(ml)|蛋类(piece)|黄油奶酪(g)
8. 酸类与添加剂: 酸粉(柠檬酸/苹果酸,g)|醋类(ml)|盐与矿物(g)|质构澄清剂(琼脂/明胶/卵磷脂,g)
形态折叠: 黄瓜片/块/条→黄瓜, 柠檬片/皮/角→柠檬; smart-link 增加形态词剥离层(片|块|条|角|皮|丝|瓣|段|圈|碎|末|泥|汁(慎)|扭条|twist|slice|wedge|wheel|peel|cube|spear|chunk),剥离后再匹配母条目;成本按母条目单价
迁移: taxonomy v8 迁移,旧"原材料"分类按 style 关键词映射到新8类;bottles.tsx materials 组动态渲染

### 原材料重构实施进度(v8)
已完成:
- taxonomy.tsx: DEFAULT_BOTTLE_CATEGORY_DEFS 已换8个材料分类(75-82行);DEFAULT_BOTTLE_STYLE_DEFS 已换严谨子风格(精制糖/原糖黑糖/方糖/蜂蜜花蜜/糖蜜浓缩汁;柑橘/浆果/热带/核仁果/瓜果蔬菜;干制香料/新鲜草本/苦味草本;干花/新鲜食用花/花水花露;茶/咖啡/可可;坚果/谷物籽实;奶与奶油/蛋类/黄油奶酪;酸粉/醋类/盐与矿物/质构澄清剂)
- taxonomy.tsx: 新增 MATERIAL_CATEGORY_DEFS_V8 / V8_STYLE_TO_CATEGORY / V8_NAME_RULES / migrateMaterialBottleV8(name关键词优先→style映射→默认酸类添加剂)
剩余步骤:
1. taxonomy.tsx 加载 effect(398-419行): rawC 存在时注入 v8 —— 移除旧"原材料"分类,插入缺失的8个材料分类与子风格(migrateCategoriesV8 函数,更新 CATS_KEY/STYLES_KEY)
2. lib/bottles/store.tsx: 加载 bottles 后对 category==="原材料" 条目跑 migrateMaterialBottleV8 并持久化(一次性,键 bottles.material.migrated.v8)
3. waldorf-ingredients.ts: mapCategory 生成"原材料"处改为调 migrateMaterialBottleV8 逻辑或直接映射新分类
4. bottles.tsx: materials 组渲染是否写死"原材料"(约55-95行 handleAdd/分组过滤),改 categoriesOfGroup("materials")
5. 形态折叠: smart-link.ts 加形态词剥离层 FORM_WORDS(片|块|条|角|皮|丝|瓣|段|圈|碎|末|泥|扭条|twist|slice|wedge|wheel|peel|cube|spear|chunk|leaf?),剥离后再匹配;lib/bottles/cost.ts 或 smart-cost.ts 加形态换算系数表 FORM_FACTORS(柠檬皮1条=1/6个,柠檬片=1/8个,黄瓜片3片≈30g),系数可被 bottle.formFactors 字段覆盖(types.ts Bottle 加可选 formFactors?: Record<string,number>)
6. classify.ts/homemade/cost.ts 中 "原材料" 引用更新
7. 测试: tests/taxonomy-v8.test.ts + 更新受影响旧测试
注意: smart-cost.ts isPerishable 等逻辑不受影响;seed.ts 中 mk 的原材料条目需改新分类名
