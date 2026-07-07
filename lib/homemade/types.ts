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
