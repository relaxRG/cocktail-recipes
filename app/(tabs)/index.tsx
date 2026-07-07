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

import { RecipeCard } from "@/components/recipe-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { filterRecipes } from "@/lib/recipes/search";
import { useRecipeStore } from "@/lib/recipes/store";
import { CODEX_FAMILIES } from "@/lib/recipes/types";

type Filter = { type: "all" } | { type: "favorites" } | { type: "category"; id: string };

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { ready, recipes, categories, importSamples, tagsOf } = useRecipeStore();
  const flavorTags = tagsOf("flavor");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [codexFilter, setCodexFilter] = useState<string>("");
  const [flavorFilter, setFlavorFilter] = useState<string>("");

  const filtered = useMemo(
    () =>
      filterRecipes(recipes, query, {
        categoryId: filter.type === "category" ? filter.id : undefined,
        favoritesOnly: filter.type === "favorites",
        codexFamily: codexFilter || undefined,
        flavor: flavorFilter || undefined,
      }),
    [recipes, query, filter, codexFilter, flavorFilter],
  );

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
            const active = filter.type === "category" && filter.id === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  chipStyle(active),
                  active && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setFilter({ type: "category", id: cat.id })}
              >
                <Text style={chipTextStyle(active)}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Codex + flavor secondary filter row */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CODEX_FAMILIES.map((fam) => {
            const active = codexFilter === fam;
            return (
              <Pressable
                key={fam}
                style={chipStyle(active)}
                onPress={() => setCodexFilter(active ? "" : fam)}
              >
                <Text style={chipTextStyle(active)}>{fam.split(" ")[0]}</Text>
              </Pressable>
            );
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {flavorTags.map((tag) => {
            const active = flavorFilter === tag.name;
            return (
              <Pressable
                key={tag.id}
                style={[
                  chipStyle(active),
                  active && { backgroundColor: tag.color, borderColor: tag.color },
                ]}
                onPress={() => setFlavorFilter(active ? "" : tag.name)}
              >
                <Text style={chipTextStyle(active)}>{tag.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <RecipeCard
              recipe={item}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
            />
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
