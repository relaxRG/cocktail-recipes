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

import { buildDefaultCategories, buildSampleRecipes } from "./seed";
import {
  Category,
  Recipe,
  TagItem,
  TagKind,
  buildDefaultTags,
  genId,
  normalizeRecipe,
} from "./types";

const RECIPES_KEY = "cocktail.recipes";
const CATEGORIES_KEY = "cocktail.categories";
const SEEDED_KEY = "cocktail.seeded";
const TAGS_KEY = "cocktail.tags";

export interface RecipeDraft {
  name: string;
  categoryId: string | null;
  baseSpirit: string;
  glass: string;
  method: string;
  strength: Recipe["strength"];
  variantOf: string;
  codexFamily: string;
  flavors: string[];
  source: string;
  ingredients: Recipe["ingredients"];
  steps: string;
  garnish: string;
  notes: string;
}

interface RecipeStore {
  ready: boolean;
  recipes: Recipe[];
  categories: Category[];
  tags: TagItem[];
  addRecipe: (draft: RecipeDraft) => Recipe;
  updateRecipe: (id: string, draft: RecipeDraft) => void;
  deleteRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addCategory: (name: string, color: string) => Category | null;
  renameCategory: (id: string, name: string) => void;
  setCategoryColor: (id: string, color: string) => void;
  deleteCategory: (id: string) => void;
  addTag: (kind: TagKind, name: string, color: string) => TagItem | null;
  renameTag: (id: string, name: string) => void;
  setTagColor: (id: string, color: string) => void;
  deleteTag: (id: string) => void;
  tagsOf: (kind: TagKind) => TagItem[];
  importSamples: () => void;
  getRecipe: (id: string | undefined) => Recipe | undefined;
  getCategory: (id: string | null | undefined) => Category | undefined;
}

const RecipeContext = createContext<RecipeStore | null>(null);

export function RecipeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [rRaw, cRaw, seeded, tRaw] = await Promise.all([
          AsyncStorage.getItem(RECIPES_KEY),
          AsyncStorage.getItem(CATEGORIES_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
          AsyncStorage.getItem(TAGS_KEY),
        ]);
        let cats: Category[] = cRaw ? JSON.parse(cRaw) : [];
        const parsed: Recipe[] = rRaw ? JSON.parse(rRaw) : [];
        const recs: Recipe[] = parsed.map((r) => normalizeRecipe(r));
        if (!seeded && cats.length === 0) {
          cats = buildDefaultCategories();
          await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
          await AsyncStorage.setItem(SEEDED_KEY, "1");
        }
        let tagList: TagItem[] = tRaw ? JSON.parse(tRaw) : [];
        if (!tRaw) {
          tagList = buildDefaultTags();
          await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(tagList));
        }
        setTags(tagList);
        setCategories(cats);
        setRecipes(recs);
      } catch (e) {
        console.warn("Failed to load store", e);
      } finally {
        loadedRef.current = true;
        setReady(true);
      }
    })();
  }, []);

  const persistRecipes = useCallback((next: Recipe[]) => {
    setRecipes(next);
    AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const persistCategories = useCallback((next: Category[]) => {
    setCategories(next);
    AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const persistTags = useCallback((next: TagItem[]) => {
    setTags(next);
    AsyncStorage.setItem(TAGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addRecipe = useCallback(
    (draft: RecipeDraft): Recipe => {
      const now = Date.now();
      const recipe: Recipe = {
        id: genId(),
        favorite: false,
        createdAt: now,
        updatedAt: now,
        ...draft,
      };
      persistRecipes([recipe, ...recipesRef.current]);
      return recipe;
    },
    [persistRecipes],
  );

  // keep a ref to latest recipes/categories for stable callbacks
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  const updateRecipe = useCallback(
    (id: string, draft: RecipeDraft) => {
      persistRecipes(
        recipesRef.current.map((r) =>
          r.id === id ? { ...r, ...draft, updatedAt: Date.now() } : r,
        ),
      );
    },
    [persistRecipes],
  );

  const deleteRecipe = useCallback(
    (id: string) => {
      persistRecipes(recipesRef.current.filter((r) => r.id !== id));
    },
    [persistRecipes],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      persistRecipes(
        recipesRef.current.map((r) =>
          r.id === id ? { ...r, favorite: !r.favorite, updatedAt: Date.now() } : r,
        ),
      );
    },
    [persistRecipes],
  );

  const addCategory = useCallback(
    (name: string, color: string): Category | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (categoriesRef.current.some((c) => c.name === trimmed)) return null;
      const cat: Category = {
        id: genId(),
        name: trimmed,
        color,
        createdAt: Date.now(),
      };
      persistCategories([...categoriesRef.current, cat]);
      return cat;
    },
    [persistCategories],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persistCategories(
        categoriesRef.current.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      );
    },
    [persistCategories],
  );

  const setCategoryColor = useCallback(
    (id: string, color: string) => {
      persistCategories(
        categoriesRef.current.map((c) => (c.id === id ? { ...c, color } : c)),
      );
    },
    [persistCategories],
  );

  const addTag = useCallback(
    (kind: TagKind, name: string, color: string): TagItem | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (tagsRef.current.some((t) => t.kind === kind && t.name === trimmed)) return null;
      const tag: TagItem = {
        id: genId(),
        kind,
        name: trimmed,
        color,
        createdAt: Date.now(),
      };
      persistTags([...tagsRef.current, tag]);
      return tag;
    },
    [persistTags],
  );

  const renameTag = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const target = tagsRef.current.find((t) => t.id === id);
      if (!target) return;
      const oldName = target.name;
      persistTags(
        tagsRef.current.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
      );
      // 同步更新已有配方中的标签名称
      persistRecipes(
        recipesRef.current.map((r) => {
          let changed = false;
          const next = { ...r };
          if (target.kind === "spirit" && r.baseSpirit === oldName) {
            next.baseSpirit = trimmed;
            changed = true;
          }
          if (target.kind === "glass" && r.glass === oldName) {
            next.glass = trimmed;
            changed = true;
          }
          if (target.kind === "flavor" && r.flavors.includes(oldName)) {
            next.flavors = r.flavors.map((f) => (f === oldName ? trimmed : f));
            changed = true;
          }
          return changed ? next : r;
        }),
      );
    },
    [persistTags, persistRecipes],
  );

  const setTagColor = useCallback(
    (id: string, color: string) => {
      persistTags(tagsRef.current.map((t) => (t.id === id ? { ...t, color } : t)));
    },
    [persistTags],
  );

  const deleteTag = useCallback(
    (id: string) => {
      const target = tagsRef.current.find((t) => t.id === id);
      persistTags(tagsRef.current.filter((t) => t.id !== id));
      if (!target) return;
      // 从已有配方中移除该风味标签;基酒/杯型保留原文字(仅失去颜色标记)
      if (target.kind === "flavor") {
        persistRecipes(
          recipesRef.current.map((r) =>
            r.flavors.includes(target.name)
              ? { ...r, flavors: r.flavors.filter((f) => f !== target.name) }
              : r,
          ),
        );
      }
    },
    [persistTags, persistRecipes],
  );

  const tagsOf = useCallback(
    (kind: TagKind) => tags.filter((t) => t.kind === kind),
    [tags],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      persistCategories(categoriesRef.current.filter((c) => c.id !== id));
      // Recipes in this category become uncategorized
      persistRecipes(
        recipesRef.current.map((r) =>
          r.categoryId === id ? { ...r, categoryId: null } : r,
        ),
      );
    },
    [persistCategories, persistRecipes],
  );

  const importSamples = useCallback(() => {
    const samples = buildSampleRecipes();
    const existingNames = new Set(recipesRef.current.map((r) => r.name));
    const fresh = samples.filter((s) => !existingNames.has(s.name));
    if (fresh.length === 0) return;
    persistRecipes([...fresh, ...recipesRef.current]);
  }, [persistRecipes]);

  const getRecipe = useCallback(
    (id: string | undefined) => recipes.find((r) => r.id === id),
    [recipes],
  );

  const getCategory = useCallback(
    (id: string | null | undefined) => categories.find((c) => c.id === id),
    [categories],
  );

  const value = useMemo<RecipeStore>(
    () => ({
      ready,
      recipes,
      categories,
      tags,
      addRecipe,
      updateRecipe,
      deleteRecipe,
      toggleFavorite,
      addCategory,
      renameCategory,
      setCategoryColor,
      deleteCategory,
      addTag,
      renameTag,
      setTagColor,
      deleteTag,
      tagsOf,
      importSamples,
      getRecipe,
      getCategory,
    }),
    [
      ready,
      recipes,
      categories,
      tags,
      addRecipe,
      updateRecipe,
      deleteRecipe,
      toggleFavorite,
      addCategory,
      renameCategory,
      setCategoryColor,
      deleteCategory,
      addTag,
      renameTag,
      setTagColor,
      deleteTag,
      tagsOf,
      importSamples,
      getRecipe,
      getCategory,
    ],
  );

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}

export function useRecipeStore(): RecipeStore {
  const ctx = useContext(RecipeContext);
  if (!ctx) throw new Error("useRecipeStore must be used within RecipeProvider");
  return ctx;
}
