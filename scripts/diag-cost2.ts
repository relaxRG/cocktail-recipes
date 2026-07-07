import { buildWaldorfBottles, buildWaldorfPreps } from "../lib/bottles/waldorf-ingredients";
import { estimateRecipeCostSmart } from "../lib/recipes/smart-cost";
import recipesData from "../assets/waldorf-recipes.json";

const bottles = buildWaldorfBottles();
let preps: any[] = [];
try { preps = (buildWaldorfPreps as any)(); } catch { preps = []; }
const recipes: any[] = (recipesData as any).recipes ?? recipesData;

const reasons: Record<string, number> = {};
let totalIng = 0, ok = 0, recipesWithTotal = 0;
const samples: Record<string, string[]> = {};
for (const r of recipes) {
  const ings = (r.ingredients ?? []).map((i: any, idx: number) => ({ id: String(idx), name: i.name ?? "", amount: i.amount ?? "" }));
  const est = estimateRecipeCostSmart(ings, bottles, preps);
  if (est.estimatedCount > 0) recipesWithTotal++;
  for (const item of est.items) {
    totalIng++;
    if (item.cost !== null) { ok++; continue; }
    const reason = item.reason ?? "unknown";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    if ((samples[reason] ??= []).length < 6) samples[reason].push(`${item.ingredient.name} | ${item.ingredient.amount}`);
  }
}
console.log("total:", totalIng, "costed:", ok, `(${(ok/totalIng*100).toFixed(1)}%)`);
console.log("recipes with a total:", recipesWithTotal, "/", recipes.length);
console.log("failures:", reasons);
for (const [k, v] of Object.entries(samples)) console.log(`--- ${k}:`, v);
