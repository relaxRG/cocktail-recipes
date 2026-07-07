import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * 酒库自定义分类体系(大分类 + 风格子分类)。
 * 参考资料见 docs/research-bottle-taxonomy.md:
 * - 六大基酒(TTB/Webstaurant):Gin/Vodka/Rum/Whiskey/Agave/Brandy
 * - Modifiers 五类(Mad River/Breakthru):Vermouth/Herbal Liqueurs/Amaro/Bitters/Fruit Liqueurs
 * - Fortified wine 家族(Wikipedia):Port/Sherry/Madeira/Marsala
 * - Bitters 细分(PUNCH):Aromatic/Orange/Citrus/Spice-Mole/Tiki/Celery/Fruit
 * 分类与风格均可自由添加/删除/改名/排序;Bottle.category 与 Bottle.style
 * 仍存储中文分类名与风格名字符串,保证旧数据兼容。
 */

export interface BottleCategoryDef {
  /** 稳定 id */
  id: string;
  /** 中文名 = Bottle.category 存储值 */
  zh: string;
  /** 英文名(界面英文时优先显示) */
  en: string;
  /** 顶层分组:酒款库 / 原材料库 */
  group: "bottles" | "materials";
}

export interface BottleStyleDef {
  /** 稳定 id */
  id: string;
  /** 风格名(English-first,= Bottle.style 存储值) */
  name: string;
  /** 中文说明名(可选) */
  zh: string;
  /** 所属分类的 zh 名 */
  category: string;
}

/** 专业默认大分类体系(zh 为存储值) */
export const DEFAULT_BOTTLE_CATEGORY_DEFS: Omit<BottleCategoryDef, "id">[] = [
  // 六大基酒 Base Spirits
  { zh: "金酒", en: "Gin", group: "bottles" },
  { zh: "伏特加", en: "Vodka", group: "bottles" },
  { zh: "朗姆", en: "Rum", group: "bottles" },
  { zh: "威士忌", en: "Whiskey", group: "bottles" },
  { zh: "龙舌兰", en: "Agave Spirits", group: "bottles" },
  { zh: "白兰地", en: "Brandy", group: "bottles" },
  // 其他烈酒 Other Spirits
  { zh: "清酒烧酒", en: "Sake & Shochu", group: "bottles" },
  { zh: "中式白酒", en: "Baijiu", group: "bottles" },
  // Modifiers
  { zh: "利口酒", en: "Liqueurs", group: "bottles" },
  { zh: "味美思", en: "Vermouth", group: "bottles" },
  { zh: "阿玛罗与开胃酒", en: "Amaro & Aperitivo", group: "bottles" },
  { zh: "苦精", en: "Bitters", group: "bottles" },
  { zh: "加强酒", en: "Fortified Wine", group: "bottles" },
  // Wine & Sparkling
  { zh: "起泡酒", en: "Sparkling Wine", group: "bottles" },
  { zh: "葡萄酒", en: "Wine", group: "bottles" },
  // Non-alcoholic mixers
  { zh: "果汁", en: "Juice", group: "bottles" },
  { zh: "软饮", en: "Soft Drinks & Mixers", group: "bottles" },
  { zh: "糖浆", en: "Syrups & Cordials", group: "bottles" },
  // Raw materials
  { zh: "原材料", en: "Raw Materials", group: "materials" },
  { zh: "其他", en: "Others", group: "bottles" },
];

/** 专业默认风格子分类体系(name 为存储值,English-first) */
export const DEFAULT_BOTTLE_STYLE_DEFS: Omit<BottleStyleDef, "id">[] = [
  // 金酒 Gin(Liquor.com gin types)
  { name: "London Dry", zh: "伦敦干金", category: "金酒" },
  { name: "Plymouth", zh: "普利茅斯", category: "金酒" },
  { name: "Old Tom", zh: "老汤姆", category: "金酒" },
  { name: "Navy Strength", zh: "海军强度", category: "金酒" },
  { name: "Contemporary / New Western", zh: "当代风格", category: "金酒" },
  { name: "Genever", zh: "荷兰金酒", category: "金酒" },
  { name: "Aged Gin", zh: "陈酿金酒", category: "金酒" },
  { name: "Sloe & Flavored Gin", zh: "黑刺李/风味金酒", category: "金酒" },
  // 伏特加 Vodka
  { name: "Wheat", zh: "小麦", category: "伏特加" },
  { name: "Rye", zh: "黑麦", category: "伏特加" },
  { name: "Potato", zh: "土豆", category: "伏特加" },
  { name: "Grape / Fruit", zh: "葡萄/水果", category: "伏特加" },
  { name: "Flavored", zh: "风味伏特加", category: "伏特加" },
  // 朗姆 Rum
  { name: "White / Light", zh: "白朗姆", category: "朗姆" },
  { name: "Gold", zh: "金朗姆", category: "朗姆" },
  { name: "Aged / Añejo", zh: "陈酿朗姆", category: "朗姆" },
  { name: "Dark / Black", zh: "黑朗姆", category: "朗姆" },
  { name: "Jamaican Pot Still", zh: "牙买加壶式", category: "朗姆" },
  { name: "Demerara", zh: "德梅拉拉", category: "朗姆" },
  { name: "Rhum Agricole Blanc", zh: "农业朗姆(白)", category: "朗姆" },
  { name: "Rhum Agricole Ambré", zh: "农业朗姆(琥珀)", category: "朗姆" },
  { name: "Cachaça", zh: "卡莎萨", category: "朗姆" },
  { name: "Overproof", zh: "高度朗姆", category: "朗姆" },
  { name: "Spiced", zh: "香料朗姆", category: "朗姆" },
  // 威士忌 Whiskey
  { name: "Bourbon", zh: "波本", category: "威士忌" },
  { name: "Rye Whiskey", zh: "黑麦威士忌", category: "威士忌" },
  { name: "Tennessee", zh: "田纳西", category: "威士忌" },
  { name: "Scotch Single Malt", zh: "苏格兰单一麦芽", category: "威士忌" },
  { name: "Islay Single Malt", zh: "艾雷岛单一麦芽", category: "威士忌" },
  { name: "Scotch Blended", zh: "苏格兰调和", category: "威士忌" },
  { name: "Irish", zh: "爱尔兰", category: "威士忌" },
  { name: "Japanese", zh: "日本", category: "威士忌" },
  { name: "Canadian", zh: "加拿大", category: "威士忌" },
  { name: "American Single Malt", zh: "美国单一麦芽", category: "威士忌" },
  // 龙舌兰与阿加维 Agave(Webstaurant tequila types + mezcal)
  { name: "Tequila Blanco", zh: "特其拉(银)", category: "龙舌兰" },
  { name: "Tequila Joven", zh: "特其拉(金)", category: "龙舌兰" },
  { name: "Tequila Reposado", zh: "特其拉(微陈)", category: "龙舌兰" },
  { name: "Tequila Añejo", zh: "特其拉(陈酿)", category: "龙舌兰" },
  { name: "Tequila Extra Añejo", zh: "特其拉(特陈)", category: "龙舌兰" },
  { name: "Tequila Cristalino", zh: "特其拉(透明陈酿)", category: "龙舌兰" },
  { name: "Mezcal Joven", zh: "梅斯卡尔(新酒)", category: "龙舌兰" },
  { name: "Mezcal Reposado", zh: "梅斯卡尔(微陈)", category: "龙舌兰" },
  { name: "Raicilla", zh: "拉伊西亚", category: "龙舌兰" },
  { name: "Sotol", zh: "索托尔", category: "龙舌兰" },
  { name: "Bacanora", zh: "巴卡诺拉", category: "龙舌兰" },
  // 白兰地 Brandy
  { name: "Cognac VS", zh: "干邑VS", category: "白兰地" },
  { name: "Cognac VSOP", zh: "干邑VSOP", category: "白兰地" },
  { name: "Cognac XO", zh: "干邑XO", category: "白兰地" },
  { name: "Armagnac", zh: "雅文邑", category: "白兰地" },
  { name: "Calvados", zh: "卡尔瓦多斯", category: "白兰地" },
  { name: "Apple Brandy / Applejack", zh: "苹果白兰地", category: "白兰地" },
  { name: "Pisco", zh: "皮斯科", category: "白兰地" },
  { name: "Grappa / Pomace", zh: "格拉帕", category: "白兰地" },
  { name: "Eau-de-Vie / Fruit Brandy", zh: "水果白兰地", category: "白兰地" },
  { name: "Spanish Brandy", zh: "西班牙白兰地", category: "白兰地" },
  // 清酒烧酒 Sake & Shochu
  { name: "Junmai", zh: "纯米", category: "清酒烧酒" },
  { name: "Junmai Ginjo", zh: "纯米吟酿", category: "清酒烧酒" },
  { name: "Junmai Daiginjo", zh: "纯米大吟酿", category: "清酒烧酒" },
  { name: "Nigori", zh: "浊酒", category: "清酒烧酒" },
  { name: "Umeshu", zh: "梅酒", category: "清酒烧酒" },
  { name: "Mugi Shochu", zh: "麦烧酒", category: "清酒烧酒" },
  { name: "Imo Shochu", zh: "芋烧酒", category: "清酒烧酒" },
  { name: "Kome Shochu", zh: "米烧酒", category: "清酒烧酒" },
  { name: "Soju", zh: "韩国烧酒", category: "清酒烧酒" },
  // 中式白酒 Baijiu
  { name: "Sauce Aroma", zh: "酱香", category: "中式白酒" },
  { name: "Strong Aroma", zh: "浓香", category: "中式白酒" },
  { name: "Light Aroma", zh: "清香", category: "中式白酒" },
  { name: "Rice Aroma", zh: "米香", category: "中式白酒" },
  // 利口酒 Liqueurs(Mad River modifiers: herbal/fruit-infused 等)
  { name: "Orange / Triple Sec", zh: "橙皮利口酒", category: "利口酒" },
  { name: "Herbal / Spiced", zh: "草本香料", category: "利口酒" },
  { name: "Anise / Absinthe", zh: "茴香/苦艾", category: "利口酒" },
  { name: "Fruit", zh: "水果利口酒", category: "利口酒" },
  { name: "Cherry / Maraschino", zh: "樱桃利口酒", category: "利口酒" },
  { name: "Coffee", zh: "咖啡利口酒", category: "利口酒" },
  { name: "Cream", zh: "奶油利口酒", category: "利口酒" },
  { name: "Nut", zh: "坚果利口酒", category: "利口酒" },
  { name: "Floral", zh: "花香利口酒", category: "利口酒" },
  // 味美思 Vermouth(Liquor.com vermouth types)
  { name: "Dry Vermouth", zh: "干味美思", category: "味美思" },
  { name: "Sweet / Rosso", zh: "甜红味美思", category: "味美思" },
  { name: "Blanc / Bianco", zh: "白甜味美思", category: "味美思" },
  { name: "Rosé / Ambrato", zh: "粉红/琥珀", category: "味美思" },
  { name: "Quinquina / Americano", zh: "奎宁开胃酒", category: "味美思" },
  // 阿玛罗与开胃酒 Amaro & Aperitivo(Liquor.com amaro guide)
  { name: "Aperitivo", zh: "开胃苦酒", category: "阿玛罗与开胃酒" },
  { name: "Amaro Leggero", zh: "轻苦阿玛罗", category: "阿玛罗与开胃酒" },
  { name: "Amaro Medio", zh: "中苦阿玛罗", category: "阿玛罗与开胃酒" },
  { name: "Amaro Denso", zh: "浓苦阿玛罗", category: "阿玛罗与开胃酒" },
  { name: "Fernet", zh: "菲奈特", category: "阿玛罗与开胃酒" },
  { name: "Alpine", zh: "阿尔卑斯草本", category: "阿玛罗与开胃酒" },
  { name: "Carciofo / Rabarbaro", zh: "洋蓟/大黄", category: "阿玛罗与开胃酒" },
  { name: "Gentian", zh: "龙胆", category: "阿玛罗与开胃酒" },
  // 苦精 Bitters(PUNCH essential guide)
  { name: "Aromatic", zh: "芳香苦精", category: "苦精" },
  { name: "Orange", zh: "橙味苦精", category: "苦精" },
  { name: "Citrus", zh: "柑橘苦精", category: "苦精" },
  { name: "Spice / Mole", zh: "香料/莫雷", category: "苦精" },
  { name: "Tiki", zh: "提基苦精", category: "苦精" },
  { name: "Celery / Savory", zh: "芹菜/咸鲜", category: "苦精" },
  { name: "Fruit / Floral", zh: "果味/花香", category: "苦精" },
  // 加强酒 Fortified Wine(Wikipedia fortified wine)
  { name: "Sherry Fino / Manzanilla", zh: "雪莉(菲诺)", category: "加强酒" },
  { name: "Sherry Amontillado", zh: "雪莉(阿蒙提亚多)", category: "加强酒" },
  { name: "Sherry Oloroso", zh: "雪莉(欧罗索)", category: "加强酒" },
  { name: "Sherry PX", zh: "雪莉(PX)", category: "加强酒" },
  { name: "Port Ruby", zh: "波特(宝石红)", category: "加强酒" },
  { name: "Port Tawny", zh: "波特(茶色)", category: "加强酒" },
  { name: "Madeira", zh: "马德拉", category: "加强酒" },
  { name: "Marsala", zh: "马沙拉", category: "加强酒" },
  // 起泡酒 Sparkling
  { name: "Champagne", zh: "香槟", category: "起泡酒" },
  { name: "Prosecco", zh: "普罗塞克", category: "起泡酒" },
  { name: "Cava", zh: "卡瓦", category: "起泡酒" },
  { name: "Crémant", zh: "克雷芒", category: "起泡酒" },
  { name: "Pét-Nat", zh: "自然起泡", category: "起泡酒" },
  // 葡萄酒 Wine
  { name: "Dry White", zh: "干白", category: "葡萄酒" },
  { name: "Dry Red", zh: "干红", category: "葡萄酒" },
  { name: "Rosé", zh: "桃红", category: "葡萄酒" },
  { name: "Sweet / Sauternes", zh: "甜白", category: "葡萄酒" },
  // 果汁 Juice
  { name: "Citrus Juice", zh: "柑橘汁", category: "果汁" },
  { name: "Tropical Juice", zh: "热带果汁", category: "果汁" },
  { name: "Berry Juice", zh: "莓果汁", category: "果汁" },
  { name: "Vegetable Juice", zh: "蔬菜汁", category: "果汁" },
  // 软饮 Soft Drinks & Mixers
  { name: "Soda Water", zh: "苏打水", category: "软饮" },
  { name: "Tonic Water", zh: "汤力水", category: "软饮" },
  { name: "Ginger Beer", zh: "姜汁啤酒", category: "软饮" },
  { name: "Ginger Ale", zh: "干姜水", category: "软饮" },
  { name: "Cola & Soft Drinks", zh: "可乐/汽水", category: "软饮" },
  { name: "Sparkling Water", zh: "气泡水", category: "软饮" },
  // 糖浆 Syrups & Cordials
  { name: "Simple Syrup", zh: "基础糖浆", category: "糖浆" },
  { name: "Flavored Syrup", zh: "风味糖浆", category: "糖浆" },
  { name: "Cordial", zh: "康迪奥", category: "糖浆" },
  { name: "Shrub", zh: "果醋饮", category: "糖浆" },
  { name: "Cream / Foam", zh: "奶油/泡沫", category: "糖浆" },
  // 原材料 Raw Materials
  { name: "Sugar & Sweetener", zh: "糖与甜味剂", category: "原材料" },
  { name: "Fruit & Citrus", zh: "水果柑橘", category: "原材料" },
  { name: "Spice & Botanical", zh: "香料草本", category: "原材料" },
  { name: "Nut / Tea / Coffee", zh: "坚果茶咖", category: "原材料" },
  { name: "Dairy & Egg", zh: "乳制品蛋类", category: "原材料" },
  { name: "Acid & Additive", zh: "酸剂添加剂", category: "原材料" },
  { name: "Herb", zh: "新鲜香草", category: "原材料" },
];

const CATS_KEY = "bottles.taxonomy.categories.v1";
const STYLES_KEY = "bottles.taxonomy.styles.v1";

function buildDefaultCategories(): BottleCategoryDef[] {
  return DEFAULT_BOTTLE_CATEGORY_DEFS.map((c, i) => ({ id: `bcat-${i}`, ...c }));
}

function buildDefaultStyles(): BottleStyleDef[] {
  return DEFAULT_BOTTLE_STYLE_DEFS.map((s, i) => ({ id: `bsty-${i}`, ...s }));
}

interface BottleTaxonomyStore {
  ready: boolean;
  categories: BottleCategoryDef[];
  styles: BottleStyleDef[];
  addCategory: (zh: string, en: string, group: "bottles" | "materials") => BottleCategoryDef | null;
  renameCategory: (id: string, zh: string, en: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
  addStyle: (category: string, name: string, zh?: string) => BottleStyleDef | null;
  renameStyle: (id: string, name: string, zh: string) => void;
  deleteStyle: (id: string) => void;
  reorderStyles: (orderedIds: string[]) => void;
  /** 分类显示名(界面语言) */
  categoryLabel: (zhName: string, lang: "zh" | "en") => string;
  /** 某分类下的风格列表 */
  stylesOf: (categoryZh: string) => BottleStyleDef[];
  /** 分组下的分类 zh 名列表 */
  categoriesOfGroup: (group: "bottles" | "materials") => string[];
  groupOf: (categoryZh: string) => "bottles" | "materials";
}

const Ctx = createContext<BottleTaxonomyStore | null>(null);

export function BottleTaxonomyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<BottleCategoryDef[]>(buildDefaultCategories());
  const [styles, setStyles] = useState<BottleStyleDef[]>(buildDefaultStyles());

  useEffect(() => {
    (async () => {
      try {
        const [rawC, rawS] = await Promise.all([
          AsyncStorage.getItem(CATS_KEY),
          AsyncStorage.getItem(STYLES_KEY),
        ]);
        if (rawC) setCategories(JSON.parse(rawC));
        if (rawS) setStyles(JSON.parse(rawS));
      } catch (e) {
        console.warn("Failed to load bottle taxonomy", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const catsRef = useRef(categories);
  catsRef.current = categories;
  const stylesRef = useRef(styles);
  stylesRef.current = styles;

  const persistCats = useCallback((next: BottleCategoryDef[]) => {
    setCategories(next);
    AsyncStorage.setItem(CATS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const persistStyles = useCallback((next: BottleStyleDef[]) => {
    setStyles(next);
    AsyncStorage.setItem(STYLES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addCategory = useCallback(
    (zh: string, en: string, group: "bottles" | "materials"): BottleCategoryDef | null => {
      const z = zh.trim();
      if (!z) return null;
      if (catsRef.current.some((c) => c.zh === z)) return null;
      const def: BottleCategoryDef = {
        id: `bcat-u-${Date.now().toString(36)}`,
        zh: z,
        en: en.trim() || z,
        group,
      };
      // 新分类插入到"其他"之前(若存在)
      const list = [...catsRef.current];
      const otherIdx = list.findIndex((c) => c.zh === "其他");
      if (otherIdx >= 0) list.splice(otherIdx, 0, def);
      else list.push(def);
      persistCats(list);
      return def;
    },
    [persistCats],
  );

  const renameCategory = useCallback(
    (id: string, zh: string, en: string) => {
      const target = catsRef.current.find((c) => c.id === id);
      if (!target) return;
      const z = zh.trim() || target.zh;
      persistCats(
        catsRef.current.map((c) => (c.id === id ? { ...c, zh: z, en: en.trim() || z } : c)),
      );
      // 同步风格表中的分类名
      if (z !== target.zh) {
        persistStyles(
          stylesRef.current.map((s) => (s.category === target.zh ? { ...s, category: z } : s)),
        );
      }
    },
    [persistCats, persistStyles],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const target = catsRef.current.find((c) => c.id === id);
      if (!target) return;
      persistCats(catsRef.current.filter((c) => c.id !== id));
      persistStyles(stylesRef.current.filter((s) => s.category !== target.zh));
    },
    [persistCats, persistStyles],
  );

  const reorderCategories = useCallback(
    (orderedIds: string[]) => {
      const map = new Map(catsRef.current.map((c) => [c.id, c]));
      const next = orderedIds.map((id) => map.get(id)).filter(Boolean) as BottleCategoryDef[];
      for (const c of catsRef.current) if (!orderedIds.includes(c.id)) next.push(c);
      persistCats(next);
    },
    [persistCats],
  );

  const addStyle = useCallback(
    (category: string, name: string, zh = ""): BottleStyleDef | null => {
      const n = name.trim();
      if (!n) return null;
      if (stylesRef.current.some((s) => s.category === category && s.name === n)) return null;
      const def: BottleStyleDef = {
        id: `bsty-u-${Date.now().toString(36)}`,
        name: n,
        zh: zh.trim(),
        category,
      };
      persistStyles([...stylesRef.current, def]);
      return def;
    },
    [persistStyles],
  );

  const renameStyle = useCallback(
    (id: string, name: string, zh: string) => {
      persistStyles(
        stylesRef.current.map((s) =>
          s.id === id ? { ...s, name: name.trim() || s.name, zh: zh.trim() } : s,
        ),
      );
    },
    [persistStyles],
  );

  const deleteStyle = useCallback(
    (id: string) => {
      persistStyles(stylesRef.current.filter((s) => s.id !== id));
    },
    [persistStyles],
  );

  const reorderStyles = useCallback(
    (orderedIds: string[]) => {
      const map = new Map(stylesRef.current.map((s) => [s.id, s]));
      const next = orderedIds.map((id) => map.get(id)).filter(Boolean) as BottleStyleDef[];
      for (const s of stylesRef.current) if (!orderedIds.includes(s.id)) next.push(s);
      persistStyles(next);
    },
    [persistStyles],
  );

  const categoryLabel = useCallback(
    (zhName: string, lang: "zh" | "en") => {
      if (lang === "zh") return zhName;
      return categories.find((c) => c.zh === zhName)?.en ?? zhName;
    },
    [categories],
  );

  const stylesOf = useCallback(
    (categoryZh: string) => styles.filter((s) => s.category === categoryZh),
    [styles],
  );

  const categoriesOfGroup = useCallback(
    (group: "bottles" | "materials") =>
      categories.filter((c) => c.group === group).map((c) => c.zh),
    [categories],
  );

  const groupOf = useCallback(
    (categoryZh: string) =>
      categories.find((c) => c.zh === categoryZh)?.group ??
      (categoryZh === "原材料" ? "materials" : "bottles"),
    [categories],
  );

  const value = useMemo<BottleTaxonomyStore>(
    () => ({
      ready,
      categories,
      styles,
      addCategory,
      renameCategory,
      deleteCategory,
      reorderCategories,
      addStyle,
      renameStyle,
      deleteStyle,
      reorderStyles,
      categoryLabel,
      stylesOf,
      categoriesOfGroup,
      groupOf,
    }),
    [
      ready,
      categories,
      styles,
      addCategory,
      renameCategory,
      deleteCategory,
      reorderCategories,
      addStyle,
      renameStyle,
      deleteStyle,
      reorderStyles,
      categoryLabel,
      stylesOf,
      categoriesOfGroup,
      groupOf,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBottleTaxonomy(): BottleTaxonomyStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBottleTaxonomy must be used within BottleTaxonomyProvider");
  return ctx;
}

/** 旧分类名 → 新分类名迁移映射(v6) */
export const CATEGORY_MIGRATION_V6: Record<string, string> = {
  开胃酒: "阿玛罗与开胃酒",
};
