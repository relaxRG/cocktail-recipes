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
    if (r.garnish.toLowerCase().includes(q)) return true;
    if (r.variantOf.toLowerCase().includes(q)) return true;
    if (r.codexFamily.toLowerCase().includes(q)) return true;
    if (r.source.toLowerCase().includes(q)) return true;
    if (r.flavors.some((f) => f.toLowerCase().includes(q))) return true;
    return r.ingredients.some((i) => i.name.toLowerCase().includes(q));
  });
}
