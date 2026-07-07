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
import { filterBottles, useBottleStore } from "@/lib/bottles/store";
import { sortBottles, BOTTLE_SORTS, BottleSort } from "@/lib/recipes/sort";
import {
  BOTTLE_CATEGORY_EN,
  BOTTLE_GROUPS,
  BOTTLE_STYLES,
  Bottle,
  bottleGroupOf,
  categoriesOfGroup,
} from "@/lib/bottles/types";

export default function BottlesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ready, bottles } = useBottleStore();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"bottles" | "materials">("bottles");
  // 多选筛选状态(统一筛选面板)
  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selStyles, setSelStyles] = useState<string[]>([]);
  const [sort, setSort] = useState<BottleSort>("default");
  const [sheetOpen, setSheetOpen] = useState(false);

  const groupBottles = useMemo(
    () => bottles.filter((b) => bottleGroupOf(b.category) === group),
    [bottles, group],
  );
  const filtered = useMemo(
    () => {
      let base = filterBottles(groupBottles, query, undefined, undefined);
      if (selCategories.length > 0) base = base.filter((b) => selCategories.includes(b.category));
      if (selStyles.length > 0) base = base.filter((b) => selStyles.includes(b.style));
      return base;
    },
    [groupBottles, query, selCategories, selStyles],
  );

  /** 排序后的列表 */
  const sorted = useMemo(
    () =>
      sortBottles(filtered, sort, {
        nameOf: (b) => (lang === "en" && b.nameEn ? b.nameEn : b.nameZh || b.nameEn),
      }),
    [filtered, sort, lang],
  );
  const groupCategories = useMemo(() => categoriesOfGroup(group), [group]);

  // 当前主分类下实际出现过的 style(预设顺序在前,库内自定义 style 追加在后)
  const styleOptions = useMemo(() => {
    // 面板中风格选项范围:已选类别下的风格;未选类别时为当前分组全部风格
    const scope =
      selCategories.length > 0
        ? groupBottles.filter((b) => selCategories.includes(b.category))
        : groupBottles;
    const present = new Set(scope.filter((b) => b.style).map((b) => b.style));
    const cats = selCategories.length > 0 ? selCategories : groupCategories;
    const preset = cats.flatMap((c) => BOTTLE_STYLES[c] ?? []).filter((s) => present.has(s));
    const extras = [...present].filter((s) => !preset.includes(s)).sort();
    return [...new Set([...preset, ...extras])];
  }, [groupBottles, selCategories, groupCategories]);

  /** 筛选面板维度定义 */
  const dimensions: FilterDimension[] = [
    {
      key: "category",
      title: t("fs.dim.category"),
      options: groupCategories.map((c) => ({
        value: c,
        label: lang === "en" ? BOTTLE_CATEGORY_EN[c] ?? c : c,
      })),
      selected: selCategories,
      onToggle: (v) =>
        setSelCategories((prev) => {
          const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
          // 类别变化时,清掉不再属于可选范围的风格
          setSelStyles((sPrev) => sPrev.filter((s) => {
            const cats = next.length > 0 ? next : groupCategories;
            return cats.some((c) => (BOTTLE_STYLES[c] ?? []).includes(s)) ||
              groupBottles.some((b) => b.style === s && cats.includes(b.category));
          }));
          return next;
        }),
    },
    {
      key: "style",
      title: t("fs.dim.style"),
      options: styleOptions.map((s) => ({ value: s, label: s })),
      selected: selStyles,
      onToggle: (v) =>
        setSelStyles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
  ];

  const activeFilterCount = selCategories.length + selStyles.length;

  const clearAll = () => {
    setSelCategories([]);
    setSelStyles([]);
    setSort("default");
  };

  const handleAdd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(
      group === "materials"
        ? { pathname: "/bottle-form", params: { category: "原材料" } }
        : "/bottle-form",
    );
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
      <View className="px-5 pt-2 pb-1">
        <Text className="text-3xl font-bold text-foreground">{t("bottles.title")}</Text>
        <Text className="text-sm text-muted mt-1">
          {group === "materials"
            ? t("bottles.subtitle.materials", { n: groupBottles.length })
            : t("bottles.subtitle", { n: groupBottles.length })}
        </Text>
      </View>

      {/* Group segmented control: 酒款库 / 原材料库 */}
      <View className="px-5 mt-2">
        <View
          className="flex-row bg-surface border border-border rounded-xl p-1"
          style={{ gap: 4 }}
        >
          {BOTTLE_GROUPS.map((g) => {
            const active = group === g.key;
            return (
              <Pressable
                key={g.key}
                onPress={() => {
                  if (group !== g.key) {
                    setGroup(g.key);
                    setSelCategories([]);
                    setSelStyles([]);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }
                }}
                style={[
                  styles.segment,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? "#FFFFFF" : colors.muted },
                  ]}
                >
                  {lang === "en" ? g.en : g.zh}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
            placeholder={t("bottles.search.placeholder")}
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

      {/* Category filter */}
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
          <Pressable style={chipStyle(selCategories.length === 0)} onPress={() => setSelCategories([])}>
            <Text style={chipTextStyle(selCategories.length === 0)}>{t("home.filter.all")}</Text>
          </Pressable>
          {groupCategories.map((cat) => {
            const active = selCategories.includes(cat);
            return (
              <Pressable
                key={cat}
                style={chipStyle(active)}
                onPress={() =>
                  setSelCategories((prev) =>
                    prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat],
                  )
                }
              >
                <Text style={chipTextStyle(active)}>
                  {lang === "en" ? BOTTLE_CATEGORY_EN[cat] ?? cat : cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 统一筛选与排序面板 */}
      <FilterSortSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dimensions={dimensions}
        sortOptions={BOTTLE_SORTS.map((s) => ({ value: s, label: t(`sort.${s}` as "sort.default") }))}
        sortValue={sort}
        onSortChange={(v) => setSort(v as BottleSort)}
        onClearAll={clearAll}
        resultCount={filtered.length}
      />

      {ready && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -40 }}>
          <Text style={{ fontSize: 48, lineHeight: 64 }}>🍾</Text>
          <Text className="text-xl font-semibold text-foreground mt-3">
            {bottles.length === 0 ? t("bottles.empty.title") : t("bottles.noMatch.title")}
          </Text>
          <Text className="text-sm text-muted text-center mt-2 leading-relaxed">
            {bottles.length === 0 ? t("bottles.empty.desc") : t("bottles.noMatch.desc")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 90 + insets.bottom,
          }}
          renderItem={({ item, index }) => (
            <BottleCard
              bottle={item}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: 20 + (Platform.OS === "web" ? 0 : 0),
          },
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
      >
        <IconSymbol name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

function BottleCard({
  bottle,
  isFirst,
  isLast,
}: {
  bottle: Bottle;
  isFirst: boolean;
  isLast: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/bottle/[id]", params: { id: bottle.id } })}
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
              {lang === "en" && bottle.nameEn ? bottle.nameEn : bottle.nameZh}
            </Text>
            {(lang === "en" ? bottle.nameZh : bottle.nameEn) ? (
              <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                {lang === "en" ? bottle.nameZh : bottle.nameEn}
              </Text>
            ) : null}
            <View className="flex-row items-center mt-1.5" style={{ gap: 6, flexWrap: "wrap" }}>
              <View
                style={[styles.badge, { backgroundColor: colors.primary + "22" }]}
              >
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {lang === "en" ? BOTTLE_CATEGORY_EN[bottle.category] ?? bottle.category : bottle.category}
                </Text>
              </View>
              {bottle.volume ? (
                <Text className="text-xs text-muted">{bottle.volume}</Text>
              ) : null}
              {bottle.style ? (
                <View style={[styles.badge, { backgroundColor: colors.muted + "22" }]}>
                  <Text style={[styles.badgeText, { color: colors.muted }]}>{bottle.style}</Text>
                </View>
              ) : null}
              <Text className="text-xs text-muted">{bottle.abv}% vol</Text>
            </View>
          </View>
          <View className="items-end">
            {bottle.priceCny > 0 ? (
              <>
                <Text className="text-lg font-bold text-foreground">
                  ¥{bottle.priceCny}
                </Text>
                <Text className="text-[10px] text-muted">{t("bottles.price.ref")}</Text>
              </>
            ) : (
              <Text className="text-xs text-muted">{t("bottles.price.unknown")}</Text>
            )}
          </View>
          <View style={{ marginLeft: 8 }}>
            <IconSymbol name="chevron.right" size={16} color={colors.border} />
          </View>
        </View>
      </View>
      {!isLast ? (
        <View
          className="bg-surface"
          style={{
            height: StyleSheet.hairlineWidth,
          }}
        >
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

const styles = StyleSheet.create({
  chipRowWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  segment: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
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
