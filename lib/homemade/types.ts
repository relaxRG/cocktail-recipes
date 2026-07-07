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

/** Prep types (English-first, with zh translation for UI) */
export const PREP_TYPES: { key: string; en: string; zh: string }[] = [
  { key: "syrup", en: "Syrup", zh: "糖浆" },
  { key: "infusion", en: "Infusion", zh: "浸渍" },
  { key: "cordial", en: "Cordial", zh: "康迪奥" },
  { key: "shrub", en: "Shrub", zh: "果醋饮" },
  { key: "tincture", en: "Tincture", zh: "酊剂" },
  { key: "batch", en: "Batched Mix", zh: "预调批次" },
  { key: "juice", en: "Fresh Juice", zh: "鲜榨汁" },
  { key: "solution", en: "Solution", zh: "溶液" },
  { key: "garnish", en: "Garnish Prep", zh: "装饰预制" },
  { key: "other", en: "Other", zh: "其他" },
];

export function prepTypeLabel(key: string, lang: "zh" | "en"): string {
  const t = PREP_TYPES.find((p) => p.key === key);
  if (!t) return key;
  return lang === "en" ? t.en : t.zh;
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
