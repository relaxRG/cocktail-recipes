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

import { genId } from "../recipes/types";

import { buildDefaultBottles } from "./seed";
import { Bottle, migrateBottleCategory, normalizeBottle } from "./types";

const BOTTLES_KEY = "cocktail.bottles";
const BOTTLES_SEEDED_KEY = "cocktail.bottles.seeded";

export type BottleDraft = Omit<
  Bottle,
  "id" | "builtin" | "rating" | "sortIndex" | "createdAt" | "updatedAt"
> & { rating?: number | null };

interface BottleStore {
  ready: boolean;
  bottles: Bottle[];
  addBottle: (draft: BottleDraft) => Bottle;
  updateBottle: (id: string, draft: BottleDraft) => void;
  deleteBottle: (id: string) => void;
  setBottleRating: (id: string, rating: number | null) => void;
  reorderBottles: (orderedIds: string[]) => void;
  getBottle: (id: string | undefined) => Bottle | undefined;
}

const SEED_VERSION = "5";

const BottleContext = createContext<BottleStore | null>(null);

export function BottleProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bottles, setBottles] = useState<Bottle[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [raw, seeded] = await Promise.all([
          AsyncStorage.getItem(BOTTLES_KEY),
          AsyncStorage.getItem(BOTTLES_SEEDED_KEY),
        ]);
        let list: Bottle[] = raw ? JSON.parse(raw).map((b: Bottle) => normalizeBottle(b)) : [];
        // 修复历史合并可能产生的重复 id(保留原顺序,重复项重新编号)
        {
          const seen = new Set<string>();
          let changed = false;
          list = list.map((b) => {
            if (seen.has(b.id)) {
              changed = true;
              let n = 2;
              let nid = `${b.id}-${n}`;
              while (seen.has(nid)) nid = `${b.id}-${++n}`;
              seen.add(nid);
              return { ...b, id: nid };
            }
            seen.add(b.id);
            return b;
          });
          if (changed) await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
        }
        // v4 迁移:旧分类"软饮糖浆"拆分为"糖浆"与"软饮"
        {
          let migrated = false;
          list = list.map((b) => {
            const next = migrateBottleCategory(b);
            if (next !== b.category) {
              migrated = true;
              return { ...b, category: next };
            }
            return b;
          });
          if (migrated) await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
        }
        // v5 迁移:内置鲜榨果汁条目移入自制库,从酒库移除
        {
          const before = list.length;
          list = list.filter(
            (b) =>
              !(
                b.builtin &&
                /^fresh (lime|lemon|orange) juice$/i.test(b.nameEn.trim())
              ),
          );
          if (list.length !== before) await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
        }
        if (!seeded && list.length === 0) {
          list = buildDefaultBottles();
          await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
          await AsyncStorage.setItem(BOTTLES_SEEDED_KEY, SEED_VERSION);
        } else if (seeded && seeded !== SEED_VERSION) {
          // 种子库升级:把新增的内置酒款合并进来(按 nameEn 去重,不覆盖用户数据)
          const existingEn = new Set(
            list.map((b) => b.nameEn.trim().toLowerCase()).filter(Boolean),
          );
          const existingZh = new Set(list.map((b) => b.nameZh.trim()).filter(Boolean));
          const existingIds = new Set(list.map((b) => b.id));
          // 为已有内置酒款回填新增的 style 字段(不覆盖用户已填写的值)
          const seedByEn = new Map(
            buildDefaultBottles().map((b) => [b.nameEn.trim().toLowerCase(), b]),
          );
          list = list.map((b) => {
            if (b.builtin && !b.style) {
              const seed = seedByEn.get(b.nameEn.trim().toLowerCase());
              if (seed?.style) return { ...b, style: seed.style };
            }
            return b;
          });
          const additions = buildDefaultBottles()
            .filter(
              (b) =>
                !existingEn.has(b.nameEn.trim().toLowerCase()) &&
                !existingZh.has(b.nameZh.trim()),
            )
            // 旧库可能已占用相同的 bottle-N id,冲突时重新分配唯一 id
            .map((b) => (existingIds.has(b.id) ? { ...b, id: `${b.id}-v${SEED_VERSION}` } : b));
          if (additions.length > 0) {
            list = [...list, ...additions];
            await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
          }
          await AsyncStorage.setItem(BOTTLES_SEEDED_KEY, SEED_VERSION);
        }
        setBottles(list);
      } catch (e) {
        console.warn("Failed to load bottles", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const bottlesRef = useRef(bottles);
  bottlesRef.current = bottles;

  const persist = useCallback((next: Bottle[]) => {
    setBottles(next);
    AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addBottle = useCallback(
    (draft: BottleDraft): Bottle => {
      const now = Date.now();
      const bottle: Bottle = {
        id: genId(),
        builtin: false,
        rating: null,
        sortIndex: null,
        createdAt: now,
        updatedAt: now,
        ...draft,
        ...(draft.rating === undefined ? { rating: null } : {}),
      };
      persist([bottle, ...bottlesRef.current]);
      return bottle;
    },
    [persist],
  );

  const updateBottle = useCallback(
    (id: string, draft: BottleDraft) => {
      persist(
        bottlesRef.current.map((b) =>
          b.id === id ? { ...b, ...draft, updatedAt: Date.now() } : b,
        ),
      );
    },
    [persist],
  );

  const deleteBottle = useCallback(
    (id: string) => {
      persist(bottlesRef.current.filter((b) => b.id !== id));
    },
    [persist],
  );

  /** 设置酒款评分(1-10 整数,null 清除) */
  const setBottleRating = useCallback(
    (id: string, rating: number | null) => {
      const v =
        typeof rating === "number" && isFinite(rating)
          ? Math.min(10, Math.max(1, Math.round(rating)))
          : null;
      persist(
        bottlesRef.current.map((b) =>
          b.id === id ? { ...b, rating: v, updatedAt: Date.now() } : b,
        ),
      );
    },
    [persist],
  );

  /** 长按拖拽后按新顺序写入 sortIndex(仅对传入的 id 生效,其余保持) */
  const reorderBottles = useCallback(
    (orderedIds: string[]) => {
      const pos = new Map(orderedIds.map((id, i) => [id, i]));
      persist(
        bottlesRef.current.map((b) =>
          pos.has(b.id) ? { ...b, sortIndex: pos.get(b.id)! } : b,
        ),
      );
    },
    [persist],
  );

  const getBottle = useCallback(
    (id: string | undefined) => bottles.find((b) => b.id === id),
    [bottles],
  );

  const value = useMemo<BottleStore>(
    () => ({
      ready,
      bottles,
      addBottle,
      updateBottle,
      deleteBottle,
      setBottleRating,
      reorderBottles,
      getBottle,
    }),
    [ready, bottles, addBottle, updateBottle, deleteBottle, setBottleRating, reorderBottles, getBottle],
  );

  return <BottleContext.Provider value={value}>{children}</BottleContext.Provider>;
}

export function useBottleStore(): BottleStore {
  const ctx = useContext(BottleContext);
  if (!ctx) throw new Error("useBottleStore must be used within BottleProvider");
  return ctx;
}

/** 酒款搜索过滤:支持中英文名、品牌、分类、产地模糊匹配 + 分类/风格筛选 */
export function filterBottles(
  bottles: Bottle[],
  query: string,
  category?: string,
  style?: string,
): Bottle[] {
  const q = query.trim().toLowerCase();
  return bottles.filter((b) => {
    if (category && b.category !== category) return false;
    if (style && b.style !== style) return false;
    if (!q) return true;
    return (
      b.nameZh.toLowerCase().includes(q) ||
      b.nameEn.toLowerCase().includes(q) ||
      b.brand.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.origin.toLowerCase().includes(q) ||
      b.style.toLowerCase().includes(q) ||
      b.notes.toLowerCase().includes(q)
    );
  });
}
