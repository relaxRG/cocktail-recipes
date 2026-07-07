import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { buildSamplePreps } from "./seed";
import {
  HomemadePrep,
  PrepSection,
  PrepType,
  buildDefaultPrepSections,
  buildDefaultPrepTypes,
  normalizePrep,
  prepSectionOf,
} from "./types";

const PREPS_KEY = "homemade.preps.v1";
const PREPS_SEEDED_KEY = "homemade.seeded.v1";
const SECTIONS_KEY = "homemade.sections.v1";
const TYPES_KEY = "homemade.types.v1";

interface HomemadeStore {
  ready: boolean;
  preps: HomemadePrep[];
  sections: PrepSection[];
  types: PrepType[];
  addPrep: (
    p: Omit<
      HomemadePrep,
      "id" | "createdAt" | "updatedAt" | "builtin" | "made" | "rating" | "sortIndex"
    > & {
      made?: boolean;
      rating?: number | null;
      sortIndex?: number | null;
    },
  ) => HomemadePrep;
  updatePrep: (id: string, patch: Partial<HomemadePrep>) => void;
  deletePrep: (id: string) => void;
  togglePrepMade: (id: string) => void;
  setPrepRating: (id: string, rating: number | null) => void;
  reorderPreps: (orderedIds: string[]) => void;
  importSamples: () => number;
  getPrep: (id: string | undefined) => HomemadePrep | undefined;
  // Section management
  addSection: (en: string, zh: string) => PrepSection | null;
  renameSection: (key: string, en: string, zh: string) => void;
  deleteSection: (key: string) => void;
  reorderSections: (orderedKeys: string[]) => void;
  // Type management
  addType: (en: string, zh: string, section: string) => PrepType | null;
  renameType: (key: string, en: string, zh: string) => void;
  moveType: (key: string, section: string) => void;
  deleteType: (key: string) => void;
  reorderTypes: (section: string, orderedKeys: string[]) => void;
}

const HomemadeContext = createContext<HomemadeStore | null>(null);

function slugify(en: string): string {
  const base = en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `custom-${Date.now().toString(36)}`;
}

export function HomemadeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preps, setPreps] = useState<HomemadePrep[]>([]);
  const [sections, setSections] = useState<PrepSection[]>(buildDefaultPrepSections());
  const [types, setTypes] = useState<PrepType[]>(buildDefaultPrepTypes());

  useEffect(() => {
    (async () => {
      try {
        const [raw, sRaw, tRaw] = await Promise.all([
          AsyncStorage.getItem(PREPS_KEY),
          AsyncStorage.getItem(SECTIONS_KEY),
          AsyncStorage.getItem(TYPES_KEY),
        ]);
        if (raw) {
          setPreps(JSON.parse(raw).map((p: HomemadePrep) => normalizePrep(p)));
        }
        if (sRaw) {
          const parsed: PrepSection[] = JSON.parse(sRaw);
          if (Array.isArray(parsed) && parsed.length > 0) setSections(parsed);
        }
        if (tRaw) {
          const parsed: PrepType[] = JSON.parse(tRaw);
          if (Array.isArray(parsed) && parsed.length > 0) setTypes(parsed);
        }
      } catch (e) {
        console.warn("Failed to load homemade preps", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((list: HomemadePrep[]) => {
    setPreps(list);
    AsyncStorage.setItem(PREPS_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const persistSections = useCallback((list: PrepSection[]) => {
    setSections(list);
    AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const persistTypes = useCallback((list: PrepType[]) => {
    setTypes(list);
    AsyncStorage.setItem(TYPES_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const addPrep = useCallback<HomemadeStore["addPrep"]>(
    (p) => {
      const now = Date.now();
      const prep: HomemadePrep = normalizePrep({
        ...p,
        id: `prep-user-${now}-${Math.random().toString(36).slice(2, 7)}`,
        builtin: false,
        createdAt: now,
        updatedAt: now,
      });
      persist([prep, ...preps]);
      return prep;
    },
    [preps, persist],
  );

  const updatePrep = useCallback<HomemadeStore["updatePrep"]>(
    (id, patch) => {
      persist(
        preps.map((p) => (p.id === id ? { ...p, ...patch, id, updatedAt: Date.now() } : p)),
      );
    },
    [preps, persist],
  );

  const deletePrep = useCallback<HomemadeStore["deletePrep"]>(
    (id) => {
      persist(preps.filter((p) => p.id !== id));
    },
    [preps, persist],
  );

  /** 切换自制品"做过/未做过"状态 */
  const togglePrepMade = useCallback<HomemadeStore["togglePrepMade"]>(
    (id) => {
      persist(
        preps.map((p) => (p.id === id ? { ...p, made: !p.made, updatedAt: Date.now() } : p)),
      );
    },
    [preps, persist],
  );

  /** 设置自制品评分(1-10 整数,null 清除) */
  const setPrepRating = useCallback<HomemadeStore["setPrepRating"]>(
    (id, rating) => {
      const v =
        typeof rating === "number" && isFinite(rating)
          ? Math.min(10, Math.max(1, Math.round(rating)))
          : null;
      persist(
        preps.map((p) => (p.id === id ? { ...p, rating: v, updatedAt: Date.now() } : p)),
      );
    },
    [preps, persist],
  );

  /** 长按拖拽后按新顺序写入 sortIndex */
  const reorderPreps = useCallback<HomemadeStore["reorderPreps"]>(
    (orderedIds) => {
      const pos = new Map(orderedIds.map((id, i) => [id, i]));
      persist(
        preps.map((p) => (pos.has(p.id) ? { ...p, sortIndex: pos.get(p.id)! } : p)),
      );
    },
    [preps, persist],
  );

  const importSamples = useCallback(() => {
    const existing = new Set(preps.map((p) => p.name.trim().toLowerCase()));
    const fresh = buildSamplePreps().filter(
      (p) => !existing.has(p.name.trim().toLowerCase()),
    );
    if (fresh.length > 0) {
      persist([...fresh, ...preps]);
      AsyncStorage.setItem(PREPS_SEEDED_KEY, "1").catch(() => {});
    }
    return fresh.length;
  }, [preps, persist]);

  const getPrep = useCallback(
    (id: string | undefined) => preps.find((p) => p.id === id),
    [preps],
  );

  // ----- Section management -----
  const addSection = useCallback(
    (en: string, zh: string): PrepSection | null => {
      const enT = en.trim();
      const zhT = zh.trim();
      if (!enT && !zhT) return null;
      let key = slugify(enT || zhT);
      while (sections.some((s) => s.key === key)) key = `${key}-1`;
      const sec: PrepSection = { key, en: enT || zhT, zh: zhT || enT };
      persistSections([...sections, sec]);
      return sec;
    },
    [sections, persistSections],
  );

  const renameSection = useCallback(
    (key: string, en: string, zh: string) => {
      persistSections(
        sections.map((s) =>
          s.key === key
            ? { ...s, en: en.trim() || s.en, zh: zh.trim() || s.zh }
            : s,
        ),
      );
    },
    [sections, persistSections],
  );

  const deleteSection = useCallback(
    (key: string) => {
      persistSections(sections.filter((s) => s.key !== key));
      // 该分区下类型移到"其他"分区(若删除的就是 misc 则保留为 misc 键,标签函数会回退)
      const fallback = key === "misc" ? sections.find((s) => s.key !== "misc")?.key ?? "misc" : "misc";
      persistTypes(types.map((t) => (t.section === key ? { ...t, section: fallback } : t)));
    },
    [sections, types, persistSections, persistTypes],
  );

  const reorderSections = useCallback(
    (orderedKeys: string[]) => {
      const map = new Map(sections.map((s) => [s.key, s]));
      const next: PrepSection[] = [];
      for (const k of orderedKeys) {
        const item = map.get(k);
        if (item) {
          next.push(item);
          map.delete(k);
        }
      }
      for (const rest of map.values()) next.push(rest);
      persistSections(next);
    },
    [sections, persistSections],
  );

  // ----- Type management -----
  const addType = useCallback(
    (en: string, zh: string, section: string): PrepType | null => {
      const enT = en.trim();
      const zhT = zh.trim();
      if (!enT && !zhT) return null;
      let key = slugify(enT || zhT);
      while (types.some((t) => t.key === key)) key = `${key}-1`;
      const typ: PrepType = { key, en: enT || zhT, zh: zhT || enT, section };
      persistTypes([...types, typ]);
      return typ;
    },
    [types, persistTypes],
  );

  const renameType = useCallback(
    (key: string, en: string, zh: string) => {
      persistTypes(
        types.map((t) =>
          t.key === key ? { ...t, en: en.trim() || t.en, zh: zh.trim() || t.zh } : t,
        ),
      );
    },
    [types, persistTypes],
  );

  const moveType = useCallback(
    (key: string, section: string) => {
      persistTypes(types.map((t) => (t.key === key ? { ...t, section } : t)));
    },
    [types, persistTypes],
  );

  const deleteType = useCallback(
    (key: string) => {
      persistTypes(types.filter((t) => t.key !== key));
      // 使用该类型的条目改为 other,避免悬空
      if (preps.some((p) => p.type === key)) {
        persist(preps.map((p) => (p.type === key ? { ...p, type: "other" } : p)));
      }
    },
    [types, preps, persistTypes, persist],
  );

  const reorderTypes = useCallback(
    (section: string, orderedKeys: string[]) => {
      const same = types.filter((t) => t.section === section);
      const map = new Map(same.map((t) => [t.key, t]));
      const reordered: PrepType[] = [];
      for (const k of orderedKeys) {
        const item = map.get(k);
        if (item) {
          reordered.push(item);
          map.delete(k);
        }
      }
      for (const rest of map.values()) reordered.push(rest);
      // 保持整体列表中非本分区类型的相对位置,本分区类型按新顺序放回
      let idx = 0;
      const next = types.map((t) => (t.section === section ? reordered[idx++] : t));
      persistTypes(next);
    },
    [types, persistTypes],
  );

  const value = useMemo(
    () => ({
      ready,
      preps,
      sections,
      types,
      addPrep,
      updatePrep,
      deletePrep,
      togglePrepMade,
      setPrepRating,
      reorderPreps,
      importSamples,
      getPrep,
      addSection,
      renameSection,
      deleteSection,
      reorderSections,
      addType,
      renameType,
      moveType,
      deleteType,
      reorderTypes,
    }),
    [
      ready,
      preps,
      sections,
      types,
      addPrep,
      updatePrep,
      deletePrep,
      togglePrepMade,
      setPrepRating,
      reorderPreps,
      importSamples,
      getPrep,
      addSection,
      renameSection,
      deleteSection,
      reorderSections,
      addType,
      renameType,
      moveType,
      deleteType,
      reorderTypes,
    ],
  );

  return <HomemadeContext.Provider value={value}>{children}</HomemadeContext.Provider>;
}

export function useHomemadeStore(): HomemadeStore {
  const ctx = useContext(HomemadeContext);
  if (!ctx) throw new Error("useHomemadeStore must be used within HomemadeProvider");
  return ctx;
}

export function filterPreps(
  preps: HomemadePrep[],
  query: string,
  type?: string,
  section?: string,
  typesList?: PrepType[],
): HomemadePrep[] {
  const q = query.trim().toLowerCase();
  const sectionOf = (typeKey: string) =>
    typesList
      ? typesList.find((t) => t.key === typeKey)?.section ?? prepSectionOf(typeKey)
      : prepSectionOf(typeKey);
  return preps.filter((p) => {
    if (type && p.type !== type) return false;
    if (section && sectionOf(p.type) !== section) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.nameAlt.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.ingredients.some((ing) => ing.toLowerCase().includes(q)) ||
      p.notes.toLowerCase().includes(q)
    );
  });
}
