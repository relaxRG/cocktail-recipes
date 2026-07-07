# 实施笔记:我的页 + 颜色选择升级 + 批量导入

## 状态(2026-07-08)
### 已完成
- 阶段1完成:me.tsx("我的"页,含三库统计/标签管理入口/批量导入入口/语言切换),
  categories.tsx 已 git mv 为 app/tags.tsx(堆栈页,带返回按钮,语言区已移除),
  _layout.tsx tab: me(person.crop.circle.fill),截图验证通过
- 阶段2完成:components/color-picker.tsx(ColorPickerPanel:24 预设色 + 展开自定义面板
  HSV 色相/饱和度/明度滑条 + HEX 输入,纯 RN 无新依赖,分段色块模拟渐变),
  tags.tsx 三处 CATEGORY_COLORS 色点已替换,i18n color.* 词条已加,tsc 0 错误,截图验证通过
- app/bulk-import.tsx 已建占位页(返回头+标题)
- i18n:tab.me/me.*/bulk.* 词条已加入 translations.ts
- icon-symbol.tsx 已加映射:person.crop.circle.fill→account-circle, tag.fill→label,
  square.and.arrow.down.fill→download, globe→language, info.circle.fill→info

### 待办
### 阶段3已完成(2026-07-08)
- 依赖已装:xlsx, mammoth, expo-document-picker
- server/routers.ts:bulkImport.extract publicProcedure
  - extractFileText():pdf→base64 直传 LLM file_url;xlsx→sheet_to_csv;docx→mammoth;其余按 utf-8
  - llmExtract():invokeLLM + json_object,bulkItemSchema(zod .catch 容错),最多 60 条
- app/bulk-import.tsx 完整实现:
  - 文本输入 + expo-document-picker 文件选择(web 用 fetch+FileReader 转 base64,原生用
    FileSystem.readAsStringAsync base64),10MB 上限
  - 预览列表:勾选/点类型徽章循环切换 bottle→prep→recipe
  - doImport():bottle 分类模糊匹配 taxonomy(存 zh 名,BottleCategoryDef 字段是 zh/en 而非 nameZh/nameEn!),
    prep 用 types 关键词匹配 type key,recipe 分类名精确匹配否则 null
  - i18n 复用已有 bulk.* 词条(bulk.paste.placeholder/analyze/analyzing/preview.title/
    preview.hint/import.confirm/import.done)
- icon-symbol.tsx 已补 doc.fill→description, circle→radio-button-unchecked
- tsc 0 错误,vitest 153 通过

### 待办
(全部完成,已交付 checkpoint 04a533ab)

## 新一轮(2026-07-08):酒库三分组
- 需求:酒款库拆分为"基酒库(spirits)/酒款库(bottles)/原材料库(materials)"
- BottleCategoryDef.group: "bottles"|"materials" → 增加 "spirits"
- 默认归属:金酒/伏特加/朗姆/威士忌/龙舌兰/白兰地/清酒烧酒/中式白酒→spirits;
  利口酒/味美思/阿玛罗开胃酒/苦精/加强酒/起泡酒/葡萄酒→bottles;
  果汁/软饮/糖浆/原材料/其他→materials
- taxonomy 存储需迁移(旧自定义分类 group 若为 bottles 且属基酒类默认名单→spirits)
- bottles.tsx 顶部分组 segment 由两个改三个;快捷筛选按分组过滤分类
- 已完成:酒单页语言切换按钮/自制页管理分区按钮已移除(功能在"我的"页),tsc 0 错,153 测试过

## Store API 签名(已确认)
- useBottleStore(): { bottles, addBottle(draft: BottleDraft): Bottle, ... }
- useHomemadeStore(): { preps, sections, types, addPrep(...), ... }
- useRecipeStore(): { recipes, categories, tags, tagGroups, addRecipe(draft): Recipe, ... }
- 具体 Draft 字段在 lib/bottles/types.ts / lib/homemade/types.ts / lib/recipes/types.ts

## 关键现有资产
- 配方文本解析器:lib/recipes/parse.ts(中英文配方粘贴导入)
- 未知配料分类引擎:lib/ingredients/classify.ts(判断酒款/原材料/自制)——名字待确认
- 三库 store API:useRecipes().addRecipe / useBottles().addBottle / useHomemade().addItem——具体签名待确认
- 服务端:server/routers.ts tRPC,server/_core/llm.ts 内置 LLM 可用于智能提取
