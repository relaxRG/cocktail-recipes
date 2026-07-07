import { Ingredient, genId } from "./types";

/** 解析结果:与表单字段对应,均为可选 */
export interface ParsedRecipe {
  name: string;
  ingredients: Ingredient[];
  steps: string;
  glass: string;
  method: string;
  garnish: string;
  baseSpirit: string;
  variantOf: string;
  source: string;
}

/** 常见分节标题 */
const SECTION_PATTERNS: { key: keyof typeof SECTION_KEYS; re: RegExp }[] = [
  { key: "ingredients", re: /^(配料|材料|成分|原料|用料|ingredients?)\s*[::]?\s*$/i },
  { key: "steps", re: /^(做法|步骤|制作|调制|方法|instructions?|method|directions?|steps?|preparation)\s*[::]?\s*$/i },
  { key: "garnish", re: /^(装饰|garnish)\s*[::]?\s*$/i },
];

const SECTION_KEYS = {
  ingredients: "ingredients",
  steps: "steps",
  garnish: "garnish",
} as const;

/** 行内用量模式:数字+单位(ml/oz/dash/吧勺等)或"适量/少许" */
const AMOUNT_RE =
  /(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?(?:\s+\d+\s*\/\s*\d+)?|[½¼¾⅓⅔]|\d+\s*[½¼¾⅓⅔])\s*(ml|毫升|cc|oz|盎司|cl|dash(?:es)?|抖|滴|tsp|茶匙|小勺|tbsp|汤匙|大勺|bar\s*spoon|吧勺|shot|splash|片|个|颗|枝|叶|块|条|只)|适量|少许|top(?:\s*up)?/i;

/** 杯型关键词 */
const GLASS_WORDS = [
  "马天尼杯", "古典杯", "高球杯", "柯林杯", "库佩杯", "飓风杯", "子弹杯",
  "岩石杯", "笛型杯", "郁金香杯", "провина",
];

/** 制作方法关键词 */
const METHOD_WORDS: [RegExp, string][] = [
  [/摇和|摇制|shake/i, "摇和"],
  [/搅拌|搅和|stir/i, "搅拌"],
  [/直调|build/i, "直调"],
  [/分层|layer/i, "分层"],
  [/搅打|blend/i, "搅打"],
];

/** 基酒关键词 */
const SPIRIT_WORDS: [RegExp, string][] = [
  [/金酒|gin/i, "金酒"],
  [/朗姆|rum/i, "朗姆"],
  [/伏特加|vodka/i, "伏特加"],
  [/威士忌|whisk(e)?y|波本|bourbon/i, "威士忌"],
  [/龙舌兰|tequila|梅斯卡尔|mezcal/i, "龙舌兰"],
  [/白兰地|brandy|干邑|cognac/i, "白兰地"],
];

/** 判断一行是否像配料行(名称 + 用量) */
export function looksLikeIngredientLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  return AMOUNT_RE.test(t);
}

/** 从配料行拆出 名称 + 用量 */
export function splitIngredientLine(line: string): { name: string; amount: string } {
  let t = line
    .trim()
    .replace(/^[-•·*▪◦●]+\s*/, "") // 去列表符号(不吞行首数字,避免破坏"2 dash xx")
    .replace(/^\d+[.、)]\s+/, "") // 去"1. / 1、/ 1) "式序号(需带分隔符+空格)
    .replace(/\s{2,}/g, " ");

  const m = t.match(AMOUNT_RE);
  if (!m) return { name: t, amount: "" };

  const amount = m[0].trim();
  // 名称 = 去掉用量后的剩余部分
  let name = t.replace(m[0], "").trim();
  name = name.replace(/^[::\-–—,,]+|[::\-–—,,]+$/g, "").trim();
  // 处理"金酒 45ml"与"45ml 金酒"两种顺序
  if (!name) return { name: t, amount: "" };
  return { name, amount };
}

/**
 * 解析粘贴的配方文本,尽力提取各字段。
 * 支持两种常见格式:
 * 1. 有分节标题(配料:/做法:)
 * 2. 无标题——自动把"像配料"的行归为配料,其余归为做法
 */
export function parseRecipeText(text: string): ParsedRecipe {
  const result: ParsedRecipe = {
    name: "",
    ingredients: [],
    steps: "",
    glass: "",
    method: "",
    garnish: "",
    baseSpirit: "",
    variantOf: "",
    source: "",
  };
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (rawLines.length === 0) return result;

  // 行内键值:杯型:古典杯 / 装饰:橙皮 / 来源:xxx
  const kvHandlers: [RegExp, (v: string) => void][] = [
    [/^(杯型|杯具|glass(?:ware)?)\s*[::]\s*(.+)$/i, (v) => (result.glass = v)],
    [/^(装饰|garnish)\s*[::]\s*(.+)$/i, (v) => (result.garnish = v)],
    [/^(做法|方法|method)\s*[::]\s*(.+)$/i, (v) => (result.steps = result.steps ? result.steps + "\n" + v : v)],
    [/^(来源|出处|source)\s*[::]\s*(.+)$/i, (v) => (result.source = v)],
    [/^(变体|variant\s*of|变体来源)\s*[::]\s*(.+)$/i, (v) => (result.variantOf = v)],
    [/^(名称|酒名|name)\s*[::]\s*(.+)$/i, (v) => (result.name = v)],
  ];

  let section: keyof typeof SECTION_KEYS | null = null;
  const stepLines: string[] = [];
  const bodyLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // 键值行
    let handled = false;
    for (const [re, fn] of kvHandlers) {
      const m = line.match(re);
      if (m) {
        fn(m[2].trim());
        handled = true;
        break;
      }
    }
    if (handled) continue;

    // 分节标题行
    const sec = SECTION_PATTERNS.find((s) => s.re.test(line));
    if (sec) {
      section = sec.key;
      continue;
    }

    if (section === "ingredients") {
      if (looksLikeIngredientLine(line)) {
        const { name, amount } = splitIngredientLine(line);
        result.ingredients.push({ id: genId(), name, amount });
      } else {
        // 配料节中不像配料的行,可能是无用量配料(如"薄荷叶")
        result.ingredients.push({ id: genId(), name: line.replace(/^[-•·*\d]+[.、)\s]*\s*/, ""), amount: "" });
      }
      continue;
    }
    if (section === "steps") {
      stepLines.push(line);
      continue;
    }
    if (section === "garnish") {
      result.garnish = result.garnish ? result.garnish + "、" + line : line;
      continue;
    }
    bodyLines.push(line);
  }

  // 无分节标题时的自动归类
  for (const line of bodyLines) {
    if (looksLikeIngredientLine(line)) {
      const { name, amount } = splitIngredientLine(line);
      result.ingredients.push({ id: genId(), name, amount });
    } else if (!result.name && line.length <= 25 && !/[。;;.]/.test(line)) {
      // 第一条简短且不含句号的行 → 酒名
      result.name = line.replace(/^[##\s]+/, "");
    } else {
      stepLines.push(line);
    }
  }

  if (stepLines.length > 0) {
    const prefix = result.steps ? result.steps + "\n" : "";
    result.steps = prefix + stepLines.join("\n");
  }

  const allText = text;
  // 杯型/方法/基酒从全文推断(若未显式给出)
  if (!result.glass) {
    const g = GLASS_WORDS.find((w) => allText.includes(w));
    if (g) result.glass = g;
  }
  if (!result.method) {
    for (const [re, label] of METHOD_WORDS) {
      if (re.test(allText)) {
        result.method = label;
        break;
      }
    }
  }
  const ingText = result.ingredients.map((i) => i.name).join(" ");
  for (const [re, label] of SPIRIT_WORDS) {
    if (re.test(ingText)) {
      result.baseSpirit = label;
      break;
    }
  }

  return result;
}
