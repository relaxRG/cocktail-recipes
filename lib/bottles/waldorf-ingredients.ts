/**
 * 《The Waldorf Astoria Bar Book》配料数据集导入模块。
 * 数据来自 assets/waldorf-ingredients.json:
 * - bottles: 481 条酒款/生鲜原料(规范中英名 + 中国电商偏低参考价)
 * - preps: 63 条自制品(糖浆等)
 * - aliasMap: 903 条"配方原始配料名 → 规范中英名"映射(双语显示用)
 * - stepsEn: 中文调制步骤/装饰句 → 英文翻译映射
 */
import type { Bottle } from "./types";
import { BOTTLE_CATEGORIES } from "./types";
import type { HomemadePrep } from "../homemade/types";

interface WaldorfBottleRow {
  nameEn: string;
  nameZh: string;
  category: string;
  kind: "bottle" | "fresh";
  priceCny: number | null;
  volume: string;
  note: string;
}
interface WaldorfPrepRow {
  nameEn: string;
  nameZh: string;
  category: string;
  note: string;
}
interface WaldorfIngredientData {
  bottles: WaldorfBottleRow[];
  preps: WaldorfPrepRow[];
  aliasMap: Record<string, { en: string; zh: string }>;
  stepsEn: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DATA = require("../../assets/waldorf-ingredients.json") as WaldorfIngredientData;

export const WALDORF_ALIAS_MAP: Record<string, { en: string; zh: string }> = DATA.aliasMap;
export const WALDORF_STEPS_EN: Record<string, string> = DATA.stepsEn;

/** 数据源分类 → 应用酒库分类(不在 BOTTLE_CATEGORIES 内的映射到最接近项) */
const CATEGORY_MAP: Record<string, string> = {
  金酒: "金酒",
  朗姆: "朗姆",
  伏特加: "伏特加",
  威士忌: "威士忌",
  龙舌兰: "龙舌兰",
  白兰地: "白兰地",
  利口酒: "利口酒",
  苦精: "苦精",
  味美思: "味美思",
  开胃酒: "开胃酒",
  葡萄酒香槟: "葡萄酒",
  葡萄酒: "葡萄酒",
  起泡酒: "起泡酒",
  苹果酒: "葡萄酒",
  啤酒: "软饮",
  苦艾酒: "利口酒",
  糖浆: "糖浆",
  软饮: "软饮",
  水果: "原材料",
  果汁: "原材料",
  香草香料: "原材料",
  乳蛋: "原材料",
  其他: "其他",
};

function mapCategory(cat: string, kind: string): string {
  if (kind === "fresh") return "原材料";
  const m = CATEGORY_MAP[cat];
  if (m && (BOTTLE_CATEGORIES as readonly string[]).includes(m)) return m;
  return "其他";
}

/** 构建酒库条目(id 稳定,便于去重与幂等导入) */
export function buildWaldorfBottles(): Bottle[] {
  const now = Date.now();
  return DATA.bottles.map((b, i) => ({
    id: `waldorf-b-${i}`,
    nameZh: b.nameZh,
    nameEn: b.nameEn,
    category: mapCategory(b.category, b.kind),
    style: "",
    brand: "",
    origin: "",
    volume: b.volume || "",
    abv: 0,
    priceCny: typeof b.priceCny === "number" && isFinite(b.priceCny) ? b.priceCny : 0,
    notes: b.note || "",
    builtin: true,
    rating: null,
    sortIndex: null,
    createdAt: now + i,
    updatedAt: now + i,
  }));
}

/** 数据源自制分类 → PREP_TYPES key */
function mapPrepType(cat: string, nameEn: string): string {
  const n = nameEn.toLowerCase();
  if (/honey|rich|agave|maple/.test(n)) return "rich-syrup";
  if (/orgeat|almond/.test(n)) return "orgeat";
  if (/oleo/.test(n)) return "oleo";
  if (/cordial/.test(n)) return "cordial";
  if (/shrub/.test(n)) return "shrub";
  if (/juice/.test(n)) return "juice";
  if (/saline|solution|acid/.test(n)) return "solution";
  if (/infus/.test(n) || cat === "浸渍") return "infusion";
  if (/syrup/.test(n) || cat === "糖浆") return "syrup";
  return "other";
}

/** 构建自制库条目 */
export function buildWaldorfPreps(): HomemadePrep[] {
  const now = Date.now();
  return DATA.preps.map((p, i) => ({
    id: `waldorf-p-${i}`,
    name: p.nameEn,
    nameAlt: p.nameZh,
    type: mapPrepType(p.category, p.nameEn),
    abvGroup: null,
    ingredients: [],
    recipe: "",
    yield: "",
    shelfLife: "",
    storage: "",
    notes: p.note || "",
    builtin: true,
    made: false,
    rating: null,
    sortIndex: null,
    createdAt: now + i,
    updatedAt: now + i,
  }));
}
