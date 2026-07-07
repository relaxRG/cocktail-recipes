// Homemade preps library: syrups, infusions, cordials, batches, etc.
// English-first design with Chinese translations.

export interface HomemadePrep {
  id: string;
  /** Primary display name (English-first) */
  name: string;
  /** Alt name / translation (e.g. Chinese) */
  nameAlt: string;
  /** Type key, see PREP_TYPES */
  type: string;
  /** Ingredient list, one per line or comma separated */
  ingredients: string[];
  /** Recipe / method free text */
  recipe: string;
  /** e.g. "~750ml" */
  yield: string;
  /** e.g. "2 weeks refrigerated" */
  shelfLife: string;
  /** e.g. "Refrigerate in sealed bottle" */
  storage: string;
  notes: string;
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Prep sections: group prep types by product family / process
 * (自制糖浆 / 自制利口酒 / 自制风味液体 / 自制酒 / 其他自制).
 */
export const PREP_SECTIONS: { key: string; en: string; zh: string }[] = [
  { key: "homemade-syrup", en: "Homemade Syrups", zh: "自制糖浆" },
  { key: "homemade-liqueur", en: "Homemade Liqueurs", zh: "自制利口酒" },
  { key: "flavored-liquid", en: "Flavored Liquids", zh: "自制风味液体" },
  { key: "homemade-spirit", en: "Homemade Spirits & Wines", zh: "自制酒" },
  { key: "misc", en: "Other Preps", zh: "其他自制" },
];

/** Prep types (English-first, with zh translation and section grouping) */
export const PREP_TYPES: { key: string; en: string; zh: string; section: string }[] = [
  // 自制糖浆 Homemade Syrups
  { key: "syrup", en: "Syrup", zh: "糖浆", section: "homemade-syrup" },
  { key: "cordial", en: "Cordial", zh: "康迪奥", section: "homemade-syrup" },
  { key: "shrub", en: "Shrub", zh: "果醋饮", section: "homemade-syrup" },
  // 自制利口酒 Homemade Liqueurs
  { key: "liqueur", en: "Liqueur", zh: "自制利口酒", section: "homemade-liqueur" },
  { key: "amaro", en: "Amaro / Bitter Liqueur", zh: "自制苦酒", section: "homemade-liqueur" },
  // 自制风味液体 Flavored Liquids
  { key: "infusion", en: "Infusion", zh: "浸渍", section: "flavored-liquid" },
  { key: "tincture", en: "Tincture", zh: "酊剂", section: "flavored-liquid" },
  { key: "bitters", en: "Bitters", zh: "自制苦精", section: "flavored-liquid" },
  { key: "solution", en: "Solution", zh: "溶液", section: "flavored-liquid" },
  { key: "juice", en: "Fresh Juice", zh: "鲜榨汁", section: "flavored-liquid" },
  // 自制酒 Homemade Spirits & Wines
  { key: "fermented", en: "Fermented / Brewed", zh: "自酿发酵", section: "homemade-spirit" },
  { key: "fortified", en: "Fortified / Aromatized", zh: "自制加强酒", section: "homemade-spirit" },
  { key: "redistilled", en: "Milk-Washed / Clarified", zh: "奶洗澄清", section: "homemade-spirit" },
  // 其他 Other Preps
  { key: "batch", en: "Batched Mix", zh: "预调批次", section: "misc" },
  { key: "garnish", en: "Garnish Prep", zh: "装饰预制", section: "misc" },
  { key: "other", en: "Other", zh: "其他", section: "misc" },
];

export function prepTypeLabel(key: string, lang: "zh" | "en"): string {
  const t = PREP_TYPES.find((p) => p.key === key);
  if (!t) return key;
  return lang === "en" ? t.en : t.zh;
}

/** Resolve the section key for a prep type (defaults to "misc") */
export function prepSectionOf(typeKey: string): string {
  return PREP_TYPES.find((p) => p.key === typeKey)?.section ?? "misc";
}

export function prepSectionLabel(sectionKey: string, lang: "zh" | "en"): string {
  const s = PREP_SECTIONS.find((x) => x.key === sectionKey);
  if (!s) return sectionKey;
  return lang === "en" ? s.en : s.zh;
}

export function normalizePrep(p: Partial<HomemadePrep> & { id: string }): HomemadePrep {
  return {
    id: p.id,
    name: p.name ?? "",
    nameAlt: p.nameAlt ?? "",
    type: p.type ?? "other",
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
    recipe: p.recipe ?? "",
    yield: p.yield ?? "",
    shelfLife: p.shelfLife ?? "",
    storage: p.storage ?? "",
    notes: p.notes ?? "",
    builtin: p.builtin ?? false,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
  };
}

/**
 * Split a stored ingredient line like "200g white sugar 白砂糖" into
 * { amount: "200g", name: "white sugar 白砂糖" } for structured editing.
 * Lines without a leading quantity return an empty amount.
 */
const LEADING_QTY_RE =
  /^((?:约|~|≈)?\s*\d+(?:[.\/]\d+)?(?:\s*[-–]\s*\d+(?:[.\/]\d+)?)?\s*(?:kg|g|克|千克|公斤|ml|毫升|l|升|oz|盎司|dash(?:es)?|滴|tsp|茶匙|tbsp|汤匙|bar\s?spoons?|吧勺|cups?|杯|drops?|个|枚|颗|粒|根|片|只|条|瓣|把|包|袋|听|罐|瓶)?\.?)\s+(.+)$/i;

export function splitPrepIngredientLine(line: string): { amount: string; name: string } {
  const trimmed = line.trim();
  if (!trimmed) return { amount: "", name: "" };
  const m = trimmed.match(LEADING_QTY_RE);
  if (m && m[2]) {
    return { amount: m[1].trim(), name: m[2].trim() };
  }
  return { amount: "", name: trimmed };
}

/** Re-join a structured ingredient row into the stored line format. */
export function joinPrepIngredient(amount: string, name: string): string {
  const a = amount.trim();
  const n = name.trim();
  if (a && n) return `${a} ${n}`;
  return a || n;
}
