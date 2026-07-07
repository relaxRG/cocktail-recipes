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

/**
 * Cocktail Codex 风格子分类建议(英文优先)。
 * 按分类给出常见 style,表单中可快速选择,也允许自由填写。
 */
export const BOTTLE_STYLES: Record<string, string[]> = {
  金酒: ["London Dry", "Plymouth", "Old Tom", "Genever", "Contemporary", "Navy Strength", "Sloe Gin"],
  朗姆: ["Spanish Style (Blanco)", "Spanish Style (Añejo)", "English Style (Jamaican)", "English Style (Demerara)", "French Style (Agricole Blanc)", "French Style (Agricole Ambre)", "Overproof", "Black Rum", "Spiced Rum", "Cachaça"],
  伏特加: ["Wheat", "Rye", "Potato", "Corn", "Grape", "Flavored"],
  威士忌: ["Bourbon", "Rye", "Tennessee", "Scotch Blended", "Scotch Single Malt", "Islay Single Malt", "Irish", "Japanese", "Canadian"],
  龙舌兰: ["Tequila Blanco", "Tequila Reposado", "Tequila Añejo", "Mezcal Joven", "Mezcal Reposado", "Sotol", "Raicilla"],
  白兰地: ["Cognac VS", "Cognac VSOP", "Cognac XO", "Armagnac", "Calvados", "Pisco", "Apple Brandy", "Grappa", "Eau de Vie"],
  利口酒: ["Orange Liqueur", "Cherry Liqueur", "Coffee Liqueur", "Herbal Liqueur", "Amaro", "Cream Liqueur", "Nut Liqueur", "Fruit Liqueur", "Floral Liqueur", "Anise Liqueur"],
  苦精: ["Aromatic", "Orange", "Celery", "Chocolate", "Peach", "Tiki"],
  味美思: ["Dry Vermouth", "Blanc/Bianco", "Sweet Vermouth", "Ambrato", "Quinquina", "Americano"],
  开胃酒: ["Aperitivo", "Amaro Leggero", "Amaro Medio", "Amaro Denso", "Fernet", "Gentian"],
  起泡酒: ["Champagne", "Prosecco", "Cava", "Crémant", "Pét-Nat"],
  葡萄酒: ["Dry White", "Dry Red", "Sherry Fino", "Sherry Oloroso", "Sherry PX", "Port", "Madeira", "Sauternes"],
  清酒烧酒: ["Junmai", "Junmai Ginjo", "Junmai Daiginjo", "Nigori", "Umeshu", "Mugi Shochu", "Imo Shochu", "Kome Shochu", "Soju"],
  中式白酒: ["Sauce Aroma 酱香", "Strong Aroma 浓香", "Light Aroma 清香", "Rice Aroma 米香"],
  软饮糖浆: ["Syrup", "Juice", "Soda", "Tonic", "Ginger Beer", "Cordial", "Shrub"],
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
  /** 风格子分类(Cocktail Codex 风格,如 "London Dry" / "Bourbon"),可为空 */
  style: string;
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
    style: "",
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
