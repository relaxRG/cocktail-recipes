export interface Ingredient {
  id: string;
  name: string;
  amount: string;
}

export type Strength = "light" | "medium" | "strong";

export interface Recipe {
  id: string;
  name: string;
  categoryId: string | null;
  baseSpirit: string;
  glass: string;
  method: string;
  strength: Strength;
  ingredients: Ingredient[];
  steps: string;
  garnish: string;
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
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
