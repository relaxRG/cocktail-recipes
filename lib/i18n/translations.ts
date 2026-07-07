/** 界面双语词典:key 为语义化标识,值为中英文两套文案 */
export type Lang = "zh" | "en";

const dict = {
  // Tabs
  "tab.recipes": { zh: "酒单", en: "Recipes" },
  "tab.bottles": { zh: "酒库", en: "Bottles" },
  "tab.tags": { zh: "分类", en: "Tags" },
  // Home
  "home.title": { zh: "我的酒单", en: "My Cocktails" },
  "home.subtitle.empty": { zh: "记录属于你的每一杯", en: "Record every drink you make" },
  "home.subtitle.count": { zh: "共 {n} 份配方", en: "{n} recipes" },
  "home.search.placeholder": { zh: "搜索酒名、配料、笔记…", en: "Search name, ingredient, notes…" },
  "home.filter.all": { zh: "全部", en: "All" },
  "home.filter.favorites": { zh: "★ 收藏", en: "★ Favorites" },
  "home.empty.title": { zh: "还没有配方", en: "No recipes yet" },
  "home.empty.desc": {
    zh: "记录下你的第一杯鸡尾酒,或先导入几份经典配方看看效果",
    en: "Add your first cocktail, or import classic samples to explore",
  },
  "home.empty.add": { zh: "添加第一杯", en: "Add First Drink" },
  "home.empty.import": { zh: "导入经典示例配方", en: "Import Classic Samples" },
  "home.noMatch": {
    zh: "没有找到匹配的配方,换个关键词或分类试试",
    en: "No matching recipes. Try another keyword or filter",
  },
  // Bottles
  "bottles.title": { zh: "酒库", en: "Bottle Library" },
  "bottles.subtitle": { zh: "{n} 款酒 · 中英文名、度数与参考价", en: "{n} bottles · names, ABV & prices" },
  "bottles.search.placeholder": { zh: "搜索酒名、品牌、产地...", en: "Search name, brand, origin…" },
  "bottles.empty.title": { zh: "酒库是空的", en: "Library is empty" },
  "bottles.noMatch.title": { zh: "没有匹配的酒款", en: "No matching bottles" },
  "bottles.empty.desc": { zh: "添加你拥有或想了解的酒款", en: "Add bottles you own or want to know" },
  "bottles.noMatch.desc": { zh: "换个关键词或分类试试", en: "Try another keyword or category" },
  "bottles.price.ref": { zh: "参考价", en: "ref. price" },
  "bottles.price.unknown": { zh: "价格未知", en: "No price" },
  // Tags screen
  "tags.title": { zh: "标签管理", en: "Tag Manager" },
  "tags.subtitle": { zh: "自定义分类、基酒、杯型与风味标签", en: "Customize categories, spirits, glasses & flavors" },
  "tags.section.category": { zh: "分类", en: "Category" },
  "tags.section.spirit": { zh: "基酒", en: "Spirit" },
  "tags.section.glass": { zh: "杯型", en: "Glass" },
  "tags.section.flavor": { zh: "风味", en: "Flavor" },
  "tags.new.placeholder": { zh: "新{s}名称", en: "New {s} name" },
  "tags.empty": { zh: "还没有{s}标签,在上方创建一个吧", en: "No {s} tags yet. Create one above" },
  "tags.count": { zh: "{n} 份配方", en: "{n} recipes" },
  "tags.hint": {
    zh: "点击色点可换颜色;长按标签行上下拖动可调整顺序,排序会同步到表单与筛选。",
    en: "Tap the dot to change color. Long-press and drag rows to reorder; order syncs to forms and filters.",
  },
  "tags.delete.title": { zh: "删除{s}", en: "Delete {s}" },
  "tags.delete.confirm": { zh: "确定删除「{name}」吗?", en: "Delete \"{name}\"?" },
  // Common
  "common.cancel": { zh: "取消", en: "Cancel" },
  "common.delete": { zh: "删除", en: "Delete" },
  "common.save": { zh: "保存", en: "Save" },
  "common.back": { zh: "返回", en: "Back" },
  "common.settings": { zh: "设置", en: "Settings" },
  "common.language": { zh: "界面语言", en: "Language" },
  // Recipe detail
  "detail.notFound": { zh: "配方不存在或已被删除", en: "Recipe not found or deleted" },
  "detail.meta.spirit": { zh: "基酒", en: "Spirit" },
  "detail.meta.glass": { zh: "杯型", en: "Glass" },
  "detail.meta.method": { zh: "方法", en: "Method" },
  "detail.meta.strength": { zh: "烈度", en: "Strength" },
  "detail.ingredients": { zh: "配料", en: "Ingredients" },
  "detail.noIngredients": { zh: "未填写配料", en: "No ingredients" },
  "detail.cost": { zh: "单杯成本估算", en: "Cost per Drink" },
  "detail.cost.total": { zh: "预估总成本({a}/{b} 项可估算)", en: "Estimated total ({a}/{b} items)" },
  "detail.cost.noBottle": { zh: "酒库中无匹配酒款", en: "No matching bottle" },
  "detail.cost.noAmount": { zh: "用量无法换算(如:适量)", en: "Amount not convertible" },
  "detail.cost.noPrice": { zh: "酒款未填写价格", en: "Bottle has no price" },
  "detail.cost.noVolume": { zh: "酒款未填写规格", en: "Bottle has no volume" },
  "detail.cost.note": {
    zh: "按酒库参考价与规格折算,不含冰、装饰与损耗;仅供参考。",
    en: "Based on library prices & volumes. Ice, garnish and loss excluded. For reference only.",
  },
  "detail.steps": { zh: "做法", en: "Method" },
  "detail.garnish": { zh: "装饰", en: "Garnish" },
  "detail.notes": { zh: "笔记", en: "Notes" },
  "detail.source": { zh: "引用来源", en: "Source" },
  "detail.variantOf": { zh: "变体来源:{name}", en: "Variant of {name}" },
  "detail.delete.title": { zh: "删除配方", en: "Delete Recipe" },
  "detail.delete.msg": { zh: "确定删除「{name}」吗?此操作无法撤销。", en: "Delete \"{name}\"? This cannot be undone." },
  // Bottle detail
  "bottle.notFound": { zh: "酒款不存在或已被删除", en: "Bottle not found or deleted" },
  "bottle.info": { zh: "基本信息", en: "Info" },
  "bottle.nameEn": { zh: "英文名", en: "English Name" },
  "bottle.category": { zh: "分类", en: "Category" },
  "bottle.brand": { zh: "品牌", en: "Brand" },
  "bottle.origin": { zh: "产地", en: "Origin" },
  "bottle.volume": { zh: "规格", en: "Volume" },
  "bottle.abv": { zh: "酒精度", en: "ABV" },
  "bottle.price": { zh: "中国参考价", en: "Price (CN)" },
  "bottle.notes": { zh: "备注", en: "Notes" },
  "bottle.priceNote": {
    zh: "价格为中国市场常见参考价,会随渠道与时间波动。",
    en: "Prices are common China market references and fluctuate by channel and time.",
  },
  "bottle.delete.title": { zh: "删除酒款", en: "Delete Bottle" },
  // Form (recipe)
  "form.title.new": { zh: "新建配方", en: "New Recipe" },
  "form.title.edit": { zh: "编辑配方", en: "Edit Recipe" },
  "form.pasteImport": { zh: "粘贴导入配方", en: "Paste to Import" },
  "form.name.label": { zh: "酒名", en: "Name" },
  "form.name.placeholder": { zh: "例如:尼格罗尼", en: "e.g. Negroni" },
  "form.category": { zh: "分类", en: "Category" },
  "form.variantOf": { zh: "经典变体来源", en: "Variant Of" },
  "form.variantOf.placeholder": { zh: "例如:尼格罗尼(可选)", en: "e.g. Negroni (optional)" },
  "form.codex": { zh: "Codex 六大分类", en: "Codex Family" },
  "form.spirit": { zh: "基酒", en: "Base Spirit" },
  "form.glass": { zh: "杯型", en: "Glass" },
  "form.method": { zh: "制作方法", en: "Method" },
  "form.strength": { zh: "烈度", en: "Strength" },
  "form.flavors": { zh: "风味标签", en: "Flavor Tags" },
  "form.ingredients": { zh: "配料", en: "Ingredients" },
  "form.ingredient.name": { zh: "配料名", en: "Ingredient" },
  "form.ingredient.amount": { zh: "用量", en: "Amount" },
  "form.addIngredient": { zh: "添加配料", en: "Add Ingredient" },
  "form.steps": { zh: "做法步骤", en: "Method Steps" },
  "form.garnish": { zh: "装饰", en: "Garnish" },
  "form.notes": { zh: "笔记", en: "Notes" },
  "form.source": { zh: "引用来源", en: "Source" },
  "form.source.placeholder": {
    zh: "例如:Cocktail Codex p.120 / 网址 / 调酒师",
    en: "e.g. Cocktail Codex p.120 / URL / bartender",
  },
  "form.save": { zh: "保存配方", en: "Save Recipe" },
  "form.save.edit": { zh: "保存修改", en: "Save Changes" },
  "form.uncategorized": { zh: "未分类", en: "None" },
  "form.noSpirit": { zh: "暂无基酒标签,可在“分类”页添加", en: "No spirit tags yet. Add them in Tags" },
  "form.noFlavor": { zh: "暂无风味标签,可在“分类”页添加", en: "No flavor tags yet. Add them in Tags" },
  "form.noGlass": { zh: "暂无杯型标签,可在“分类”页添加", en: "No glass tags yet. Add them in Tags" },
  "form.codex.hint": {
    zh: "按《Cocktail Codex》六大母配方归类,再点一次可取消",
    en: "Based on Cocktail Codex root recipes. Tap again to unselect",
  },
  "form.pasteImport.hint": {
    zh: "复制配方文字后点这里,自动识别酒名、配料用量与做法",
    en: "Copy recipe text, then tap to auto-fill name, ingredients & steps",
  },
  "form.name.required": { zh: "酒名 *", en: "Name *" },
  "form.flavors.multi": { zh: "风味标签(可多选)", en: "Flavor Tags (multi-select)" },
  "form.steps.placeholder": {
    zh: "1. 摇酒壶加冰\n2. 倒入材料摇和\n3. 滤入冰镇酒杯",
    en: "1. Fill shaker with ice\n2. Add ingredients and shake\n3. Strain into chilled glass",
  },
  "form.garnish.placeholder": { zh: "例如:柠檬皮、薄荷枝", en: "e.g. lemon twist, mint sprig" },
  "form.notes.placeholder": { zh: "口感记录、改良想法…", en: "Tasting notes, ideas…" },
  "form.import.empty": { zh: "剪贴板为空,请先复制配方文字", en: "Clipboard is empty. Copy recipe text first" },
  "form.import.fail": {
    zh: "未能从剪贴板内容中识别出配方信息,请检查复制的文字",
    en: "Couldn't recognize a recipe from clipboard content",
  },
  "form.import.readFail": {
    zh: "读取剪贴板失败,请手动粘贴到对应字段",
    en: "Failed to read clipboard. Paste manually",
  },
  "form.import.overwrite": { zh: "导入将覆盖已填写的内容,继续吗?", en: "Import will overwrite current content. Continue?" },
  "form.import.title": { zh: "粘贴导入", en: "Paste Import" },
  "form.import.confirm": { zh: "导入", en: "Import" },
  "form.import.done": { zh: "已识别并填入,请核对后保存", en: "Recognized and filled, please review" },
  "card.variant": { zh: "变体", en: "Variant" },
  "strength.light": { zh: "低度", en: "Light" },
  "strength.medium": { zh: "中度", en: "Medium" },
  "strength.strong": { zh: "高度", en: "Strong" },
  // Form (bottle)
  "bform.title.new": { zh: "添加酒款", en: "New Bottle" },
  "bform.title.edit": { zh: "编辑酒款", en: "Edit Bottle" },
  "bform.save": { zh: "保存酒款", en: "Save Bottle" },
  "bform.nameZh": { zh: "中文名 *", en: "Chinese Name *" },
  "bform.nameEn": { zh: "英文名", en: "English Name" },
  "bform.brand": { zh: "品牌", en: "Brand" },
  "bform.origin": { zh: "产地", en: "Origin" },
  "bform.volume": { zh: "规格", en: "Volume" },
  "bform.abv": { zh: "酒精度(%)", en: "ABV (%)" },
  "bform.price": { zh: "中国参考价(¥)", en: "Price CNY (¥)" },
  "bform.notes": { zh: "备注", en: "Notes" },
  "bform.category": { zh: "分类", en: "Category" },
} as const;

export type TranslationKey = keyof typeof dict;

export function translate(key: TranslationKey, lang: Lang, params?: Record<string, string | number>): string {
  const entry = dict[key];
  let text: string = entry ? entry[lang] : (key as string);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}
