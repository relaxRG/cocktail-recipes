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
import { HomemadePrep, normalizePrep } from "./types";

const PREPS_KEY = "homemade.preps.v1";
const PREPS_SEEDED_KEY = "homemade.seeded.v1";

interface HomemadeStore {
  ready: boolean;
  preps: HomemadePrep[];
  addPrep: (p: Omit<HomemadePrep, "id" | "createdAt" | "updatedAt" | "builtin">) => HomemadePrep;
  updatePrep: (id: string, patch: Partial<HomemadePrep>) => void;
  deletePrep: (id: string) => void;
  importSamples: () => number;
  getPrep: (id: string | undefined) => HomemadePrep | undefined;
}

const HomemadeContext = createContext<HomemadeStore | null>(null);

export function HomemadeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preps, setPreps] = useState<HomemadePrep[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREPS_KEY);
        if (raw) {
          setPreps(JSON.parse(raw).map((p: HomemadePrep) => normalizePrep(p)));
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

  const value = useMemo(
    () => ({ ready, preps, addPrep, updatePrep, deletePrep, importSamples, getPrep }),
    [ready, preps, addPrep, updatePrep, deletePrep, importSamples, getPrep],
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
): HomemadePrep[] {
  const q = query.trim().toLowerCase();
  return preps.filter((p) => {
    if (type && p.type !== type) return false;
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

