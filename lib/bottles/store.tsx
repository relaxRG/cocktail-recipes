import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifySyncChange } from "../sync/engine";
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

import { CATEGORY_MIGRATION_V6, migrateMaterialBottleV8 } from "./taxonomy";
import { Bottle, migrateBottleCategory, normalizeBottle } from "./types";
import { buildWaldorfBottles } from "./waldorf-ingredients";

const BOTTLES_KEY = "cocktail.bottles";
const BOTTLES_SEEDED_KEY = "cocktail.bottles.seeded";
/** 《Waldorf》配料数据集导入标记 */
const WALDORF_BOTTLES_FLAG = "cocktail.bottles.waldorf.v1";
/** v8 原材料分类拆分迁移标记 */
const MATERIAL_MIGRATED_V8_FLAG = "bottles.material.migrated.v8";

export type BottleDraft = Omit<
  Bottle,
  "id" | "builtin" | "rating" | "sortIndex" | "createdAt" | "updatedAt"
> & { rating?: number | null };

/** 名称连接词拆分正则:顿号/逗号并列 + 或/与/及/和 + 英文 or/and/&/+ */
const NAME_CONNECTOR_RE = /[、,,;;]|[或与及和]|\s+(?:or|and)\s+|\s*[&+]\s*/i;
const NAME_SPLIT_RE = /[、,,;;]|或者|[或与及和]|\s+(?:or|and)\s+|\s*[&+]\s*/gi;

/**
 * 原材料库入库智能拆分:条目名含连接词(或/与/及/和/、等)时拆为多个独立草稿。
 * 中英名逐段对齐(段数一致时一一对应;不一致时仅拆含连接词的一侧,另一侧共享)。
 * 拆出的每条共享规格/价格/分类等其余字段。
 */
export function splitBottleDraft(draft: BottleDraft): BottleDraft[] {
  const zh = (draft.nameZh || "").trim();
  const en = (draft.nameEn || "").trim();
  const zhHas = NAME_CONNECTOR_RE.test(zh);
  const enHas = NAME_CONNECTOR_RE.test(en);
  if (!zhHas && !enHas) return [draft];
  const seg = (s: string) =>
    s
      .split(NAME_SPLIT_RE)
      .map((x) => x.trim())
      .filter((x) => x.replace(/[^a-zA-Z\u4e00-\u9fff]/g, "").length >= 1);
  const zhParts = zhHas ? seg(zh) : [];
  const enParts = enHas ? seg(en) : [];
  const n = Math.max(zhParts.length, enParts.length);
  if (n <= 1) return [draft];
  const out: BottleDraft[] = [];
  for (let i = 0; i < n; i++) {
    const zhName = zhParts.length === n ? zhParts[i] : zhParts[i] ?? (i === 0 ? zh : "");
    const enName = enParts.length === n ? enParts[i] : enParts[i] ?? (i === 0 ? en : "");
    if (!zhName && !enName) continue;
    out.push({ ...draft, nameZh: zhName ?? "", nameEn: enName ?? "" });
  }
  return out.length > 0 ? out : [draft];
}

interface BottleStore {
  ready: boolean;
  bottles: Bottle[];
  addBottle: (draft: BottleDraft) => Bottle;
  updateBottle: (id: string, draft: BottleDraft) => void;
  deleteBottle: (id: string) => void;
  deleteBottles: (ids: string[]) => void;
  bulkUpdateBottles: (ids: string[], patch: Partial<Bottle>) => void;
  setBottleRating: (id: string, rating: number | null) => void;
  reorderBottles: (orderedIds: string[]) => void;
  getBottle: (id: string | undefined) => Bottle | undefined;
}

const SEED_VERSION = "6";

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
          notifySyncChange(BOTTLES_KEY);
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
          notifySyncChange(BOTTLES_KEY);
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
          notifySyncChange(BOTTLES_KEY);
        }
        // v6 迁移:按用户要求删除全部内置种子酒款(仅种子,保留用户自建数据),
        // 且不再进行任何初始 seed;同时旧分类名迁移(开胃酒→阿玛罗与开胃酒)。
        if (seeded !== SEED_VERSION) {
          const before = list.length;
          list = list.filter((b) => !b.builtin);
          let migrated = list.length !== before;
          list = list.map((b) => {
            const next = CATEGORY_MIGRATION_V6[b.category];
            if (next) {
              migrated = true;
              return { ...b, category: next };
            }
            return b;
          });
          if (migrated) await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
          notifySyncChange(BOTTLES_KEY);
          await AsyncStorage.setItem(BOTTLES_SEEDED_KEY, SEED_VERSION);
          notifySyncChange(BOTTLES_SEEDED_KEY);
        }
        // 《Waldorf》配料数据集:首次加载时一次性合入(按中/英名去重,幂等)
        {
          const waldorfDone = await AsyncStorage.getItem(WALDORF_BOTTLES_FLAG);
          if (!waldorfDone) {
            const names = new Set<string>();
            for (const b of list) {
              if (b.nameZh) names.add(b.nameZh.trim().toLowerCase());
              if (b.nameEn) names.add(b.nameEn.trim().toLowerCase());
            }
            const fresh = buildWaldorfBottles().filter(
              (b) =>
                !names.has(b.nameZh.trim().toLowerCase()) &&
                !names.has(b.nameEn.trim().toLowerCase()),
            );
            if (fresh.length > 0) {
              list = [...list, ...fresh];
              await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
              notifySyncChange(BOTTLES_KEY);
            }
            await AsyncStorage.setItem(WALDORF_BOTTLES_FLAG, "1");
            notifySyncChange(WALDORF_BOTTLES_FLAG);
          }
        }
        // v8:旧笼统"原材料"条目拆分到 8 个专业材料分类(一次性;后续新条目仍会即时迁移)
        {
          const v8Done = await AsyncStorage.getItem(MATERIAL_MIGRATED_V8_FLAG);
          const hasLegacy = list.some((b) => b.category === "原材料");
          if (!v8Done || hasLegacy) {
            if (hasLegacy) {
              list = list.map((b) => {
                if (b.category !== "原材料") return b;
                const moved = migrateMaterialBottleV8({
                  category: b.category,
                  style: b.style,
                  name: b.nameEn,
                  nameZh: b.nameZh,
                });
                return moved
                  ? { ...b, category: moved.category, style: moved.style ?? b.style }
                  : b;
              });
              await AsyncStorage.setItem(BOTTLES_KEY, JSON.stringify(list));
              notifySyncChange(BOTTLES_KEY);
            }
            await AsyncStorage.setItem(MATERIAL_MIGRATED_V8_FLAG, "1");
            notifySyncChange(MATERIAL_MIGRATED_V8_FLAG);
          }
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
    notifySyncChange(BOTTLES_KEY);
  }, []);

  const addBottle = useCallback(
    (draft: BottleDraft): Bottle => {
      const now = Date.now();
      // 连接词智能拆分:条目名含「或/与/及/和」等时拆为多个独立条目分别入库
      const drafts = splitBottleDraft(draft);
      const created: Bottle[] = drafts.map((d, i) => ({
        id: genId(),
        builtin: false,
        rating: null,
        sortIndex: null,
        createdAt: now + i,
        updatedAt: now + i,
        ...d,
        ...(d.rating === undefined ? { rating: null } : {}),
      }));
      persist([...created, ...bottlesRef.current]);
      return created[0];
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

  /** 批量删除酒款 */
  const deleteBottles = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      persist(bottlesRef.current.filter((b) => !set.has(b.id)));
    },
    [persist],
  );

  /** 批量更新酒款字段(分类/风格等) */
  const bulkUpdateBottles = useCallback(
    (ids: string[], patch: Partial<Bottle>) => {
      const set = new Set(ids);
      persist(
        bottlesRef.current.map((b) =>
          set.has(b.id) ? { ...b, ...patch, updatedAt: Date.now() } : b,
        ),
      );
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
      deleteBottles,
      bulkUpdateBottles,
      setBottleRating,
      reorderBottles,
      getBottle,
    }),
    [ready, bottles, addBottle, updateBottle, deleteBottle, deleteBottles, bulkUpdateBottles, setBottleRating, reorderBottles, getBottle],
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
