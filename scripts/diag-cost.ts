import { buildWaldorfBottles } from "../lib/bottles/waldorf-ingredients";
import { estimateRecipeCost } from "../lib/bottles/cost";
import { smartLinkIngredient } from "../lib/recipes/smart-link";
import recipesData from "../assets/waldorf-recipes.json";

const bottles = buildWaldorfBottles();
const recipes: any[] = (recipesData as any).recipes ?? recipesData;

const reasons: Record<string, number> = {};
let totalIng = 0, ok = 0, smartWouldFix = 0;
const samples: Record<string, string[]> = {};
for (const r of recipes) {
  const ings = (r.ingredients ?? []).map((i: any, idx: number) => ({ id: String(idx), name: i.name ?? i.nameZh ?? "", amount: i.amount ?? "" }));
  const est = estimateRecipeCost(ings, bottles);
  for (const item of est.items) {
    totalIng++;
    if (item.cost !== null) { ok++; continue; }
    const reason = item.reason ?? "unknown";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    (samples[reason] ??= []).length < 5 && samples[reason].push(`${item.ingredient.name} | ${item.ingredient.amount}`);
    if (reason === "no_bottle") {
      const sl = smartLinkIngredient(item.ingredient.name, bottles, []);
      if (sl?.kind === "bottle") smartWouldFix++;
    }
  }
}
console.log("total ingredients:", totalIng, "costed:", ok);
console.log("failure reasons:", reasons);
console.log("no_bottle fixable by smartLink:", smartWouldFix);
for (const [k, v] of Object.entries(samples)) console.log(`--- ${k} samples:`, v);
