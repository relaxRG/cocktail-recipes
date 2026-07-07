import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { FilterSortSheet, FilterDimension } from "@/components/filter-sort-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { filterPreps, useHomemadeStore } from "@/lib/homemade/store";
import { useBottleStore } from "@/lib/bottles/store";
import { estimatePrepCost } from "@/lib/homemade/cost";
import { primaryTechnique, techniqueLabel, TECHNIQUES, detectPrepTechniques } from "@/lib/homemade/technique";
import { groupPrepsByName } from "@/lib/recipes/grouping";
import { sortPreps, PREP_SORTS, PrepSort } from "@/lib/recipes/sort";
import { Bottle } from "@/lib/bottles/types";
import {
  HomemadePrep,
  prepSectionLabelIn,
  prepSectionOfIn,
  prepTypeLabelIn,
} from "@/lib/homemade/types";

type ListRow =
  | { kind: "header"; key: string; sectionKey: string; count: number }
  | { kind: "item"; key: string; prep: HomemadePrep; isFirst: boolean; isLast: boolean }
  | { kind: "group"; key: string; preps: HomemadePrep[]; isFirst: boolean; isLast: boolean };

export default function HomemadeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ready, preps, importSamples, sections, types } = useHomemadeStore();
  const { bottles } = useBottleStore();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>("");
  // 多选筛选状态(统一筛选面板)
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [selTechniques, setSelTechniques] = useState<string[]>([]);
  const [sort, setSort] = useState<PrepSort>("default");
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 已展开的同名组 key 集合 */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => {
      let base = filterPreps(preps, query, undefined, section || undefined, types);
      if (selTypes.length > 0) base = base.filter((p) => selTypes.includes(p.type));
      if (selTechniques.length > 0) {
        base = base.filter((p) => {
          const tks = detectPrepTechniques(p);
          return selTechniques.some((k) => tks.includes(k));
        });
      }
      return base;
    },
    [preps, query, selTypes, section, types, selTechniques],
  );

  /** 成本函数(排序用):每 30ml 成本,退化为批次成本 */
  const costOf = useMemo(() => {
    const cache = new Map<string, number | null>();
    return (p: HomemadePrep): number | null => {
      if (cache.has(p.id)) return cache.get(p.id)!;
      const est = estimatePrepCost(p, bottles);
      const v =
        est && est.estimatedCount > 0 ? (est.costPer30Ml ?? est.batchCost ?? null) : null;
      cache.set(p.id, v);
      return v;
    };
  }, [bottles]);

  /** 排序后的列表(排序作用于分区内分组前的条目) */
  const sorted = useMemo(
    () =>
      sortPreps(filtered, sort, {
        costOf,
        nameOf: (p) => displayNames(p.name, p.nameAlt, lang).primary,
      }),
    [filtered, sort, costOf, lang],
  );

  // 分区筛选:仅显示库内实际存在的分区
  const usedSections = useMemo(() => {
    const present = new Set(preps.map((p) => prepSectionOfIn(types, p.type)));
    return sections.filter((s) => present.has(s.key));
  }, [preps, sections, types]);

  // 类型子筛选:选中分区后,显示该分区下库内存在的类型
  const usedTypes = useMemo(() => {
    const present = new Set(preps.map((p) => p.type));
    return types.filter(
      (pt) => present.has(pt.key) && (!section || pt.section === section),
    );
  }, [preps, section, types]);

  // 工艺筛选:仅显示库内实际识别出的工艺(按 TECHNIQUES 声明顺序)
  const usedTechniques = useMemo(() => {
    const present = new Set<string>();
    for (const p of preps) {
      for (const k of detectPrepTechniques(p)) present.add(k);
    }
    return TECHNIQUES.filter((tk) => present.has(tk.key));
  }, [preps]);

  /** 筛选面板维度定义:类型 + 工艺(分区保留在快捷 chip 行) */
  const dimensions: FilterDimension[] = [
    {
      key: "type",
      title: t("fs.dim.type"),
      options: usedTypes.map((pt) => ({
        value: pt.key,
        label: lang === "en" ? pt.en : pt.zh,
      })),
      selected: selTypes,
      onToggle: (v) =>
        setSelTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
    {
      key: "technique",
      title: t("fs.dim.technique"),
      options: usedTechniques.map((tk) => ({
        value: tk.key,
        label: lang === "en" ? tk.en : tk.zh,
      })),
      selected: selTechniques,
      onToggle: (v) =>
        setSelTechniques((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
  ];

  const activeFilterCount = selTypes.length + selTechniques.length;

  const clearAll = () => {
    setSelTypes([]);
    setSelTechniques([]);
    setSort("default");
  };

  // 按分区分组的行数据(分区标题 + 各分区内的 inset group)
  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    for (const s of sections) {
      const items = sorted.filter((p) => prepSectionOfIn(types, p.type) === s.key);
      if (items.length === 0) continue;
      // 同名折叠:分区内同名自制品折叠为一组
      const groups = groupPrepsByName(items);
      out.push({ kind: "header", key: `h-${s.key}`, sectionKey: s.key, count: items.length });
      groups.forEach((g, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === groups.length - 1;
        if (g.items.length > 1) {
          out.push({
            kind: "group",
            key: `g-${s.key}-${g.key}`,
            preps: g.items,
            isFirst,
            isLast,
          });
        } else {
          out.push({ kind: "item", key: g.items[0].id, prep: g.items[0], isFirst, isLast });
        }
      });
    }
    return out;
  }, [sorted, sections, types]);

  const handleAdd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/homemade-form");
  };

  const handleImport = () => {
    const n = importSamples();
    if (Platform.OS !== "web" && n > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primary : colors.surface,
      borderColor: active ? colors.primary : colors.border,
    },
  ];
  const chipTextStyle = (active: boolean) => [
    styles.chipText,
    { color: active ? "#FFFFFF" : colors.foreground },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-1 flex-row items-end">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-foreground">{t("hm.title")}</Text>
          <Text className="text-sm text-muted mt-1">{t("hm.subtitle", { n: preps.length })}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/prep-sections")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.manageBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="slider.horizontal.3" size={15} color={colors.primary} />
          <Text className="text-xs font-semibold" style={{ color: colors.primary, lineHeight: 16 }}>
            {t("psm.manage")}
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-5 mt-2">
        <View
          className="flex-row items-center bg-surface border border-border rounded-xl px-3"
          style={{ height: 44 }}
        >
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-base text-foreground"
            placeholder={t("hm.search.placeholder")}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={{ lineHeight: 20 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Section filter */}
      {usedSections.length > 0 ? (
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {/* 筛选与排序入口 */}
            <Pressable
              style={[
                styles.chip,
                styles.filterBtn,
                {
                  backgroundColor:
                    activeFilterCount > 0 || sort !== "default" ? colors.primary : colors.surface,
                  borderColor:
                    activeFilterCount > 0 || sort !== "default" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSheetOpen(true)}
            >
              <IconSymbol
                name="slider.horizontal.3"
                size={14}
                color={activeFilterCount > 0 || sort !== "default" ? "#FFFFFF" : colors.muted}
              />
              <Text style={chipTextStyle(activeFilterCount > 0 || sort !== "default")}>
                {t("fs.filterBtn")}
                {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </Text>
            </Pressable>
            <Pressable
              style={chipStyle(section === "")}
              onPress={() => {
                setSection("");
                setSelTypes([]);
              }}
            >
              <Text style={chipTextStyle(section === "")}>{t("home.filter.all")}</Text>
            </Pressable>
            {usedSections.map((s) => {
              const active = section === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={chipStyle(active)}
                  onPress={() => {
                    setSection(active ? "" : s.key);
                    setSelTypes([]);
                  }}
                >
                  <Text style={chipTextStyle(active)}>{lang === "en" ? s.en : s.zh}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 统一筛选与排序面板:类型 + 工艺多选、排序 */}
      <FilterSortSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dimensions={dimensions}
        sortOptions={PREP_SORTS.map((s) => ({ value: s, label: t(`sort.${s}` as "sort.default") }))}
        sortValue={sort}
        onSortChange={(v) => setSort(v as PrepSort)}
        onClearAll={clearAll}
        resultCount={filtered.length}
      />

      {ready && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -40 }}>
          <Text style={{ fontSize: 48, lineHeight: 64 }}>🧪</Text>
          <Text className="text-xl font-semibold text-foreground mt-3">
            {preps.length === 0 ? t("hm.empty.title") : t("hm.noMatch")}
          </Text>
          {preps.length === 0 ? (
            <>
              <Text className="text-sm text-muted text-center mt-2 leading-relaxed">
                {t("hm.empty.desc")}
              </Text>
              <Pressable
                onPress={handleImport}
                style={({ pressed }) => [
                  styles.importBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <IconSymbol name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.importBtnText}>{t("hm.empty.import")}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 90 + insets.bottom,
          }}
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <View style={styles.sectionHeader}>
                <Text
                  className="text-[13px] font-medium text-muted"
                  style={{ textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 18 }}
                >
                  {prepSectionLabelIn(sections, item.sectionKey, lang)} · {item.count}
                </Text>
              </View>
            ) : item.kind === "group" ? (
              <PrepGroupRow
                preps={item.preps}
                isFirst={item.isFirst}
                isLast={item.isLast}
                expanded={expandedGroups.has(item.key)}
                onToggle={() =>
                  setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  })
                }
                bottles={bottles}
              />
            ) : (
              <PrepRow prep={item.prep} isFirst={item.isFirst} isLast={item.isLast} bottles={bottles} />
            )
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, bottom: 20 },
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
      >
        <IconSymbol name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

function PrepRow({
  prep,
  isFirst,
  isLast,
  bottles,
}: {
  prep: HomemadePrep;
  isFirst: boolean;
  isLast: boolean;
  bottles: Bottle[];
}) {
  // (原有实现见下)
  return (
    <PrepRowInner prep={prep} isFirst={isFirst} isLast={isLast} bottles={bottles} />
  );
}

/** 同名自制品折叠组:组头显示名称与版本数,可展开;提供对比入口 */
function PrepGroupRow({
  preps,
  isFirst,
  isLast,
  expanded,
  onToggle,
  bottles,
}: {
  preps: HomemadePrep[];
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  bottles: Bottle[];
}) {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const head = preps[0];
  const names = displayNames(head.name, head.nameAlt, lang);

  const handleToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  const goCompare = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: "/compare",
      params: { type: "prep", ids: preps.map((p) => p.id).join(",") },
    });
  };

  return (
    <View>
      <Pressable onPress={handleToggle} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <View
          className="bg-surface px-4 py-3"
          style={[
            isFirst && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            isLast && !expanded && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
          ]}
        >
          <View className="flex-row items-center">
            <View className="flex-1 pr-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {names.primary}
                {names.secondary ? (
                  <Text className="text-xs font-normal text-muted">  {names.secondary}</Text>
                ) : null}
              </Text>
              <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                <View style={[styles.badge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    {t("group.versions", { n: preps.length })}
                  </Text>
                </View>
                <Pressable
                  onPress={goCompare}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.groupCompareBtn,
                    { borderColor: colors.primary + "66", backgroundColor: colors.primary + "10" },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <IconSymbol name="rectangle.split.2x1" size={11} color={colors.primary} />
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    {t("group.compare")}
                  </Text>
                </Pressable>
              </View>
            </View>
            <IconSymbol
              name={expanded ? "chevron.up" : "chevron.down"}
              size={16}
              color={colors.muted}
            />
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={[
            { borderLeftWidth: 3, borderLeftColor: colors.primary + "55" },
            isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: "hidden" },
          ]}
        >
          {preps.map((p, i) => (
            <PrepRowInner
              key={p.id}
              prep={p}
              isFirst={false}
              isLast={i === preps.length - 1 && isLast}
              bottles={bottles}
            />
          ))}
        </View>
      ) : null}
      {!isLast ? (
        <View className="bg-surface">
          <View className="bg-border" style={{ height: StyleSheet.hairlineWidth, marginLeft: 16 }} />
        </View>
      ) : null}
    </View>
  );
}

function PrepRowInner({
  prep,
  isFirst,
  isLast,
  bottles,
}: {
  prep: HomemadePrep;
  isFirst: boolean;
  isLast: boolean;
  bottles: Bottle[];
}) {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { types } = useHomemadeStore();
  const names = displayNames(prep.name, prep.nameAlt, lang);
  const cost = useMemo(() => estimatePrepCost(prep, bottles), [prep, bottles]);
  const tech = useMemo(() => primaryTechnique(prep), [prep]);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/homemade/[id]", params: { id: prep.id } })}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <View
        className="bg-surface px-4 py-3"
        style={[
          isFirst && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
          isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
        ]}
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-2">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {names.primary}
            </Text>
            {names.secondary ? (
              <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                {names.secondary}
              </Text>
            ) : null}
            <View className="flex-row items-center mt-1.5" style={{ gap: 6, flexWrap: "wrap" }}>
              <View style={[styles.badge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {prepTypeLabelIn(types, prep.type, lang)}
                </Text>
              </View>
              {tech ? (
                <View style={[styles.badge, { backgroundColor: colors.warning + "22" }]}>
                  <Text style={[styles.badgeText, { color: colors.warning }]}>
                    {techniqueLabel(tech, lang)}
                  </Text>
                </View>
              ) : null}
              {prep.shelfLife ? (
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {prep.shelfLife}
                </Text>
              ) : null}
              {cost.costPer30Ml !== null && cost.estimatedCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.success + "22" }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>
                    {t("hm.cost.perUnit", { n: cost.costPer30Ml.toFixed(1) })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.border} />
        </View>
      </View>
      {!isLast ? (
        <View className="bg-surface" style={{ height: StyleSheet.hairlineWidth }}>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
              marginLeft: 16,
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const subChipStyle = (
  active: boolean,
  colors: { primary: string; border: string },
) => [
  styles.subChip,
  {
    backgroundColor: active ? colors.primary + "1A" : "transparent",
    borderColor: active ? colors.primary : colors.border,
  },
];

const subChipTextStyle = (
  active: boolean,
  colors: { primary: string; muted: string },
) => [
  styles.subChipText,
  { color: active ? colors.primary : colors.muted },
];

const styles = StyleSheet.create({
  chipRowWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  subChipRowWrap: {
    marginBottom: 6,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subChip: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subChipText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 7,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  groupCompareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
    marginTop: 16,
  },
  importBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
