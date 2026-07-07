/** 酒款分类 */
export const BOTTLE_CATEGORIES = [
  "金酒",
  "朗姆",
  "伏特加",
  "威士忌",
  "龙舌兰",
  "白兰地",
  "利口酒",
  "苦精",
  "味美思",
  "开胃酒",
  "起泡酒",
  "葡萄酒",
  "清酒烧酒",
  "中式白酒",
  "软饮糖浆",
  "其他",
] as const;
export type BottleCategory = (typeof BOTTLE_CATEGORIES)[number];

/** 酒款分类英文映射(界面语言为英文时显示) */
export const BOTTLE_CATEGORY_EN: Record<string, string> = {
  金酒: "Gin",
  朗姆: "Rum",
  伏特加: "Vodka",
  威士忌: "Whisky",
  龙舌兰: "Agave",
  白兰地: "Brandy",
  利口酒: "Liqueur",
  苦精: "Bitters",
  味美思: "Vermouth",
  开胃酒: "Aperitif/Amaro",
  起泡酒: "Sparkling",
  葡萄酒: "Wine",
  清酒烧酒: "Sake/Shochu",
  中式白酒: "Baijiu",
  软饮糖浆: "Mixers/Syrups",
  其他: "Others",
};

/** 酒款(酒类数据库条目) */
export interface Bottle {
  id: string;
  /** 中文名 */
  nameZh: string;
  /** 英文名 */
  nameEn: string;
  /** 分类 */
  category: string;
  /** 品牌 */
  brand: string;
  /** 产地 */
  origin: string;
  /** 规格,如 "700ml" */
  volume: string;
  /** 酒精度数(% ABV),如 40 */
  abv: number;
  /** 中国市场参考价(人民币),0 表示未知 */
  priceCny: number;
  /** 备注 */
  notes: string;
  /** 是否内置数据(内置数据也可编辑/删除) */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 兼容处理:为缺字段的酒款补默认值 */
export function normalizeBottle(b: Partial<Bottle> & Pick<Bottle, "id" | "nameZh">): Bottle {
  return {
    nameEn: "",
    category: "其他",
    brand: "",
    origin: "",
    volume: "",
    abv: 0,
    priceCny: 0,
    notes: "",
    builtin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...b,
  };
}
