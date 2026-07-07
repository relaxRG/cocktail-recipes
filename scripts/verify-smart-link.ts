/** 验证智能链接在真实数据集上的匹配率 */
import { smartLinkIngredient } from "../lib/recipes/smart-link";
import { buildWaldorfBottles, buildWaldorfPreps } from "../lib/bottles/waldorf-ingredients";
const recipes = require("../assets/waldorf-recipes.json").recipes as {
  nameZh: string;
  ingredients: { name: string; amount: string }[];
}[];
const bottles = buildWaldorfBottles();
const preps = buildWaldorfPreps();
let total = 0, matched = 0, toBottle = 0, toPrep = 0;
const misses: string[] = [];
for (const r of recipes) {
  for (const ing of r.ingredients) {
    total++;
    const link = smartLinkIngredient(ing.name, bottles as any, preps as any);
    if (link) { matched++; link.kind === "bottle" ? toBottle++ : toPrep++; }
    else if (misses.length < 25) misses.push(ing.name);
  }
}
console.log(`配料总数 ${total} | 匹配 ${matched} (${((matched/total)*100).toFixed(1)}%) | 酒库 ${toBottle} | 自制 ${toPrep}`);
console.log("未匹配样例:", misses.join(" / "));
