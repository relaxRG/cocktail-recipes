import { Ingredient } from "../recipes/types";
import { Bottle } from "./types";

/** 固体/干料配料名关键词 → 判定为重量盎司，不换算 ml */
const SOLID_INGREDIENT_RE =
  /cocoa|cacao|可可粉|chocolate\s*powder|sugar(?!\s*syrup)|砂糖|白糖|红糖|冰糖|salt|盐|pepper|胡椒|cinnamon(?!\s*syrup)|nutmeg|肉豆蔻|cloves?|丁香|cardamom(?!\s*syrup)|allspice|五香|anise|八角|cumin|孜然|turmeric|姜黄|flour|面粉|cornstarch|淀粉|matcha|抹茶粉|coffee\s*grounds?|咖啡粉|tea\s*leaves?|茶叶|dried\s*herbs?|干香草|dried\s*fruit/i;

/**
 * 判断 "oz" 在给定配料名上下文中是液量盎司还是重量盎司。
 * 固体干料（可可粉、盐、糖等）使用重量盎司(28.35g)，无法换算 ml，返回 "solid"。
 */
export function classifyOzContext(ingredientName: string): "liquid" | "solid" {
  if (SOLID_INGREDIENT_RE.test(ingredientName)) return "solid";
  return "liquid";
}

/**
 * 模糊/特殊单位智能判断：根据用量文本 + 配料名上下文推断实际 ml。
 * 处理 "适量"、"少许"、"几滴"、"半杯"、"一瓶" 等无法直接换算的写法。
 * 返回 null 表示无法合理估算。
 */
export function resolveAmbiguousUnit(amount: string, ingredientName: string): number | null {
  const a = amount.trim().toLowerCase();
  const name = ingredientName.toLowerCase();
  if (/适量|少许|to\s*taste|as\s*needed|q\.?s\.?/i.test(a)) {
    if (/bitters|苦精|salt|盐|sugar(?!\s*syrup)|糖(?!浆)|pepper|胡椒|spice|香料|sauce|酱/i.test(name)) return 0.9;
    if (/soda|tonic|water|juice|汁|水|beer|啤酒|lemonade|柠檬水/i.test(name)) return 60;
    return null;
  }
  if (/一点|a\s*little|a\s*bit/i.test(a)) return 2;
  if (/几滴|a\s*few\s*drops?/i.test(a)) return 0.15;
  if (/半杯|half\s*a?\s*pint/i.test(a)) return 236.5;
  if (/半杯|half\s*a?\s*cup/i.test(a)) return 120;
  if (/满杯|full\s*(?:cup|glass)/i.test(a)) return 240;
  if (/一瓶|one\s*bottle|\bbtl\b/i.test(a)) {
    if (/beer|啤酒/i.test(name)) return 330;
    if (/wine|葡萄酒|champagne|香槟|prosecco/i.test(name)) return 750;
    return 700;
  }
  return null;
}



/** 单项配料的成本估算结果 */
export interface IngredientCost {
  ingredient: Ingredient;
  /** 匹配到的酒款,null 表示未匹配 */
  bottle: Bottle | null;
  /** 解析出的用量(ml),null 表示无法解析 */
  amountMl: number | null;
  /** 估算成本(元),null 表示无法估算 */
  cost: number | null;
  /** 无法估算的原因 */
  reason: "no_bottle" | "no_amount" | "no_price" | "no_volume" | null;
}

/** 配方成本估算汇总 */
export interface RecipeCostEstimate {
  items: IngredientCost[];
  /** 可估算项的成本合计(元) */
  total: number;
  /** 成功估算的配料数 */
  estimatedCount: number;
  /** 总配料数 */
  totalCount: number;
}

/** 单位 -> 毫升换算表 */
const UNIT_TO_ML: [RegExp, number][] = [
  // ── 公制 ──────────────────────────────────────────────────────────
  [/(?:ml|毫升|cc|mL)/i, 1],
  [/(?:cl|厘升)/i, 10],
  [/(?:dl|分升)/i, 100],
  [/(?:\bl\b|升|litre|liter)/i, 1000],
  // ── 美制液量 ──────────────────────────────────────────────────────
  [/(?:fl\.?\s*oz|fluid\s*ounce)/i, 29.5735],   // 美制液量盎司 ≈ 29.57 ml
  [/(?:oz|盎司|ounce)/i, 30],                    // 调酒惯用 30 ml 整数
  [/(?:jigger)/i, 44.36],                        // 标准 jigger = 1.5 fl oz
  [/(?:pony)/i, 29.5735],                        // pony = 1 fl oz
  [/(?:shot)/i, 44.36],                          // 标准 shot = 1.5 oz（美式）
  [/(?:杯)/i, 45],                               // 中文"杯"按调酒惯例 45 ml
  [/(?:cups?|量杯)/i, 240],
  [/(?:pint|品脱)/i, 473],
  [/(?:quart|夸脱)/i, 946],
  [/(?:gallon|加仑)/i, 3785],
  [/(?:gill)/i, 118.29],                         // 英制 gill = 4 fl oz
  // ── 调酒小量单位 ──────────────────────────────────────────────────
  [/(?:dash|抖振|抖)/i, 0.9],                    // 1 dash ≈ 0.9 ml（Angostura 标准）
  [/(?:drop|滴)/i, 0.05],                        // 1 drop ≈ 0.05 ml
  [/(?:rinse|漂洗)/i, 2],                        // rinse（玻璃杯漂洗）≈ 2 ml
  [/(?:splash|少量)/i, 15],                      // splash 约 0.5 oz = 15 ml
  [/(?:float|浮层)/i, 15],                       // float 约 0.5 oz
  [/(?:top\s*up|top|加满)/i, 60],                // top up 约 2 oz
  // ── 勺类 ──────────────────────────────────────────────────────────
  [/(?:bar\s*spoon|吧勺|吧匙)/i, 5],             // 1 barspoon = 5 ml（标准）
  [/(?:tsp|茶匙|小勺)/i, 5],
  [/(?:tbsp|汤匙|大勺)/i, 15],
  [/(?:dessert\s*spoon|甜点匙)/i, 10],           // dessertspoon = 2 tsp = 10 ml
  // ── 调酒特殊量词 ──────────────────────────────────────────────────
  [/(?:part)/i, 30],                             // "1 part" 通用比例单位，按 1 oz 估算
  [/(?:measure)/i, 25],                          // 英式 measure = 25ml（英国标准）
  [/(?:nip)/i, 30],                              // nip = 1 fl oz（英式小瓶）
  [/(?:finger)/i, 44],                           // finger ≈ 1.5 oz（手指量）
  [/(?:squeeze)/i, 15],                          // squeeze（挤压柑橘）≈ 0.5 oz
  [/(?:pump)/i, 10],                             // pump（泵压糖浆）≈ 10ml
  [/(?:scoop)/i, 120],                           // scoop（勺）≈ 4 oz
  [/(?:ladle)/i, 120],                           // ladle（汤勺）≈ 120ml
  // ── 中文特有量词 ──────────────────────────────────────────────────
  [/(?:小匙|茶勺|咖啡匙)/i, 5],
  [/(?:大匙|餐匙)/i, 15],
  [/(?:酒盅)/i, 30],                             // 中式酒盅 ≈ 30ml
];

/**
 * 从用量文本解析出毫升数。
 * 支持:"45ml"、"1.5 oz"、"2 dash"、"1/2 oz"、"1½oz"、"30 毫升" 等
 */
export function parseAmountToMl(amount: string, ingredientName?: string): number | null {
  const text = amount.trim();
  if (!text) return null;

  // 数字部分:支持小数、分数(1/2)、混合分数(1 1/2)与常见 Unicode 分数
  const vulgar: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  let normalized = text;
  for (const [ch, val] of Object.entries(vulgar)) {
    normalized = normalized.replace(new RegExp(`(\\d+)\\s*${ch}`, "g"), (_, n) => String(Number(n) + val));
    normalized = normalized.replace(new RegExp(ch, "g"), String(val));
  }

  // 混合分数 "1 1/2"
  let value: number | null = null;
  const mixed = normalized.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  } else {
    const frac = normalized.match(/(\d+)\s*\/\s*(\d+)/);
    if (frac) {
      value = Number(frac[1]) / Number(frac[2]);
    } else {
      const dec = normalized.match(/(\d+(?:\.\d+)?)/);
      if (dec) value = Number(dec[1]);
    }
  }
  if (value === null || !isFinite(value)) return null;

  // oz 液体/固体智能判断：若配料名指示固体，oz 为重量盎司，不换算 ml
  if (ingredientName && /\boz\b|盎司|ounce/i.test(normalized)) {
    if (classifyOzContext(ingredientName) === "solid") return null;
  }

  for (const [re, ml] of UNIT_TO_ML) {
    if (re.test(normalized)) return value * ml;
  }
  // 无单位默认视为 ml(常见简写如 "45")
  return value;
}

/** 非液体计数单位(中/英):水果个数、叶片、方糖等,保留原始呈现 */
const NON_LIQUID_RE =
  /片|个|颗|枝|块|条|只|适量|少许|叶|把|抹|圈|针|satsuma|slice|wedge|sprig|lea(f|ves)|piece|cube|egg|pinch|twist|peel|wheel|whole|rind|zest|mint|berr|cherr|olive|clove|small|large|to\s*top|top\s*up|toasted|\blime\b|\blemon\b|\borange\b|青柠(?!汁)|柠檬(?!汁)/i;

/**
 * 将用量文本统一格式化为 ml 显示。
 * 例:"1.5 oz" -> "45ml";"2 dash" -> "1.8ml";
 * 非液体计数单位(如"1 个"、"12片"、"2 cubes"、"10 leaves")原样返回。
 */
export function formatAmountAsMl(amount: string): string {
  const text = amount.trim();
  if (!text) return text;
  // 非液体计数单位优先原样保留(水果/叶片/方糖/蛋等)
  if (NON_LIQUID_RE.test(text)) return text;
  // 含"or"/"或"等多方案写法不转换,避免误导
  if (/\bor\b|或/i.test(text)) return text;
  // 已经是纯 ml 写法时规范化输出
  const ml = parseAmountToMl(text);
  if (ml === null) return text;
  // 纯数字无单位:小数字(<20)多为计数(蛋/果),保留;大数字按 ml 简写惯例转换
  if (/^[\d\s./½¼¾⅓⅔~-]+$/.test(text) && ml < 20) return text;
  const rounded = Math.round(ml * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display}ml`;
}

/** 从规格文本解析瓶容量 ml,如 "700ml" / "1000ml" / "75cl" */
export function parseVolumeToMl(volume: string): number | null {
  const text = volume.trim().toLowerCase();
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(ml|毫升|cl|dl|fl\.?\s*oz|l|升)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] ?? "ml").toLowerCase().replace(/\s/g, "");
  if (unit === "l" || unit === "升") return value * 1000;
  if (unit === "dl") return value * 100;
  if (unit === "cl") return value * 10;
  if (unit === "fl.oz" || unit === "floz") return value * 29.5735;
  return value; // ml / 毫升 / 无单位
}

/** 中英文配料同义词典:英文配料名 -> 中文等价词(用于匹配酒库) */
const INGREDIENT_SYNONYMS: [RegExp, string][] = [
  // ── 基酒：金酒 ────────────────────────────────────────────────────
  [/london\s*dry\s*gin|dry\s*gin|tanqueray|hendrick|bombay\s*sapphire|beefeater|gordon|plymouth\s*gin|monkey\s*47|roku\s*gin|malfy|aviation\s*gin|\bgin\b/i, "金酒"],
  // ── 基酒：朗姆 ────────────────────────────────────────────────────
  [/white\s*rum|light\s*rum|silver\s*rum|bacardi\s*white|havana\s*3/i, "白朗姆"],
  [/dark\s*rum|aged\s*rum|black\s*rum|gosling|myers|kraken|captain\s*morgan\s*dark|havana\s*7/i, "黑朗姆"],
  [/spiced\s*rum|captain\s*morgan/i, "香料朗姆"],
  [/agricole|rhum/i, "农业朗姆"],
  [/\brum\b|bacardi|havana\s*club|appleton|mount\s*gay|diplomatico|plantation/i, "朗姆"],
  // ── 基酒：伏特加 ──────────────────────────────────────────────────
  [/\bvodka\b|absolut|grey\s*goose|belvedere|ketel\s*one|tito|smirnoff|stolichnaya|stoli|ciroc|skyy/i, "伏特加"],
  // ── 基酒：威士忌 ──────────────────────────────────────────────────
  [/\brye\s*whisk(e)?y|rittenhouse|sazerac\s*rye|bulleit\s*rye|whistlepig|\brye\b/i, "黑麦威士忌"],
  [/bourbon|maker.*mark|woodford|buffalo\s*trace|wild\s*turkey|four\s*roses|knob\s*creek|jim\s*beam|evan\s*williams|heaven\s*hill|elijah\s*craig|angel.*envy/i, "波本威士忌"],
  [/irish\s*whisk(e)?y|jameson|bushmills|redbreast|green\s*spot|powers/i, "爱尔兰威士忌"],
  [/japanese\s*whisk(e)?y|suntory|nikka|hibiki|yamazaki|hakushu|toki/i, "日本威士忌"],
  [/scotch|single\s*malt|blended\s*scotch|johnnie\s*walker|chivas|glenfiddich|macallan|laphroaig|ardbeg|lagavulin|glenlivet|balvenie|oban|dalmore|highland\s*park|whisk(e)?y/i, "威士忌"],
  // ── 基酒：龙舌兰 / 梅斯卡尔 ──────────────────────────────────────
  [/blanco\s*tequila|silver\s*tequila|patron\s*silver|espolon\s*blanco|olmeca\s*altos|tequila/i, "龙舌兰"],
  [/mezcal|del\s*maguey|banhez|putaendo|ilegal/i, "梅斯卡尔"],
  // ── 基酒：白兰地 / 干邑 ───────────────────────────────────────────
  [/cognac|hennessy|remy\s*martin|courvoisier|martell|hine|pierre\s*ferrand|armagnac|calvados|pisco|brandy/i, "白兰地"],
  // ── 基酒：其他烈酒 ────────────────────────────────────────────────
  [/absinthe|pernod|pastis|ricard/i, "苦艾酒"],
  [/aquavit|akvavit/i, "阿夸维特"],
  [/grappa/i, "格拉帕"],
  [/sake|清酒/i, "清酒"],
  [/baijiu|白酒|茅台|五粮液|汾酒/i, "白酒"],
  [/shochu|焼酎|烧酒/i, "烧酒"],
  // ── 利口酒：橙皮类 ────────────────────────────────────────────────
  [/cointreau/i, "君度橙皮酒"],
  [/grand\s*marnier/i, "柑曼怡"],
  [/triple\s*sec|orange\s*liqueur|c[uú]racao/i, "橙皮利口酒"],
  // ── 利口酒：樱桃类 ────────────────────────────────────────────────
  [/maraschino|luxardo/i, "马拉斯奇诺樱桃利口酒"],
  [/cherry\s*heering|peter\s*heering/i, "黑樱桃利口酒"],
  [/cherry\s*brandy|cherry\s*liqueur/i, "樱桃利口酒"],
  // ── 利口酒：接骨木 / 花草 ─────────────────────────────────────────
  [/st[.\s-]*germain/i, "St-Germain 接骨木花利口酒"],
  [/elderflower\s*liqueur|elderflower/i, "接骨木花利口酒"],
  [/cr[eè]me\s*de\s*violette|violet\s*liqueur/i, "紫罗兰利口酒"],
  [/cr[eè]me\s*de\s*rose|rose\s*liqueur/i, "玫瑰利口酒"],
  [/cr[eè]me\s*de\s*menthe|mint\s*liqueur/i, "薄荷利口酒"],
  [/cr[eè]me\s*de\s*cacao|chocolate\s*liqueur/i, "可可利口酒"],
  [/cr[eè]me\s*de\s*cassis|cassis/i, "黑醋栗利口酒"],
  [/cr[eè]me\s*de\s*mure|blackberry\s*liqueur/i, "黑莓利口酒"],
  [/cr[eè]me\s*de\s*p[eê]che|peach\s*liqueur/i, "桃子利口酒"],
  [/cr[eè]me\s*de\s*framboise|raspberry\s*liqueur/i, "覆盆子利口酒"],
  [/cr[eè]me\s*de\s*banane|banana\s*liqueur/i, "香蕉利口酒"],
  // ── 利口酒：咖啡 / 可可 ───────────────────────────────────────────
  [/kahlua/i, "卡鲁哇咖啡利口酒"],
  [/tia\s*maria/i, "提亚玛丽亚咖啡利口酒"],
  [/coffee\s*liqueur|咖啡利口酒/i, "咖啡利口酒"],
  // ── 利口酒：奶油类 ────────────────────────────────────────────────
  [/baileys|irish\s*cream/i, "百利甜"],
  [/advocaat/i, "蛋黄利口酒"],
  // ── 利口酒：坚果 / 香料 ───────────────────────────────────────────
  [/amaretto|disaronno|frangelico/i, "杏仁利口酒"],
  [/frangelico/i, "榛子利口酒"],
  [/falernum/i, "法勒纳姆"],
  [/orgeat|杏仁糖浆/i, "杏仁糖浆"],
  // ── 利口酒：草本 / 苦味 ───────────────────────────────────────────
  [/chartreuse/i, "查特酒"],
  [/benedictine|b\s*&\s*b/i, "本笃利口酒"],
  [/galliano/i, "加利安诺"],
  [/strega/i, "斯特雷加"],
  [/drambuie/i, "德兰布依"],
  [/glayva/i, "格莱瓦"],
  [/midori|melon\s*liqueur/i, "蜜多丽哈密瓜利口酒"],
  [/licor\s*43|cuarenta\s*y\s*tres/i, "43 号利口酒"],
  [/sambuca/i, "萨姆布卡茴香利口酒"],
  [/pernod\s*pastis|pastis/i, "茴香利口酒"],
  [/ouzo/i, "乌佐茴香酒"],
  // ── 利口酒：热带 / 果味 ───────────────────────────────────────────
  [/malibu/i, "马利宝椰子朗姆"],
  [/blue\s*curacao/i, "蓝橙皮利口酒"],
  [/passion\s*fruit\s*liqueur|passoa/i, "百香果利口酒"],
  [/lychee\s*liqueur|soho/i, "荔枝利口酒"],
  [/peach\s*schnapps|archers/i, "桃子利口酒"],
  [/watermelon\s*liqueur/i, "西瓜利口酒"],
  [/pineapple\s*liqueur/i, "菠萝利口酒"],
  // ── 开胃酒 / 苦酒 ─────────────────────────────────────────────────
  [/campari/i, "金巴利"],
  [/aperol/i, "阿佩罗"],
  [/cynar/i, "西纳尔"],
  [/fernet[\s-]*branca/i, "菲奈特布兰卡"],
  [/fernet/i, "菲奈特"],
  [/amaro\s*nonino/i, "诺尼诺阿玛罗"],
  [/amaro\s*averna/i, "阿维纳阿玛罗"],
  [/amaro\s*montenegro/i, "黑山阿玛罗"],
  [/amaro\s*lucano/i, "卢卡诺阿玛罗"],
  [/\bamaro\b/i, "阿玛罗"],
  [/suze/i, "苏兹龙胆苦酒"],
  [/gentian|gentiane/i, "龙胆苦酒"],
  [/lillet\s*blanc/i, "丽叶白"],
  [/lillet\s*rose/i, "丽叶玫瑰"],
  [/lillet/i, "丽叶"],
  [/cocchi\s*americano/i, "科奇美国佬"],
  [/cocchi\s*torino/i, "科奇都灵"],
  [/cocchi/i, "科奇"],
  // ── 味美思 ────────────────────────────────────────────────────────
  [/sweet\s*vermouth|rosso\s*vermouth|red\s*vermouth|carpano\s*antica|punt\s*e\s*mes/i, "甜味美思"],
  [/dry\s*vermouth|noilly\s*prat|dolin\s*dry/i, "干味美思"],
  [/bianco\s*vermouth|blanc\s*vermouth|dolin\s*blanc/i, "白味美思"],
  [/vermouth/i, "味美思"],
  // ── 苦精（精确品牌优先，通用兜底） ──────────────────────────────
  [/angostura/i, "安高天娜苦精"],
  [/peychaud/i, "佩乔苦精"],
  [/orange\s*bitters|regan.*orange|fee.*orange|angostura\s*orange/i, "橙味苦精"],
  [/mole\s*bitters|chocolate\s*bitters/i, "摩尔苦精"],
  [/walnut\s*bitters/i, "核桃苦精"],
  [/celery\s*bitters/i, "芹菜苦精"],
  [/grapefruit\s*bitters/i, "葡萄柚苦精"],
  [/lavender\s*bitters/i, "薰衣草苦精"],
  [/cardamom\s*bitters/i, "豆蔻苦精"],
  [/aromatic\s*bitters|fee\s*brothers|scrappy|bittermens|dashfire|hella\s*bitters/i, "苦精"],
  [/\bbitters\b|苦精/i, "苦精"],
  // ── 糖浆（精确品牌优先，通用兜底） ──────────────────────────────
  [/simple\s*syrup|sugar\s*syrup|1:1\s*syrup|2:1\s*syrup|rich\s*syrup/i, "糖浆"],
  [/demerara\s*syrup|demerara/i, "德梅拉拉糖浆"],
  [/honey\s*syrup|蜂蜜糖浆/i, "蜂蜜糖浆"],
  [/agave\s*syrup|agave\s*nectar|龙舌兰糖浆/i, "龙舌兰糖浆"],
  [/grenadine|石榴糖浆/i, "石榴糖浆"],
  [/raspberry\s*syrup/i, "覆盆子糖浆"],
  [/passion\s*fruit\s*syrup/i, "百香果糖浆"],
  [/ginger\s*syrup/i, "姜糖浆"],
  [/cinnamon\s*syrup/i, "肉桂糖浆"],
  [/lavender\s*syrup/i, "薰衣草糖浆"],
  [/rose\s*syrup|rose\s*water/i, "玫瑰糖浆"],
  [/hibiscus\s*syrup/i, "洛神花糖浆"],
  [/\bsyrup\b|糖浆/i, "糖浆"],
  // ── 果汁 ──────────────────────────────────────────────────────────
  [/fresh\s*lime\s*juice|lime\s*juice|青柠汁/i, "青柠汁"],
  [/fresh\s*lemon\s*juice|lemon\s*juice|柠檬汁/i, "柠檬汁"],
  [/fresh\s*orange\s*juice|orange\s*juice|橙汁/i, "橙汁"],
  [/fresh\s*grapefruit\s*juice|grapefruit\s*juice|葡萄柚汁/i, "葡萄柚汁"],
  [/pineapple\s*juice|菠萝汁/i, "菠萝汁"],
  [/cranberry\s*juice|蔓越莓汁/i, "蔓越莓汁"],
  [/passion\s*fruit\s*juice|百香果汁/i, "百香果汁"],
  [/apple\s*juice|苹果汁/i, "苹果汁"],
  [/tomato\s*juice|番茄汁/i, "番茄汁"],
  // ── 软饮料 / 混合饮料 ─────────────────────────────────────────────
  [/soda\s*water|club\s*soda|sparkling\s*water|苏打水/i, "苏打水"],
  [/tonic\s*water|fever[\s-]*tree|schweppes\s*tonic|汤力水/i, "汤力水"],
  [/ginger\s*beer|姜汁啤酒/i, "姜汁啤酒"],
  [/ginger\s*ale|姜汁汽水/i, "姜汁汽水"],
  [/cola|可乐|coca[\s-]*cola|pepsi/i, "可乐"],
  [/lemonade|柠檬水/i, "柠檬水"],
  [/coconut\s*water|椰子水/i, "椰子水"],
  [/coconut\s*cream|coconut\s*milk|椰浆/i, "椰浆"],
  // ── 起泡酒 / 葡萄酒 ───────────────────────────────────────────────
  [/champagne|moet|veuve\s*clicquot|bollinger|krug/i, "香槟"],
  [/prosecco/i, "普罗塞克"],
  [/cava/i, "卡瓦"],
  [/sparkling\s*wine|起泡酒/i, "起泡酒"],
  [/dry\s*white\s*wine|white\s*wine|干白/i, "干白葡萄酒"],
  [/red\s*wine|红酒|干红/i, "红葡萄酒"],
  [/port\s*wine|porto|波特酒/i, "波特酒"],
  [/sherry|雪莉酒/i, "雪莉酒"],
  // ── 啤酒 ──────────────────────────────────────────────────────────
  [/stout|guinness|黑啤/i, "黑啤酒"],
  [/lager|pale\s*ale|ipa|\bbeer\b|啤酒/i, "啤酒"],
  // ── 乳制品 / 蛋 ───────────────────────────────────────────────────
  [/heavy\s*cream|double\s*cream|whipping\s*cream|淡奶油/i, "淡奶油"],
  [/whole\s*milk|full[\s-]*fat\s*milk|牛奶/i, "牛奶"],
  [/egg\s*white|蛋清/i, "蛋清"],
  [/egg\s*yolk|蛋黄/i, "蛋黄"],
  [/whole\s*egg|\begg\b|鸡蛋/i, "鸡蛋"],
];

/** 将英文配料名转成中文等价词;中文原样返回 */
export function normalizeIngredientName(name: string): string {
  const t = name.trim();
  // 含中文时直接使用
  if (/[\u4e00-\u9fa5]/.test(t)) return t;
  for (const [re, zh] of INGREDIENT_SYNONYMS) {
    if (re.test(t)) return zh;
  }
  return t;
}

/**
 * 将配料名与酒库匹配:双向包含 + 去除常见修饰词。
 * 返回最优匹配(名称越长越具体,优先)。
 */
export function matchBottle(ingredientName: string, bottles: Bottle[]): Bottle | null {
  let name = ingredientName.trim().toLowerCase();
  if (!name) return null;
  // 英文配料名 → 中文等价词(酒库以中文分类为主)
  const normalized = normalizeIngredientName(ingredientName).toLowerCase();

  let best: Bottle | null = null;
  let bestScore = 0;
  for (const b of bottles) {
    const candidates = [b.nameZh, b.nameEn, b.brand]
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 2);
    for (const c of candidates) {
      let score = 0;
      for (const n of normalized === name ? [name] : [name, normalized]) {
        let s = 0;
        if (c === n) s = 1000;
        else if (n.includes(c)) s = 100 + c.length;
        else if (c.includes(n)) s = 50 + n.length;
        if (s > score) score = s;
      }
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
  }
  // 类别兜底:配料名含"金酒/朗姆..."时匹配该分类中最便宜的酒款
  if (!best) {
    const categories = ["金酒", "朗姆", "伏特加", "黑麦威士忌", "波本威士忌", "威士忌", "龙舌兰", "白兰地", "味美思"];
    const searchName = normalized;
    for (const cat of categories) {
      if (searchName.includes(cat) || name.includes(cat)) {
        const inCat = bottles
          .filter((b) => b.category === cat && b.priceCny > 0)
          .sort((a, b) => a.priceCny - b.priceCny);
        if (inCat.length > 0) {
          // 若配料名带"甜/红/干/白"等修饰词,优先匹配备注或名称含该修饰词的酒款
          const sweet = /甜|红|rosso|sweet/i.test(name + searchName);
          const dry = /干|dry/i.test(name + searchName);
          if (sweet) {
            const hit = inCat.find((b) => /甜|红|rosso|sweet/i.test(b.nameZh + b.nameEn + b.notes));
            if (hit) return hit;
          }
          if (dry) {
            const hit = inCat.find((b) => /干|dry/i.test(b.nameZh + b.nameEn + b.notes));
            if (hit) return hit;
          }
          return inCat[0];
        }
      }
    }
  }
  return best;
}

/** 估算整个配方的单杯成本 */
export function estimateRecipeCost(
  ingredients: Ingredient[],
  bottles: Bottle[],
): RecipeCostEstimate {
  const items: IngredientCost[] = ingredients.map((ing) => {
    const bottle = matchBottle(ing.name, bottles);
    if (!bottle) {
      return { ingredient: ing, bottle: null, amountMl: null, cost: null, reason: "no_bottle" };
    }
    const amountMl = parseAmountToMl(ing.amount);
    if (amountMl === null) {
      return { ingredient: ing, bottle, amountMl: null, cost: null, reason: "no_amount" };
    }
    if (bottle.priceCny <= 0) {
      return { ingredient: ing, bottle, amountMl, cost: null, reason: "no_price" };
    }
    const volumeMl = parseVolumeToMl(bottle.volume);
    if (!volumeMl) {
      return { ingredient: ing, bottle, amountMl, cost: null, reason: "no_volume" };
    }
    const cost = (bottle.priceCny / volumeMl) * amountMl;
    return { ingredient: ing, bottle, amountMl, cost, reason: null };
  });

  const estimated = items.filter((i) => i.cost !== null);
  return {
    items,
    total: estimated.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    estimatedCount: estimated.length,
    totalCount: ingredients.length,
  };
}
