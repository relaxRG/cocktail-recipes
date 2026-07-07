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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { filterBottles, useBottleStore } from "@/lib/bottles/store";
import { BOTTLE_CATEGORIES, BOTTLE_CATEGORY_EN, BOTTLE_STYLES, Bottle } from "@/lib/bottles/types";

export default function BottlesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ready, bottles } = useBottleStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [style, setStyle] = useState<string>("");

  const filtered = useMemo(
    () => filterBottles(bottles, query, category || undefined, style || undefined),
    [bottles, query, category, style],
  );

  // 当前主分类下实际出现过的 style(预设顺序在前,库内自定义 style 追加在后)
  const styleOptions = useMemo(() => {
    if (!category) return [] as string[];
    const present = new Set(
      bottles.filter((b) => b.category === category && b.style).map((b) => b.style),
    );
    const preset = (BOTTLE_STYLES[category] ?? []).filter((s) => present.has(s));
    const extras = [...present].filter((s) => !preset.includes(s)).sort();
    return [...preset, ...extras];
  }, [bottles, category]);

  const handleAdd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/bottle-form");
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
          {t("bottles.subtitle", { n: bottles.length })}
        </Text>
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
            <Pressable style={chipStyle(category === "")} onPress={() => setCategory("")}>
              {/* 切换主分类时清空子分类 */}
              <Text style={chipTextStyle(category === "")}>{t("home.filter.all")}</Text>
            </Pressable>
            {BOTTLE_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={chipStyle(active)}
                  onPress={() => {
                    setCategory(active ? "" : cat);
                    setStyle("");
                  }}
                >
                  <Text style={chipTextStyle(active)}>
                    {lang === "en" ? BOTTLE_CATEGORY_EN[cat] ?? cat : cat}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
      </View>

      {/* Style sub-category filter (visible when a main category is selected) */}
      {category && styleOptions.length > 0 ? (
        <View style={styles.subChipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable style={subChipStyle(style === "", colors)} onPress={() => setStyle("")}>
              <Text style={subChipTextStyle(style === "", colors)}>
                {t("bottles.style.all")}
              </Text>
            </Pressable>
            {styleOptions.map((s) => {
              const active = style === s;
              return (
                <Pressable
                  key={s}
                  style={subChipStyle(active, colors)}
                  onPress={() => setStyle(active ? "" : s)}
                >
                  <Text style={subChipTextStyle(active, colors)}>{s}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
          data={filtered}
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
              isLast={index === filtered.length - 1}
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

const subChipStyle = (
  active: boolean,
  colors: { primary: string; surface: string; border: string },
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
