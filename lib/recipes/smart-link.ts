/**
 * 智能配料链接引擎:把配方配料名自动匹配到酒库(Bottle)或自制库(HomemadePrep)条目。
 *
 * 统一多级匹配策略(优先级从高到低):
 * 1. 精确匹配:配料名 === 酒款中/英名 或 自制品中/英名
 * 2. Waldorf 别名规范化后精确匹配(903 条原始名 → 规范中英名)
 * 3. 同义词规范化(英文类别词 → 中文)后精确匹配
 * 4. 包含匹配(双向,长度加权,自制优先级与酒款同台竞争取最高分)
 *
 * 返回统一 SmartLink 结构,供详情页跳转、成本估算、表单实时提示复用。
 */
import type { Bottle } from "../bottles/types";
import type { HomemadePrep } from "../homemade/types";
import { matchBottle, normalizeIngredientName } from "../bottles/cost";
import { matchPrep } from "../homemade/match";
import { resolveIngredientNames } from "./ingredient-display";

export type SmartLink =
  | { kind: "bottle"; bottle: Bottle }
  | { kind: "prep"; prep: HomemadePrep }
  | null;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** 精确匹配酒库(中/英/品牌名全等) */
function exactBottle(name: string, bottles: Bottle[]): Bottle | null {
  const key = norm(name);
  if (!key) return null;
  return (
    bottles.find(
      (b) => norm(b.nameZh) === key || norm(b.nameEn) === key || (b.brand && norm(b.brand) === key),
    ) ?? null
  );
}

/** 精确匹配自制库(中/英名全等) */
function exactPrep(name: string, preps: HomemadePrep[]): HomemadePrep | null {
  const key = norm(name);
  if (!key) return null;
  return preps.find((p) => norm(p.name) === key || norm(p.nameAlt) === key) ?? null;
}

/**
 * 智能匹配单个配料名 → 酒库或自制库条目。
 * 自制库精确命中优先于酒库模糊命中;两边都只有模糊命中时,自制优先
 * (自制品通常是配方中明确写出的自制成分,如"蜂蜜糖浆")。
 */
export function smartLinkIngredient(
  rawName: string,
  bottles: Bottle[],
  preps: HomemadePrep[],
): SmartLink {
  const name = rawName.trim();
  if (!name || name.length < 2) return null;

  // 1) 双边精确匹配(原文)
  const eb = exactBottle(name, bottles);
  if (eb) return { kind: "bottle", bottle: eb };
  const ep = exactPrep(name, preps);
  if (ep) return { kind: "prep", prep: ep };

  // 2) Waldorf 别名规范化 → 双边精确匹配
  const resolved = resolveIngredientNames(name, bottles, preps);
  if (resolved) {
    for (const candidate of [resolved.zh, resolved.en]) {
      if (!candidate || norm(candidate) === norm(name)) continue;
      const b = exactBottle(candidate, bottles);
      if (b) return { kind: "bottle", bottle: b };
      const p = exactPrep(candidate, preps);
      if (p) return { kind: "prep", prep: p };
    }
  }

  // 3) 同义词规范化(英文类别词 → 中文)后精确匹配
  const normalized = normalizeIngredientName(name);
  if (normalized && norm(normalized) !== norm(name)) {
    const b = exactBottle(normalized, bottles);
    if (b) return { kind: "bottle", bottle: b };
    const p = exactPrep(normalized, preps);
    if (p) return { kind: "prep", prep: p };
  }

  // 4) 模糊匹配:自制优先,其次酒库(matchBottle 含类别兜底)
  const fp = matchPrep(name, preps);
  if (fp) return { kind: "prep", prep: fp };
  const fb = matchBottle(name, bottles);
  if (fb) return { kind: "bottle", bottle: fb };

  // 5) 规范名再走一轮模糊(处理 Waldorf 别名下的变体写法)
  if (resolved) {
    for (const candidate of [resolved.zh, resolved.en]) {
      if (!candidate) continue;
      const p2 = matchPrep(candidate, preps);
      if (p2) return { kind: "prep", prep: p2 };
      const b2 = matchBottle(candidate, bottles);
      if (b2) return { kind: "bottle", bottle: b2 };
    }
  }
  return null;
}

/** 批量匹配配方全部配料,返回 Map<ingredientId, SmartLink> */
export function smartLinkAll(
  ingredients: { id: string; name: string }[],
  bottles: Bottle[],
  preps: HomemadePrep[],
): Map<string, SmartLink> {
  const out = new Map<string, SmartLink>();
  for (const ing of ingredients) {
    out.set(ing.id, smartLinkIngredient(ing.name, bottles, preps));
  }
  return out;
}
