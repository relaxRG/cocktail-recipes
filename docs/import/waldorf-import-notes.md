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
