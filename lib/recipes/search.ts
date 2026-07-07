import { Recipe } from "./types";

/**
 * Filter recipes by free-text query (name, ingredients, notes, base spirit)
 * and optional category / favorite filters.
 */
export function filterRecipes(
  recipes: Recipe[],
  query: string,
  filter: {
    categoryId?: string | null;
    favoritesOnly?: boolean;
    codexFamily?: string;
    flavor?: string;
  },
): Recipe[] {
  const q = query.trim().toLowerCase();
  return recipes.filter((r) => {
    if (filter.favoritesOnly && !r.favorite) return false;
    if (filter.categoryId !== undefined && filter.categoryId !== null) {
      if (r.categoryId !== filter.categoryId) return false;
    }
    if (filter.codexFamily && r.codexFamily !== filter.codexFamily) return false;
    if (filter.flavor && !r.flavors.includes(filter.flavor)) return false;
    if (!q) return true;
    if (r.name.toLowerCase().includes(q)) return true;
    if (r.baseSpirit.toLowerCase().includes(q)) return true;
    if (r.notes.toLowerCase().includes(q)) return true;
    if ((r.story ?? "").toLowerCase().includes(q)) return true;
    if ((r.flavorDesc ?? "").toLowerCase().includes(q)) return true;
    if (r.garnish.toLowerCase().includes(q)) return true;
    if (r.variantOf.toLowerCase().includes(q)) return true;
    if (r.codexFamily.toLowerCase().includes(q)) return true;
    if (r.source.toLowerCase().includes(q)) return true;
    if (r.flavors.some((f) => f.toLowerCase().includes(q))) return true;
    // 中英文互认:英文搜索词归一化为中文后再匹配(如搜 gin 命中"金酒"),
    // 配料若是英文也归一化后与搜索词比对(如搜"金酒"命中 Gin)
    const qZh = normalizeIngredientName(q).toLowerCase();
    return r.ingredients.some((i) => {
      const n = i.name.toLowerCase();
      if (n.includes(q)) return true;
      if (qZh !== q && n.includes(qZh)) return true;
      const nZh = normalizeIngredientName(i.name).toLowerCase();
      return nZh !== n && (nZh.includes(q) || nZh.includes(qZh));
    });
  });
}
import { normalizeIngredientName } from "../bottles/cost";
