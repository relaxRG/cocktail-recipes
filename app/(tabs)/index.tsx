import { router } from "expo-router";
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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RecipeGroupCard } from "@/components/recipe-group-card";
import { SwipeableRecipeRow } from "@/components/swipeable-recipe-row";
import { ScreenContainer } from "@/components/screen-container";
import { FilterSortSheet, FilterDimension } from "@/components/filter-sort-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { filterRecipes } from "@/lib/recipes/search";
import { groupRecipesByName } from "@/lib/recipes/grouping";
import { sortRecipes, RECIPE_SORTS, RecipeSort } from "@/lib/recipes/sort";
import { estimateRecipeCost } from "@/lib/bottles/cost";
import { estimateHomemadeIngredientCost } from "@/lib/homemade/cost";
import { useBottleStore } from "@/lib/bottles/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useRecipeStore } from "@/lib/recipes/store";
import {
  CODEX_FAMILIES,
  Recipe,
  STRENGTH_LABELS,
  STRENGTHS,
  codexFamilyLabel,
} from "@/lib/recipes/types";

type Filter = { type: "all" } | { type: "favorites" } | { type: "category"; id: string };

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { ready, recipes, categories, importSamples, tagsOf } = useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps } = useHomemadeStore();
  const flavorTags = tagsOf("flavor");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  // 多选筛选状态
  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selCodex, setSelCodex] = useState<string[]>([]);
  const [selFlavors, setSelFlavors] = useState<string[]>([]);
  const [selStrengths, setSelStrengths] = useState<string[]>([]);
  const [sort, setSort] = useState<RecipeSort>("default");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(
    () =>
      filterRecipes(recipes, query, {
        favoritesOnly: filter.type === "favorites",
        categoryIds:
          filter.type === "category" ? [filter.id] : selCategories.length > 0 ? selCategories : undefined,
        codexFamilies: selCodex.length > 0 ? selCodex : undefined,
        flavors: selFlavors.length > 0 ? selFlavors : undefined,
        strengths: selStrengths.length > 0 ? selStrengths : undefined,
      }),
    [recipes, query, filter, selCategories, selCodex, selFlavors, selStrengths],
  );

  /** 成本函数(排序用),与卡片口径一致 */
  const costOf = useMemo(() => {
    const cache = new Map<string, number | null>();
    return (r: Recipe): number | null => {
      if (cache.has(r.id)) return cache.get(r.id)!;
      let v: number | null = null;
      if (r.ingredients.length > 0) {
        const base = estimateRecipeCost(r.ingredients, bottles);
        let total = base.total;
        let count = base.estimatedCount;
        for (const item of base.items) {
          if (item.cost === null && item.reason === "no_bottle") {
            const hm = estimateHomemadeIngredientCost(
              item.ingredient.name,
              item.ingredient.amount,
              preps,
              bottles,
            );
            if (hm) {
              total += hm.cost;
              count += 1;
            }
          }
        }
        v = count > 0 ? total : null;
      }
      cache.set(r.id, v);
      return v;
    };
  }, [bottles, preps]);

  /** 排序后再同名折叠 */
  const sorted = useMemo(
    () =>
      sortRecipes(filtered, sort, {
        costOf,
        nameOf: (r) => displayNames(r.nameEn, r.name, lang).primary,
      }),
    [filtered, sort, costOf, lang],
  );

  /** 同名折叠:同一鸡尾酒的多个版本折叠为一组 */
  const grouped = useMemo(() => groupRecipesByName(sorted), [sorted]);

  /** 筛选面板维度定义 */
  const dimensions: FilterDimension[] = [
    {
      key: "category",
      title: t("fs.dim.category"),
      options: categories.map((c) => ({
        value: c.id,
        label: displayNames(c.nameEn ?? "", c.name, lang).primary,
        color: c.color,
      })),
      selected: selCategories,
      onToggle: (v) =>
        setSelCategories((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
    {
      key: "strength",
      title: t("fs.dim.strength"),
      options: STRENGTHS.map((s) => ({
        value: s,
        label: lang === "en" ? t(`strength.${s}` as "strength.light") : STRENGTH_LABELS[s],
      })),
      selected: selStrengths,
      onToggle: (v) =>
        setSelStrengths((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
    {
      key: "codex",
      title: t("fs.dim.codex"),
      options: CODEX_FAMILIES.map((f) => ({ value: f, label: codexFamilyLabel(f, lang) })),
      selected: selCodex,
      onToggle: (v) =>
        setSelCodex((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
    {
      key: "flavor",
      title: t("fs.dim.flavor"),
      options: flavorTags.map((tag) => ({
        value: tag.name,
        label: displayNames(tag.nameEn ?? "", tag.name, lang).primary,
        color: tag.color,
      })),
      selected: selFlavors,
      onToggle: (v) =>
        setSelFlavors((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])),
    },
  ];

  const activeFilterCount =
    selCategories.length + selCodex.length + selFlavors.length + selStrengths.length;

  const clearAll = () => {
    setSelCategories([]);
    setSelCodex([]);
    setSelFlavors([]);
    setSelStrengths([]);
    setSort("default");
  };

  const handleAdd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/recipe-form");
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
    { color: active ? "#FFFFFF" : colors.muted },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-3 flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-foreground">{t("home.title")}</Text>
          <Text className="text-sm text-muted mt-1">
            {recipes.length > 0
              ? t("home.subtitle.count", { n: recipes.length })
              : t("home.subtitle.empty")}
          </Text>
        </View>
        <Pressable
          onPress={() => setLang(lang === "zh" ? "en" : "zh")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.langBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.langBtnText, { color: colors.primary }]}>
            {lang === "zh" ? "EN" : "中"}
          </Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View className="px-5 pb-3">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-3">
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            className="flex-1 py-2.5 px-2 text-base text-foreground"
            placeholder={t("home.search.placeholder")}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter chips */}
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
                backgroundColor: activeFilterCount > 0 || sort !== "default" ? colors.primary : colors.surface,
                borderColor: activeFilterCount > 0 || sort !== "default" ? colors.primary : colors.border,
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
          <Pressable style={chipStyle(filter.type === "all")} onPress={() => setFilter({ type: "all" })}>
            <Text style={chipTextStyle(filter.type === "all")}>{t("home.filter.all")}</Text>
          </Pressable>
          <Pressable
            style={chipStyle(filter.type === "favorites")}
            onPress={() => setFilter({ type: "favorites" })}
          >
            <Text style={chipTextStyle(filter.type === "favorites")}>{t("home.filter.favorites")}</Text>
          </Pressable>
          {categories.map((cat) => {
            const active =
              (filter.type === "category" && filter.id === cat.id) || selCategories.includes(cat.id);
            return (
              <Pressable
                key={cat.id}
                style={[
                  chipStyle(active),
                  active && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => {
                  // chip 快捷单选与面板多选联动:点击切换该分类的选中状态
                  setFilter({ type: "all" });
                  setSelCategories((prev) =>
                    prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id],
                  );
                }}
              >
                <Text style={chipTextStyle(active)}>
                  {displayNames(cat.nameEn ?? "", cat.name, lang).primary}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 筛选与排序面板 */}
      <FilterSortSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dimensions={dimensions}
        sortOptions={RECIPE_SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) }))}
        sortValue={sort}
        onSortChange={(v) => setSort(v as RecipeSort)}
        onClearAll={clearAll}
        resultCount={filtered.length}
      />

      {/* Recipe list */}
      {ready && recipes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -40 }}>
          <Text style={{ fontSize: 56, lineHeight: 72 }}>🍸</Text>
          <Text className="text-xl font-semibold text-foreground mt-3">{t("home.empty.title")}</Text>
          <Text className="text-sm text-muted text-center mt-2 leading-relaxed">
            {t("home.empty.desc")}
          </Text>
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary },
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>{t("home.empty.add")}</Text>
          </Pressable>
          <Pressable
            onPress={importSamples}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.ghostBtnText, { color: colors.primary }]}>{t("home.empty.import")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.items[0].id}
          renderItem={({ item, index }) => (
            item.items.length > 1 ? (
              <RecipeGroupCard
                recipes={item.items}
                isFirst={index === 0}
                isLast={index === grouped.length - 1}
              />
            ) : (
              <SwipeableRecipeRow
                recipe={item.items[0]}
                isFirst={index === 0}
                isLast={index === grouped.length - 1}
              />
            )
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 100 + insets.bottom,
          }}
          ListEmptyComponent={
            ready ? (
              <View className="items-center pt-16 px-8">
                <Text className="text-base text-muted text-center">
                  {t("home.noMatch")}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Floating add button */}
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, bottom: 24 },
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
      >
        <IconSymbol name="plus" size={28} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipRowWrap: {
    marginBottom: 8,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
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
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 2,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
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
    elevation: 5,
  },
  primaryBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  ghostBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});
