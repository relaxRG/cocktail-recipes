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
import { Bottle, normalizeBottle } from "./types";

const BOTTLES_KEY = "cocktail.bottles";
const BOTTLES_SEEDED_KEY = "cocktail.bottles.seeded";

export type BottleDraft = Omit<Bottle, "id" | "builtin" | "createdAt" | "updatedAt">;

interface BottleStore {
  ready: boolean;
  bottles: Bottle[];
  addBottle: (draft: BottleDraft) => Bottle;
  updateBottle: (id: string, draft: BottleDraft) => void;
  deleteBottle: (id: string) => void;
  getBottle: (id: string | undefined) => Bottle | undefined;
}

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
        if (!seeded && list.length === 0) {
          list = buildDefaultBottles();
          await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
          await AsyncStorage.setItem(BOTTLES_SEEDED_KEY, "1");
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
        createdAt: now,
        updatedAt: now,
        ...draft,
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

  const getBottle = useCallback(
    (id: string | undefined) => bottles.find((b) => b.id === id),
    [bottles],
  );

  const value = useMemo<BottleStore>(
    () => ({ ready, bottles, addBottle, updateBottle, deleteBottle, getBottle }),
    [ready, bottles, addBottle, updateBottle, deleteBottle, getBottle],
  );

  return <BottleContext.Provider value={value}>{children}</BottleContext.Provider>;
}

export function useBottleStore(): BottleStore {
  const ctx = useContext(BottleContext);
  if (!ctx) throw new Error("useBottleStore must be used within BottleProvider");
  return ctx;
}

/** 酒款搜索过滤:支持中英文名、品牌、分类、产地模糊匹配 + 分类筛选 */
export function filterBottles(
  bottles: Bottle[],
  query: string,
  category?: string,
): Bottle[] {
  const q = query.trim().toLowerCase();
  return bottles.filter((b) => {
    if (category && b.category !== category) return false;
    if (!q) return true;
    return (
      b.nameZh.toLowerCase().includes(q) ||
      b.nameEn.toLowerCase().includes(q) ||
      b.brand.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.origin.toLowerCase().includes(q) ||
      b.notes.toLowerCase().includes(q)
    );
  });
}
