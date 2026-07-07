/**
 * 智能成本估算:成本计算与智能配料链接(smartLink)使用同一套匹配。
 *
 * 修复旧 estimateRecipeCost 的问题:
 * - 旧版只用 matchBottle(仅同义词+包含匹配),"Angostura 苦精"等带品牌前缀
 *   或 Waldorf 别名写法的配料匹配不到酒库 → 价格无法显示、总成本偏低。
 * - 新版复用 smartLinkIngredient 的五级匹配(精确/别名/同义词/模糊/规范名再模糊),
 *   酒库与自制库双通道:酒款按 价格/瓶容量*用量 折算,自制品按单位成本折算。
 * - 补充微量单位(dash/pinch/drop/rinse/barspoon 等)的估算,不再因解析不了用量而放弃。
 */
import type { Bottle } from "../bottles/types";
import type { HomemadePrep } from "../homemade/types";
import type { Ingredient } from "./types";
import { parseAmountToMl, parseVolumeToMl } from "../bottles/cost";
import { estimateHomemadeIngredientCost } from "../homemade/cost";
import { smartLinkIngredient, type SmartLink } from "./smart-link";

export interface SmartIngredientCost {
  ingredient: Ingredient;
  link: SmartLink;
  amountMl: number | null;
  cost: number | null;
  reason: "no_match" | "no_amount" | "no_price" | "no_volume" | null;
}

export interface SmartRecipeCost {
  items: SmartIngredientCost[];
  total: number;
  estimatedCount: number;
  totalCount: number;
}

/** 微量/份数单位估算(ml),parseAmountToMl 解析失败时的兜底 */
export function parseAmountLoose(amount: string): number | null {
  const std = parseAmountToMl(amount);
  if (std !== null) return std;
  const a = amount.trim().toLowerCase();
  if (!a) return null;
  const numMatch = a.match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)/);
  let n = 1;
  if (numMatch) {
    const s = numMatch[1].replace(/\s/g, "");
    if (s.includes("/")) {
      const [p, q] = s.split("/").map(Number);
      n = q ? p / q : 1;
    } else {
      n = Number(s);
    }
  }
  if (/dash|抖|滴洒/.test(a)) return n * 0.9;
  if (/drop|滴/.test(a)) return n * 0.05;
  if (/pinch|少许|一撮/.test(a)) return n * 0.3;
  if (/rinse|涮杯|洗杯/.test(a)) return 3;
  if (/barspoon|bar spoon|吧勺|吧匙/.test(a)) return n * 5;
  if (/tsp|茶匙/.test(a)) return n * 5;
  if (/tbsp|汤匙/.test(a)) return n * 15;
  if (/splash|注/.test(a)) return n * 7;
  if (/float|漂浮/.test(a)) return n * 7;
  if (/top|补满|加满/.test(a)) return 60;
  return null;
}

/** 酒库条目的每毫升单价;价格或容量缺失返回 null */
function bottleUnitPrice(bottle: Bottle): number | null {
  if (!bottle.priceCny || bottle.priceCny <= 0) return null;
  const vol = parseVolumeToMl(bottle.volume);
  if (!vol) return null;
  return bottle.priceCny / vol;
}

/** 单个配料的智能成本 */
export function estimateIngredientCostSmart(
  ing: Ingredient,
  bottles: Bottle[],
  preps: HomemadePrep[],
): SmartIngredientCost {
  const link = smartLinkIngredient(ing.name, bottles, preps);
  if (!link) {
    return { ingredient: ing, link: null, amountMl: null, cost: null, reason: "no_match" };
  }
  const amountMl = parseAmountLoose(ing.amount);

  if (link.kind === "bottle") {
    const unit = bottleUnitPrice(link.bottle);
    if (unit === null) {
      return {
        ingredient: ing,
        link,
        amountMl,
        cost: null,
        reason: link.bottle.priceCny > 0 ? "no_volume" : "no_price",
      };
    }
    if (amountMl === null) {
      return { ingredient: ing, link, amountMl: null, cost: null, reason: "no_amount" };
    }
    return { ingredient: ing, link, amountMl, cost: unit * amountMl, reason: null };
  }

  // 自制品:复用现有的自制单位成本估算(内部会汇总自制配方的原料成本)
  const hm = estimateHomemadeIngredientCost(ing.name, ing.amount, preps, bottles);
  if (hm && hm.cost !== null) {
    return { ingredient: ing, link, amountMl: amountMl, cost: hm.cost, reason: null };
  }
  return { ingredient: ing, link, amountMl, cost: null, reason: "no_price" };
}

/** 整配方智能成本估算 */
export function estimateRecipeCostSmart(
  ingredients: Ingredient[],
  bottles: Bottle[],
  preps: HomemadePrep[],
): SmartRecipeCost {
  const items = ingredients.map((ing) => estimateIngredientCostSmart(ing, bottles, preps));
  const estimated = items.filter((i) => i.cost !== null);
  return {
    items,
    total: estimated.reduce((s, i) => s + (i.cost ?? 0), 0),
    estimatedCount: estimated.length,
    totalCount: ingredients.length,
  };
}
