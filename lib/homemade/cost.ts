// Homemade prep cost estimation based on Chinese grocery/e-commerce reference prices
// (Taobao / JD / Hema typical prices, 2026). Prices are reference values in CNY.
import { matchPrep } from "./match";
import { parseAmountToMl } from "../bottles/cost";
import { HomemadePrep } from "./types";
import { Bottle } from "../bottles/types";
import { parseVolumeToMl } from "../bottles/cost";

/**
 * Reference price entry for a raw material on Chinese shopping sites.
 * pricePerUnit: CNY per base unit (g / ml / piece).
 */
export interface MaterialPrice {
  /** Match patterns (bilingual regex) */
  match: RegExp;
  /** English label */
  en: string;
  /** Chinese label */
  zh: string;
  /** Base unit for pricing */
  unit: "g" | "ml" | "piece";
  /** CNY per base unit, e.g. sugar ≈ ¥0.008/g (¥8/kg) */
  pricePerUnit: number;
  /** Typical retail pack for reference display, e.g. "¥8/kg 淘宝" */
  ref: string;
}

/**
 * Chinese market reference prices (Taobao/JD/Hema, mid-range products).
 * Ordered specific → generic; first match wins.
 */
export const MATERIAL_PRICES: MaterialPrice[] = [
  // Sugars & sweeteners 糖类
  { match: /caster|white\s*sugar|granulated|白砂糖|砂糖|白糖/i, en: "White sugar", zh: "白砂糖", unit: "g", pricePerUnit: 0.008, ref: "¥8/kg" },
  { match: /demerara|turbinado|raw\s*sugar|德梅拉拉|原蔗糖|红糖|黑糖/i, en: "Demerara/raw sugar", zh: "原蔗糖/红糖", unit: "g", pricePerUnit: 0.02, ref: "¥20/kg" },
  { match: /rock\s*sugar|冰糖/i, en: "Rock sugar", zh: "冰糖", unit: "g", pricePerUnit: 0.012, ref: "¥12/kg" },
  { match: /honey|蜂蜜/i, en: "Honey", zh: "蜂蜜", unit: "g", pricePerUnit: 0.04, ref: "¥40/kg" },
  { match: /agave\s*(nectar|syrup)|龙舌兰蜜/i, en: "Agave nectar", zh: "龙舌兰蜜", unit: "g", pricePerUnit: 0.08, ref: "¥40/500g" },
  { match: /maple\s*syrup|枫糖/i, en: "Maple syrup", zh: "枫糖浆", unit: "ml", pricePerUnit: 0.12, ref: "¥45/375ml" },
  // Citrus & fruit 柑橘水果
  { match: /lime\s*(juice|peel|zest)?|青柠/i, en: "Lime", zh: "青柠", unit: "g", pricePerUnit: 0.03, ref: "¥15/500g" },
  { match: /lemon|柠檬/i, en: "Lemon", zh: "柠檬", unit: "g", pricePerUnit: 0.016, ref: "¥8/500g" },
  { match: /orange\s*(juice|peel|zest)?|橙子|橙皮|甜橙/i, en: "Orange", zh: "橙子", unit: "g", pricePerUnit: 0.012, ref: "¥6/500g" },
  { match: /grapefruit|西柚|葡萄柚/i, en: "Grapefruit", zh: "西柚", unit: "g", pricePerUnit: 0.016, ref: "¥8/500g" },
  { match: /pineapple|菠萝|凤梨/i, en: "Pineapple", zh: "菠萝", unit: "g", pricePerUnit: 0.012, ref: "¥6/500g" },
  { match: /passion\s*fruit|百香果/i, en: "Passion fruit", zh: "百香果", unit: "g", pricePerUnit: 0.03, ref: "¥15/500g" },
  { match: /raspberr(y|ies)|树莓|覆盆子/i, en: "Raspberries", zh: "树莓", unit: "g", pricePerUnit: 0.12, ref: "¥15/125g" },
  { match: /strawberr(y|ies)|草莓/i, en: "Strawberries", zh: "草莓", unit: "g", pricePerUnit: 0.04, ref: "¥20/500g" },
  { match: /pomegranate|石榴/i, en: "Pomegranate", zh: "石榴", unit: "g", pricePerUnit: 0.02, ref: "¥10/500g" },
  { match: /apple|苹果/i, en: "Apple", zh: "苹果", unit: "g", pricePerUnit: 0.012, ref: "¥6/500g" },
  { match: /cucumber|黄瓜/i, en: "Cucumber", zh: "黄瓜", unit: "g", pricePerUnit: 0.008, ref: "¥4/500g" },
  { match: /coconut\s*(cream|milk)|椰浆|椰奶/i, en: "Coconut cream", zh: "椰浆", unit: "ml", pricePerUnit: 0.03, ref: "¥12/400ml" },
  // Spices & botanicals 香料
  { match: /ginger|鲜姜|生姜|姜/i, en: "Fresh ginger", zh: "鲜姜", unit: "g", pricePerUnit: 0.02, ref: "¥10/500g" },
  { match: /cinnamon|肉桂/i, en: "Cinnamon", zh: "肉桂", unit: "g", pricePerUnit: 0.06, ref: "¥15/250g" },
  { match: /clove|丁香/i, en: "Cloves", zh: "丁香", unit: "g", pricePerUnit: 0.08, ref: "¥8/100g" },
  { match: /star\s*anise|八角/i, en: "Star anise", zh: "八角", unit: "g", pricePerUnit: 0.06, ref: "¥15/250g" },
  { match: /cardamom|豆蔻/i, en: "Cardamom", zh: "豆蔻", unit: "g", pricePerUnit: 0.2, ref: "¥20/100g" },
  { match: /vanilla|香草荚|香草/i, en: "Vanilla bean", zh: "香草荚", unit: "piece", pricePerUnit: 15, ref: "¥15/根" },
  { match: /allspice|多香果/i, en: "Allspice", zh: "多香果", unit: "g", pricePerUnit: 0.12, ref: "¥12/100g" },
  { match: /peppercorn|花椒|胡椒/i, en: "Peppercorns", zh: "花椒/胡椒", unit: "g", pricePerUnit: 0.08, ref: "¥20/250g" },
  { match: /chil(i|li|le)|辣椒/i, en: "Chili", zh: "辣椒", unit: "g", pricePerUnit: 0.03, ref: "¥15/500g" },
  { match: /lemongrass|香茅/i, en: "Lemongrass", zh: "香茅", unit: "g", pricePerUnit: 0.04, ref: "¥10/250g" },
  { match: /mint|薄荷/i, en: "Mint", zh: "薄荷", unit: "g", pricePerUnit: 0.08, ref: "¥8/100g" },
  { match: /rosemary|迷迭香/i, en: "Rosemary", zh: "迷迭香", unit: "g", pricePerUnit: 0.1, ref: "¥10/100g" },
  { match: /gentian|龙胆/i, en: "Gentian root", zh: "龙胆根", unit: "g", pricePerUnit: 0.3, ref: "¥30/100g" },
  { match: /wormwood|苦艾/i, en: "Wormwood", zh: "苦艾草", unit: "g", pricePerUnit: 0.2, ref: "¥20/100g" },
  { match: /orris|鸢尾/i, en: "Orris root", zh: "鸢尾根", unit: "g", pricePerUnit: 0.4, ref: "¥40/100g" },
  { match: /juniper|杜松子/i, en: "Juniper berries", zh: "杜松子", unit: "g", pricePerUnit: 0.15, ref: "¥15/100g" },
  // Nuts, tea, coffee 坚果茶咖
  { match: /almond|杏仁/i, en: "Almonds", zh: "杏仁", unit: "g", pricePerUnit: 0.07, ref: "¥35/500g" },
  { match: /earl\s*grey|伯爵茶/i, en: "Earl Grey tea", zh: "伯爵茶", unit: "g", pricePerUnit: 0.4, ref: "¥40/100g" },
  { match: /green\s*tea|绿茶|龙井/i, en: "Green tea", zh: "绿茶", unit: "g", pricePerUnit: 0.5, ref: "¥50/100g" },
  { match: /\btea\b|茶叶|红茶/i, en: "Tea", zh: "茶叶", unit: "g", pricePerUnit: 0.3, ref: "¥30/100g" },
  { match: /coffee\s*bean|咖啡豆/i, en: "Coffee beans", zh: "咖啡豆", unit: "g", pricePerUnit: 0.12, ref: "¥60/500g" },
  { match: /cold\s*brew|coffee|咖啡/i, en: "Coffee", zh: "咖啡", unit: "ml", pricePerUnit: 0.03, ref: "自制冷萃" },
  { match: /cacao|cocoa|可可/i, en: "Cacao nibs", zh: "可可碎", unit: "g", pricePerUnit: 0.12, ref: "¥30/250g" },
  // Dairy & others 乳品及其他
  { match: /whole\s*milk|milk|全脂牛奶|牛奶/i, en: "Whole milk", zh: "全脂牛奶", unit: "ml", pricePerUnit: 0.014, ref: "¥14/L" },
  { match: /cream|淡奶油|奶油/i, en: "Cream", zh: "淡奶油", unit: "ml", pricePerUnit: 0.05, ref: "¥25/500ml" },
  { match: /egg\s*white|蛋白|鸡蛋/i, en: "Egg", zh: "鸡蛋", unit: "piece", pricePerUnit: 1.2, ref: "¥12/10枚" },
  { match: /citric\s*acid|柠檬酸/i, en: "Citric acid", zh: "柠檬酸", unit: "g", pricePerUnit: 0.03, ref: "¥15/500g" },
  { match: /malic\s*acid|苹果酸/i, en: "Malic acid", zh: "苹果酸", unit: "g", pricePerUnit: 0.06, ref: "¥30/500g" },
  { match: /tartaric|酒石酸/i, en: "Tartaric acid", zh: "酒石酸", unit: "g", pricePerUnit: 0.08, ref: "¥40/500g" },
  { match: /salt|盐/i, en: "Salt", zh: "食盐", unit: "g", pricePerUnit: 0.004, ref: "¥4/kg" },
  { match: /apple\s*cider\s*vinegar|vinegar|苹果醋|白醋|醋/i, en: "Vinegar", zh: "醋", unit: "ml", pricePerUnit: 0.02, ref: "¥10/500ml" },
  { match: /yeast|酵母/i, en: "Yeast", zh: "酵母", unit: "g", pricePerUnit: 0.3, ref: "¥15/50g" },
  { match: /almond\s*extract|杏仁精/i, en: "Almond extract", zh: "杏仁精", unit: "ml", pricePerUnit: 0.3, ref: "¥15/50ml" },
  { match: /orange\s*(flower|blossom)\s*water|橙花水/i, en: "Orange flower water", zh: "橙花水", unit: "ml", pricePerUnit: 0.15, ref: "¥30/200ml" },
  { match: /rose\s*water|玫瑰水/i, en: "Rose water", zh: "玫瑰水", unit: "ml", pricePerUnit: 0.1, ref: "¥20/200ml" },
  { match: /glycerin|甘油/i, en: "Glycerin", zh: "甘油", unit: "ml", pricePerUnit: 0.06, ref: "¥30/500ml" },
  { match: /water|水/i, en: "Water", zh: "水", unit: "ml", pricePerUnit: 0.002, ref: "¥2/L" },
];

/** Spirit base fallback prices when not matched to the bottle library (CNY/ml) */
const SPIRIT_FALLBACKS: MaterialPrice[] = [
  { match: /vodka|伏特加/i, en: "Vodka", zh: "伏特加", unit: "ml", pricePerUnit: 0.12, ref: "¥85/700ml" },
  { match: /white\s*rum|light\s*rum|白朗姆/i, en: "White rum", zh: "白朗姆", unit: "ml", pricePerUnit: 0.13, ref: "¥90/700ml" },
  { match: /dark\s*rum|aged\s*rum|黑朗姆|陈年朗姆/i, en: "Dark rum", zh: "黑朗姆", unit: "ml", pricePerUnit: 0.2, ref: "¥140/700ml" },
  { match: /\brum\b|朗姆/i, en: "Rum", zh: "朗姆", unit: "ml", pricePerUnit: 0.15, ref: "¥105/700ml" },
  { match: /\bgin\b|金酒/i, en: "Gin", zh: "金酒", unit: "ml", pricePerUnit: 0.17, ref: "¥120/700ml" },
  { match: /bourbon|rye|whisk(e)?y|威士忌|波本|黑麦/i, en: "Whisky", zh: "威士忌", unit: "ml", pricePerUnit: 0.21, ref: "¥150/700ml" },
  { match: /tequila|龙舌兰/i, en: "Tequila", zh: "龙舌兰", unit: "ml", pricePerUnit: 0.29, ref: "¥200/700ml" },
  { match: /brandy|cognac|白兰地|干邑/i, en: "Brandy", zh: "白兰地", unit: "ml", pricePerUnit: 0.26, ref: "¥180/700ml" },
  { match: /neutral\s*(grain\s*)?spirit|everclear|食用酒精|高度白酒/i, en: "Neutral spirit", zh: "食用烈酒", unit: "ml", pricePerUnit: 0.08, ref: "¥40/500ml" },
  { match: /white\s*wine|红葡萄酒|白葡萄酒|wine|葡萄酒/i, en: "Wine", zh: "葡萄酒", unit: "ml", pricePerUnit: 0.08, ref: "¥60/750ml" },
];

/** Parsed ingredient line with quantity */
export interface PrepIngredientCost {
  /** Raw ingredient line */
  line: string;
  /** Matched material label (bilingual by lang at render time) */
  materialEn: string | null;
  materialZh: string | null;
  /** Parsed quantity in base unit */
  quantity: number | null;
  /** Base unit of the match */
  unit: "g" | "ml" | "piece" | null;
  /** Estimated cost in CNY */
  cost: number | null;
  /** Reference price display */
  ref: string | null;
}

export interface PrepCostEstimate {
  items: PrepIngredientCost[];
  /** Total batch cost (estimated items only), CNY */
  batchCost: number;
  /** Number of costed lines */
  estimatedCount: number;
  totalCount: number;
  /** Batch yield in ml parsed from prep.yield, null if unknown */
  yieldMl: number | null;
  /** Cost per 100ml, null if yield unknown */
  costPer100Ml: number | null;
  /** Cost per 30ml (1 oz pour), null if yield unknown */
  costPer30Ml: number | null;
}

/**
 * Parse a quantity from an ingredient line: supports g/kg/ml/L/oz/piece counts.
 * e.g. "500g white sugar 白砂糖" → { qty: 500, unit: "g" }
 *      "700ml London dry gin" → { qty: 700, unit: "ml" }
 *      "2 vanilla beans" → { qty: 2, unit: "piece" }
 */
export function parseQuantity(line: string): { qty: number; unit: "g" | "ml" | "piece" } | null {
  const text = line.trim().toLowerCase();
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克|ml|毫升|l|升|liter|litre|oz|盎司|个|枚|颗|根|片|只|pieces?|pcs?|beans?|pods?)?/);
  if (!m) return null;
  const value = Number(m[1]);
  if (!isFinite(value) || value <= 0) return null;
  const unit = m[2] ?? "";
  if (/^(kg|千克|公斤)$/.test(unit)) return { qty: value * 1000, unit: "g" };
  if (/^(g|克)$/.test(unit)) return { qty: value, unit: "g" };
  if (/^(l|升|liter|litre)$/.test(unit)) return { qty: value * 1000, unit: "ml" };
  if (/^(ml|毫升)$/.test(unit)) return { qty: value, unit: "ml" };
  if (/^(oz|盎司)$/.test(unit)) return { qty: value * 30, unit: "ml" };
  if (/^(个|枚|颗|根|片|只|pieces?|pcs?|beans?|pods?)$/.test(unit)) return { qty: value, unit: "piece" };
  // Bare number: ambiguous → treat as piece count only when small
  if (!unit && value <= 20) return { qty: value, unit: "piece" };
  return null;
}

/** Find a reference price for an ingredient line (materials first, then spirit fallbacks) */
export function matchMaterial(line: string): MaterialPrice | null {
  for (const mp of MATERIAL_PRICES) {
    if (mp.match.test(line)) return mp;
  }
  for (const mp of SPIRIT_FALLBACKS) {
    if (mp.match.test(line)) return mp;
  }
  return null;
}

/** Convert a parsed quantity to the material's base unit (approximation: 1ml ≈ 1g for liquids) */
function convertQty(
  qty: number,
  from: "g" | "ml" | "piece",
  to: "g" | "ml" | "piece",
): number | null {
  if (from === to) return qty;
  // Liquid/solid approximation
  if ((from === "g" && to === "ml") || (from === "ml" && to === "g")) return qty;
  // piece-based conversions are material specific; use rough averages
  if (from === "piece" && to === "g") return qty * 60; // e.g. a lime/lemon ≈ 60g
  if (from === "piece" && to === "ml") return qty * 30;
  if (from === "g" && to === "piece") return qty / 60;
  if (from === "ml" && to === "piece") return qty / 30;
  return null;
}

/**
 * Estimate homemade prep batch cost from its ingredient lines.
 * Tries the bottle library first for spirit lines (uses user's actual bottle prices),
 * then falls back to the Chinese-market material price table.
 */
export function estimatePrepCost(prep: HomemadePrep, bottles: Bottle[]): PrepCostEstimate {
  const items: PrepIngredientCost[] = prep.ingredients.map((line) => {
    const parsed = parseQuantity(line);
    // 1) Try matching user's bottle library for alcohol lines with ml quantities
    if (parsed && parsed.unit === "ml") {
      const bottle = matchBottleForPrepLine(line, bottles);
      if (bottle && bottle.priceCny > 0) {
        const volumeMl = parseVolumeToMl(bottle.volume);
        if (volumeMl) {
          return {
            line,
            materialEn: bottle.nameEn || bottle.nameZh,
            materialZh: bottle.nameZh || bottle.nameEn,
            quantity: parsed.qty,
            unit: "ml",
            cost: (bottle.priceCny / volumeMl) * parsed.qty,
            ref: `¥${bottle.priceCny}/${bottle.volume}`,
          };
        }
      }
    }
    // 2) Material reference price table
    const mp = matchMaterial(line);
    if (!mp) {
      return { line, materialEn: null, materialZh: null, quantity: parsed?.qty ?? null, unit: parsed?.unit ?? null, cost: null, ref: null };
    }
    if (!parsed) {
      return { line, materialEn: mp.en, materialZh: mp.zh, quantity: null, unit: null, cost: null, ref: mp.ref };
    }
    const converted = convertQty(parsed.qty, parsed.unit, mp.unit);
    if (converted === null) {
      return { line, materialEn: mp.en, materialZh: mp.zh, quantity: parsed.qty, unit: parsed.unit, cost: null, ref: mp.ref };
    }
    return {
      line,
      materialEn: mp.en,
      materialZh: mp.zh,
      quantity: parsed.qty,
      unit: parsed.unit,
      cost: mp.pricePerUnit * converted,
      ref: mp.ref,
    };
  });

  const estimated = items.filter((i) => i.cost !== null);
  const batchCost = estimated.reduce((s, i) => s + (i.cost ?? 0), 0);
  const yieldMl = parseYieldToMl(prep.yield);
  return {
    items,
    batchCost,
    estimatedCount: estimated.length,
    totalCount: items.length,
    yieldMl,
    costPer100Ml: yieldMl ? (batchCost / yieldMl) * 100 : null,
    costPer30Ml: yieldMl ? (batchCost / yieldMl) * 30 : null,
  };
}

/** Parse yield text like "~750ml", "约1L", "700 ml", "1.5L" to ml */
export function parseYieldToMl(text: string): number | null {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ml|毫升|l|升)/);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2];
  if (unit === "l" || unit === "升") return value * 1000;
  return value;
}

/** Loose bottle match for prep ingredient lines (spirits only, avoids false hits on sugar etc.) */
function matchBottleForPrepLine(line: string, bottles: Bottle[]): Bottle | null {
  const l = line.toLowerCase();
  // Only attempt for clearly alcoholic lines
  if (!/gin|rum|vodka|whisk|bourbon|rye|tequila|mezcal|brandy|cognac|wine|vermouth|spirit|liqueur|金酒|朗姆|伏特加|威士忌|波本|龙舌兰|白兰地|干邑|葡萄酒|味美思|利口酒|烈酒|白酒/.test(l)) {
    return null;
  }
  let best: Bottle | null = null;
  let bestLen = 0;
  for (const b of bottles) {
    for (const c of [b.nameZh, b.nameEn]) {
      const cl = c.trim().toLowerCase();
      if (cl.length >= 3 && l.includes(cl) && cl.length > bestLen) {
        best = b;
        bestLen = cl.length;
      }
    }
  }
  return best;
}

/**
 * Estimate the cost of a recipe ingredient using a homemade prep's unit cost.
 * Returns null when no prep matches, the prep has no yield, or the amount can't be parsed.
 */
export function estimateHomemadeIngredientCost(
  ingredientName: string,
  amount: string,
  preps: HomemadePrep[],
  bottles: Bottle[],
): { prep: HomemadePrep; amountMl: number; cost: number; costPer30Ml: number } | null {
  const prep = matchPrep(ingredientName, preps);
  if (!prep) return null;
  const est = estimatePrepCost(prep, bottles);
  if (est.estimatedCount === 0 || est.costPer30Ml === null) return null;
  const amountMl = parseAmountToMl(amount);
  if (amountMl === null) return null;
  return {
    prep,
    amountMl,
    cost: (est.costPer30Ml / 30) * amountMl,
    costPer30Ml: est.costPer30Ml,
  };
}
