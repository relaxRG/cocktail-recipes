export interface Ingredient {
  id: string;
  name: string;
  amount: string;
}

export type Strength = "light" | "medium" | "strong";

/** Cocktail Codex 六大根源分类 */
export const CODEX_FAMILIES = [
  "古典 Old-Fashioned",
  "马天尼 Martini",
  "大吉利 Daiquiri",
  "边车 Sidecar",
  "高球 Highball",
  "菲兹 Flip",
] as const;
export type CodexFamily = (typeof CODEX_FAMILIES)[number];

/** 风味标签(可多选) */
export const FLAVOR_TAGS = [
  "草本",
  "果味",
  "柑橘",
  "花香",
  "甜润",
  "酸爽",
  "苦韵",
  "辛香",
  "烟熏",
  "咸鲜",
] as const;

export interface Recipe {
  id: string;
  name: string;
  categoryId: string | null;
  baseSpirit: string;
  glass: string;
  method: string;
  strength: Strength;
  /** 是哪款经典鸡尾酒的变体,如"尼格罗尼";空字符串表示非变体 */
  variantOf: string;
  /** Cocktail Codex 六大根源分类,空字符串表示未选择 */
  codexFamily: string;
  /** 风味标签,多选 */
  flavors: string[];
  /** 引用来源:书籍、网站、调酒师等,如"Cocktail Codex, p.120" */
  source: string;
  ingredients: Ingredient[];
  steps: string;
  garnish: string;
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 兼容旧数据:为缺少新字段的配方补默认值 */
export function normalizeRecipe(r: Partial<Recipe> & Pick<Recipe, "id" | "name">): Recipe {
  const base: Recipe = {
    categoryId: null,
    baseSpirit: "其他",
    glass: "",
    method: "",
    strength: "medium",
    variantOf: "",
    codexFamily: "",
    flavors: [],
    source: "",
    ingredients: [],
    steps: "",
    garnish: "",
    notes: "",
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...r,
  };
  base.variantOf = r.variantOf ?? "";
  base.codexFamily = r.codexFamily ?? "";
  base.flavors = Array.isArray(r.flavors) ? r.flavors : [];
  base.source = r.source ?? "";
  return base;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

/** 可自定义标签的种类:基酒 / 杯型 / 风味 */
export type TagKind = "spirit" | "glass" | "flavor";

/** 通用自定义标签(基酒、杯型、风味) */
export interface TagItem {
  id: string;
  kind: TagKind;
  name: string;
  color: string;
  createdAt: number;
}

export const TAG_KIND_LABELS: Record<TagKind, string> = {
  spirit: "基酒",
  glass: "杯型",
  flavor: "风味",
};

/** 构建默认标签集合(首次启动时初始化,之后完全由用户管理) */
export function buildDefaultTags(): TagItem[] {
  const now = Date.now();
  let i = 0;
  const mk = (kind: TagKind, name: string, color: string): TagItem => ({
    id: `tag-${kind}-${i}`,
    kind,
    name,
    color,
    createdAt: now + i++,
  });
  return [
    ...BASE_SPIRITS.map((n, idx) =>
      mk("spirit", n, CATEGORY_COLORS[idx % CATEGORY_COLORS.length]),
    ),
    ...GLASSES.map((n, idx) =>
      mk("glass", n, CATEGORY_COLORS[(idx + 3) % CATEGORY_COLORS.length]),
    ),
    ...FLAVOR_TAGS.map((n, idx) =>
      mk("flavor", n, CATEGORY_COLORS[(idx + 5) % CATEGORY_COLORS.length]),
    ),
  ];
}

export const BASE_SPIRITS = [
  "金酒",
  "朗姆",
  "伏特加",
  "威士忌",
  "龙舌兰",
  "白兰地",
  "利口酒",
  "无酒精",
  "其他",
] as const;

export const METHODS = ["摇和", "搅拌", "直调", "分层", "搅打"] as const;

export const GLASSES = [
  "马天尼杯",
  "古典杯",
  "高球杯",
  "柯林杯",
  "库佩杯",
  "飓风杯",
  "子弹杯",
  "其他",
] as const;

export const STRENGTH_LABELS: Record<Strength, string> = {
  light: "轻盈",
  medium: "适中",
  strong: "浓烈",
};

export const CATEGORY_COLORS = [
  "#C0841A",
  "#B0413E",
  "#3E7A5E",
  "#3D6B9E",
  "#7B5EA7",
  "#C26A3D",
  "#8A8A3D",
  "#B04E7F",
] as const;

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
