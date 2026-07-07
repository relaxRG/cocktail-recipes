import { Ingredient } from "../recipes/types";
import { Bottle } from "./types";

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
  [/(?:ml|毫升|cc)/i, 1],
  [/(?:oz|盎司|ounce)/i, 30],
  [/(?:cl)/i, 10],
  [/(?:dash|抖|滴)/i, 0.9],
  [/(?:tsp|茶匙|小勺)/i, 5],
  [/(?:tbsp|汤匙|大勺)/i, 15],
  [/(?:bar\s*spoon|吧勺)/i, 5],
  [/(?:shot|杯)/i, 45],
  [/(?:splash)/i, 5],
];

/**
 * 从用量文本解析出毫升数。
 * 支持:"45ml"、"1.5 oz"、"2 dash"、"1/2 oz"、"1½oz"、"30 毫升" 等
 */
export function parseAmountToMl(amount: string): number | null {
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

  for (const [re, ml] of UNIT_TO_ML) {
    if (re.test(normalized)) return value * ml;
  }
  // 无单位默认视为 ml(常见简写如 "45")
  return value;
}

/**
 * 将用量文本统一格式化为 ml 显示。
 * 例:"1.5 oz" -> "45ml";"2 dash" -> "1.8ml";
 * 无法换算的(如"适量"、"1片"、"8-10片")原样返回。
 */
export function formatAmountAsMl(amount: string): string {
  const text = amount.trim();
  if (!text) return text;
  // 已经是纯 ml 写法时规范化输出
  const ml = parseAmountToMl(text);
  if (ml === null) return text;
  // 含"片/个/颗/枝/块/条/只/适量/少许/半个"等非液体计量时不转换
  if (/片|个|颗|枝|块|条|只|适量|少许|叶|把|抹|圈|针/.test(text)) return text;
  const rounded = Math.round(ml * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display}ml`;
}

/** 从规格文本解析瓶容量 ml,如 "700ml" / "1000ml" / "75cl" */
export function parseVolumeToMl(volume: string): number | null {
  const text = volume.trim().toLowerCase();
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(ml|毫升|cl|l|升)?/);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2] ?? "ml";
  if (unit === "l" || unit === "升") return value * 1000;
  if (unit === "cl") return value * 10;
  return value;
}

/**
 * 将配料名与酒库匹配:双向包含 + 去除常见修饰词。
 * 返回最优匹配(名称越长越具体,优先)。
 */
export function matchBottle(ingredientName: string, bottles: Bottle[]): Bottle | null {
  const name = ingredientName.trim().toLowerCase();
  if (!name) return null;

  let best: Bottle | null = null;
  let bestScore = 0;
  for (const b of bottles) {
    const candidates = [b.nameZh, b.nameEn, b.brand]
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 2);
    for (const c of candidates) {
      let score = 0;
      if (c === name) score = 1000;
      else if (name.includes(c)) score = 100 + c.length;
      else if (c.includes(name)) score = 50 + name.length;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
  }
  // 类别兜底:配料名含"金酒/朗姆..."时匹配该分类中最便宜的酒款
  if (!best) {
    const categories = ["金酒", "朗姆", "伏特加", "威士忌", "龙舌兰", "白兰地", "味美思"];
    for (const cat of categories) {
      if (name.includes(cat.toLowerCase())) {
        const inCat = bottles
          .filter((b) => b.category === cat && b.priceCny > 0)
          .sort((a, b) => a.priceCny - b.priceCny);
        if (inCat.length > 0) {
          // 若配料名带"甜/红/干/白"等修饰词,优先匹配备注或名称含该修饰词的酒款
          const sweet = /甜|红|rosso|sweet/i.test(name);
          const dry = /干|dry/i.test(name);
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
