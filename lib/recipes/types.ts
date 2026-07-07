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
  /** 配方故事:历史、来历、创作背景 */
  story: string;
  /** 风味描述:口感与风味的文字描述 */
  flavorDesc: string;
  ingredients: Ingredient[];
  steps: string;
  garnish: string;
  /** 注意事项(原 notes) */
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
    story: "",
    flavorDesc: "",
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
  base.story = r.story ?? "";
  base.flavorDesc = r.flavorDesc ?? "";
  return base;
}

export interface Category {
  id: string;
  name: string;
  /** 英文名(独立字段,按界面语言优先展示) */
  nameEn?: string;
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
  /** 英文名(独立字段,按界面语言优先展示) */
  nameEn?: string;
  color: string;
  /** 所属分组 id(可选,未分组时为空) */
  groupId?: string | null;
  createdAt: number;
}

/** 标签分组:每个标签种类下可自定义分组并排序 */
export interface TagGroup {
  id: string;
  kind: TagKind;
  name: string;
  /** 英文名(独立字段,按界面语言优先展示) */
  nameEn?: string;
  createdAt: number;
}

export const TAG_KIND_LABELS: Record<TagKind, string> = {
  spirit: "基酒",
  glass: "杯型",
  flavor: "风味",
};

/** 常用标签中英对照词典(zh -> en),用于自动补全译名与旧数据迁移 */
export const TAG_NAME_DICT: Record<string, string> = {
  // 基酒
  金酒: "Gin",
  朗姆: "Rum",
  朗姆酒: "Rum",
  伏特加: "Vodka",
  威士忌: "Whiskey",
  龙舌兰: "Tequila",
  白兰地: "Brandy",
  利口酒: "Liqueur",
  无酒精: "Non-Alcoholic",
  梅斯卡尔: "Mezcal",
  皮斯科: "Pisco",
  清酒: "Sake",
  烧酒: "Shochu",
  金巴利: "Campari",
  味美思: "Vermouth",
  苦艾酒: "Absinthe",
  雪莉酒: "Sherry",
  波特酒: "Port",
  香槟: "Champagne",
  其他: "Other",
  // 杯型
  马天尼杯: "Martini",
  古典杯: "Rocks",
  高球杯: "Highball",
  柯林杯: "Collins",
  库佩杯: "Coupe",
  飓风杯: "Hurricane",
  子弹杯: "Shot",
  尼克诺拉杯: "Nick & Nora",
  郁金香杯: "Tulip",
  笛型杯: "Flute",
  提基杯: "Tiki Mug",
  铜杯: "Copper Mug",
  红酒杯: "Wine Glass",
  朱莉普杯: "Julep Cup",
  // 风味
  草本: "Herbal",
  果味: "Fruity",
  柑橘: "Citrus",
  花香: "Floral",
  甜润: "Sweet",
  酸爽: "Sour",
  苦韵: "Bitter",
  辛香: "Spicy",
  烟熏: "Smoky",
  咸鲜: "Savory",
  清爽: "Refreshing",
  浓郁: "Rich",
  坚果: "Nutty",
  奶油: "Creamy",
  干爽: "Dry",
  热带: "Tropical",
  气泡: "Sparkling",
  焦糖: "Caramel",
  咖啡: "Coffee",
  巧克力: "Chocolate",
  // 分类
  经典: "Classic",
  自创: "Original",
  浓烈: "Strong",
  低度: "Low-ABV",
  餐前: "Aperitif",
  餐后: "Digestif",
  热饮: "Hot",
  提基: "Tiki",
};

/** 反向词典(en 小写 -> zh) */
const TAG_NAME_DICT_REV: Record<string, string> = Object.fromEntries(
  Object.entries(TAG_NAME_DICT).map(([zh, en]) => [en.toLowerCase(), zh]),
);

const hasCJK = (s: string) => /[\u4e00-\u9fff]/.test(s);

/**
 * 根据输入的名称自动补全另一语言译名。
 * 返回 { name(中文优先), nameEn }:输入中文查词典补英文;输入英文查反向词典补中文,
 * 查不到时中文侧回退为输入原文,保证 name 始终有值(name 是配方引用主键)。
 */
export function autoFillTagNames(input: string): { name: string; nameEn: string } {
  const raw = input.trim();
  if (!raw) return { name: "", nameEn: "" };
  if (hasCJK(raw)) {
    return { name: raw, nameEn: TAG_NAME_DICT[raw] ?? "" };
  }
  const zh = TAG_NAME_DICT_REV[raw.toLowerCase()];
  return zh ? { name: zh, nameEn: raw } : { name: raw, nameEn: raw };
}

/** 为旧标签数据补全英文名(仅当词典可查且 nameEn 为空) */
export function migrateTagNameEn<T extends { name: string; nameEn?: string }>(item: T): T {
  if (item.nameEn) return item;
  const en = TAG_NAME_DICT[item.name.trim()];
  if (en) return { ...item, nameEn: en };
  if (!hasCJK(item.name)) return { ...item, nameEn: item.name };
  return item;
}

/** 构建默认标签集合(首次启动时初始化,之后完全由用户管理) */
export function buildDefaultTags(): TagItem[] {
  const now = Date.now();
  let i = 0;
  const mk = (kind: TagKind, name: string, color: string): TagItem => ({
    id: `tag-${kind}-${i}`,
    kind,
    name,
    nameEn: TAG_NAME_DICT[name] ?? "",
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
  "#007AFF",
  "#FF3B30",
  "#34C759",
  "#5856D6",
  "#FF9500",
  "#AF52DE",
  "#00C7BE",
  "#FF2D55",
] as const;

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
