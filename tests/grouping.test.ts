import { describe, expect, it } from "vitest";

import {
  groupPrepsByName,
  groupRecipesByName,
  normalizeNameKey,
} from "../lib/recipes/grouping";
import { normalizeRecipe, Recipe } from "../lib/recipes/types";
import { normalizePrep } from "../lib/homemade/types";

function mkRecipe(id: string, name: string, nameEn: string): Recipe {
  return normalizeRecipe({ id, name, nameEn });
}

describe("normalizeNameKey", () => {
  it("忽略大小写与空格", () => {
    expect(normalizeNameKey("Old Fashioned")).toBe(normalizeNameKey("old fashioned"));
  });

  it("忽略括号修饰", () => {
    expect(normalizeNameKey("尼格罗尼(经典)")).toBe(normalizeNameKey("尼格罗尼"));
    expect(normalizeNameKey("Negroni (Classic)")).toBe(normalizeNameKey("Negroni"));
  });

  it("剥离常见版本后缀", () => {
    expect(normalizeNameKey("金菲兹改良版")).toBe(normalizeNameKey("金菲兹"));
    expect(normalizeNameKey("Gin Fizz No.2")).toBe(normalizeNameKey("Gin Fizz"));
  });

  it("空字符串返回空", () => {
    expect(normalizeNameKey("")).toBe("");
  });
});

describe("groupRecipesByName", () => {
  it("同名(中文)合并为一组", () => {
    const rs = [
      mkRecipe("a", "尼格罗尼", "Negroni"),
      mkRecipe("b", "尼格罗尼", "Negroni Improved"),
      mkRecipe("c", "金菲兹", "Gin Fizz"),
    ];
    const groups = groupRecipesByName(rs);
    expect(groups.length).toBe(2);
    expect(groups[0].items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((r) => r.id)).toEqual(["c"]);
  });

  it("英文名相同、中文名不同也合并", () => {
    const rs = [
      mkRecipe("a", "威士忌酸", "Whiskey Sour"),
      mkRecipe("b", "威士忌沙瓦", "Whiskey Sour"),
    ];
    const groups = groupRecipesByName(rs);
    expect(groups.length).toBe(1);
    expect(groups[0].items.length).toBe(2);
  });

  it("互不同名各自成组,保持顺序", () => {
    const rs = [
      mkRecipe("a", "玛格丽特", "Margarita"),
      mkRecipe("b", "大吉利", "Daiquiri"),
    ];
    const groups = groupRecipesByName(rs);
    expect(groups.map((g) => g.items[0].id)).toEqual(["a", "b"]);
  });
});

describe("groupPrepsByName", () => {
  it("同名自制品合并(如两种做法的姜糖浆)", () => {
    const ps = [
      normalizePrep({ id: "p1", name: "姜糖浆", nameAlt: "Ginger Syrup", recipe: "加热熬煮" }),
      normalizePrep({ id: "p2", name: "姜糖浆", nameAlt: "Ginger Syrup (Cold)", recipe: "冷藏静置" }),
      normalizePrep({ id: "p3", name: "蜂蜜糖浆", nameAlt: "Honey Syrup" }),
    ];
    const groups = groupPrepsByName(ps);
    expect(groups.length).toBe(2);
    expect(groups[0].items.length).toBe(2);
  });
});
