import { router } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { VariantBadge } from "@/components/variant-badge";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { estimateRecipeCostSmart } from "@/lib/recipes/smart-cost";
import { useBottleStore } from "@/lib/bottles/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useRecipeStore } from "@/lib/recipes/store";
import {
  Recipe,
  STRENGTH_LABELS,
  CARD_TAG_SLOTS,
  CardTagSlot,
  codexFamilyLabel,
  localizedTagName,
} from "@/lib/recipes/types";
import {
  useCardTagSettings,
  DEFAULT_CARD_TAG_SETTINGS,
  getFlavorTagConfig,
  FLAVOR_TAG_DEFAULT_COLORS,
} from "@/lib/settings/card-tags";

const METHOD_LABELS: Record<string, string> = {
  stirred: "搅拌",
  shaken: "摇荡",
  built: "直调",
  blended: "冰沙",
  thrown: "抛接",
};

/** 第一排优先级槽位顺序（不含 flavors，风味标签单独处理） */
const ROW1_PRIORITY: CardTagSlot[] = [
  "category",
  "codexFamily",
  "baseSpirit",
  "strength",
  "rating",
  "cost",
];

export function RecipeCard({
  recipe,
  isFirst = true,
  isLast = true,
  onTagPress,
}: {
  recipe: Recipe;
  isFirst?: boolean;
  isLast?: boolean;
  /** Called when a filterable tag badge is tapped. type = "flavor"|"baseSpirit"|"codexFamily"|"strength"|"category" */
  onTagPress?: (type: string, value: string) => void;
}) {
  const colors = useColors();
  const { t, lang } = useI18n();
  const { toggleFavorite, toggleMade, getCategory } = useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps } = useHomemadeStore();
  const [cardTagSettings] = useCardTagSettings();
  const category = getCategory(recipe.categoryId);

  const customColors = cardTagSettings.recipeCardColors ?? {};
  const flavorConfigs = cardTagSettings.flavorTagConfigs ?? {};
  const hidden = cardTagSettings.recipeCardSlotHidden ?? [];

  /** 单杯成本估算 */
  const costTotal = useMemo(() => {
    if (recipe.ingredients.length === 0) return null;
    const est = estimateRecipeCostSmart(recipe.ingredients, bottles, preps);
    return est.estimatedCount > 0 ? est.total : null;
  }, [recipe.ingredients, bottles, preps]);

  const ingredientSummary = recipe.ingredients
    .map((i) => i.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFavorite = () => {
    haptic();
    toggleFavorite(recipe.id);
  };

  const handleMade = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        recipe.made ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      );
    }
    toggleMade(recipe.id);
  };

  const handleTagPress = (type: string, value: string) => {
    if (!onTagPress) return;
    haptic();
    onTagPress(type, value);
  };

  /** 渲染单个槽位 badge（不含 flavors） */
  const renderSlot = (slot: CardTagSlot): React.ReactNode => {
    if (hidden.includes(slot)) return null;

    if (slot === "category") {
      if (!category) return null;
      const color = customColors.category ?? category.color;
      return (
        <Pressable
          key="category"
          onPress={() => handleTagPress("category", category.id)}
          hitSlop={4}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.pill, { backgroundColor: color + "22" }]}>
            <Text style={[styles.pillText, { fontWeight: "600", color }]}>
              {localizedTagName(category.name, category.nameEn, lang)}
            </Text>
          </View>
        </Pressable>
      );
    }

    if (slot === "codexFamily") {
      if (!recipe.codexFamily) return null;
      const color = customColors.codexFamily ?? colors.primary;
      return (
        <Pressable
          key="codexFamily"
          onPress={() => handleTagPress("codexFamily", recipe.codexFamily)}
          hitSlop={4}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.pill, styles.pillBorder, { borderColor: color + "66", backgroundColor: color + "12" }]}>
            <Text style={[styles.pillText, { color }]}>
              {codexFamilyLabel(recipe.codexFamily, lang)}
            </Text>
          </View>
        </Pressable>
      );
    }

    if (slot === "baseSpirit") {
      if (!recipe.baseSpirit) return null;
      const color = customColors.baseSpirit;
      if (color) {
        return (
          <Pressable
            key="baseSpirit"
            onPress={() => handleTagPress("baseSpirit", recipe.baseSpirit)}
            hitSlop={4}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.pill, { backgroundColor: color + "22" }]}>
              <Text style={[styles.pillText, { color }]}>{localizedTagName(recipe.baseSpirit, "", lang)}</Text>
            </View>
          </Pressable>
        );
      }
      return (
        <Pressable
          key="baseSpirit"
          onPress={() => handleTagPress("baseSpirit", recipe.baseSpirit)}
          hitSlop={4}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.pill, styles.pillBorder, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.muted }]}>{localizedTagName(recipe.baseSpirit, "", lang)}</Text>
          </View>
        </Pressable>
      );
    }

    if (slot === "strength") {
      if (!recipe.strength) return null;
      const color = customColors.strength;
      const label = lang === "en" ? t(`strength.${recipe.strength}` as "strength.light") : STRENGTH_LABELS[recipe.strength];
      if (!label) return null;
      // 语义颜色：轻=绿，中=橙，强=红
      const semanticColor =
        color ??
        (recipe.strength === "light" ? "#34C759" : recipe.strength === "strong" ? "#FF3B30" : "#FF9500");
      return (
        <Pressable
          key="strength"
          onPress={() => handleTagPress("strength", recipe.strength)}
          hitSlop={4}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.pill, { backgroundColor: semanticColor + "20" }]}>
            <Text style={[styles.pillText, { color: semanticColor }]}>{label}</Text>
          </View>
        </Pressable>
      );
    }

    if (slot === "rating") {
      if (!recipe.rating) return null;
      const color = customColors.rating ?? "#F5A623";
      return (
        <View
          key="rating"
          style={[styles.pill, styles.pillBorder, { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <IconSymbol name="star.fill" size={10} color={color} />
          <Text style={[styles.pillText, { color: colors.muted }]}>{recipe.rating}/10</Text>
        </View>
      );
    }

    if (slot === "cost") {
      if (costTotal === null) return null;
      const color = customColors.cost;
      if (color) {
        return (
          <View key="cost" style={[styles.pill, { backgroundColor: color + "22" }]}>
            <Text style={[styles.pillText, { color }]}>≈¥{costTotal.toFixed(1)}</Text>
          </View>
        );
      }
      return (
        <View key="cost" style={[styles.pill, styles.pillBorder, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.pillText, { color: colors.muted }]}>≈¥{costTotal.toFixed(1)}</Text>
        </View>
      );
    }

    return null;
  };

  /** 渲染风味标签 badge */
  const renderFlavorBadge = (f: string, small = false) => {
    const cfg = getFlavorTagConfig(f, flavorConfigs);
    const tagColor = customColors.flavors ?? cfg.color ?? FLAVOR_TAG_DEFAULT_COLORS[f] ?? "#FF9500";
    const pillStyle = small ? styles.pillSmall : styles.pill;
    const textStyle = small ? styles.pillTextSmall : styles.pillText;
    return (
      <Pressable
        key={`flavor:${f}`}
        onPress={() => handleTagPress("flavor", f)}
        hitSlop={4}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[pillStyle, { backgroundColor: tagColor + (small ? "18" : "22") }]}>
          <Text style={[textStyle, { fontWeight: "500", color: tagColor + (small ? "CC" : "") }]}>{f}</Text>
        </View>
      </Pressable>
    );
  };

  // ── 计算两排内容 ──────────────────────────────────────────────
  const visibleFlavors = recipe.flavors.filter((f) => getFlavorTagConfig(f, flavorConfigs).visible);
  const row1Flavors = visibleFlavors.filter((f) => getFlavorTagConfig(f, flavorConfigs).row === 1);
  const row2Flavors = visibleFlavors.filter((f) => getFlavorTagConfig(f, flavorConfigs).row === 2);
  const methodLabel = METHOD_LABELS[recipe.method] ?? "";
  const hasRow2 = row2Flavors.length > 0 || !!methodLabel;

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.7 }]}
    >
      <View
        className="bg-surface px-4 py-3"
        style={[
          isFirst && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
          isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
        ]}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            {(() => {
              const dn = displayNames(recipe.nameEn, recipe.name, lang);
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ height: 24 }}
                  contentContainerStyle={{ alignItems: "baseline", gap: 6 }}
                >
                  <Text className="text-base font-semibold text-foreground" style={{ lineHeight: 22 }}>
                    {dn.primary}
                  </Text>
                  {dn.secondary ? (
                    <Text className="text-xs text-muted" style={{ lineHeight: 22 }}>
                      {dn.secondary}
                    </Text>
                  ) : null}
                </ScrollView>
              );
            })()}
            <View className="mt-0.5">
              <VariantBadge recipe={recipe} mode="compact" />
            </View>

            {/* ── 第一排：优先级槽位 + row=1 风味标签（最多5个）── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-1.5"
              style={{ height: 24 }}
              contentContainerStyle={{ alignItems: "center", gap: 6 }}
            >
              {(() => {
                const items: React.ReactNode[] = [];
                for (const slot of ROW1_PRIORITY) {
                  if (items.length >= 5) break;
                  const node = renderSlot(slot);
                  if (node) items.push(node);
                }
                for (const f of row1Flavors) {
                  if (items.length >= 5) break;
                  items.push(renderFlavorBadge(f, false));
                }
                return items;
              })()}
            </ScrollView>

            {/* ── 第二排：row=2 风味标签 + 制作方法（最多3个，有内容才显示）── */}
            {hasRow2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-1"
                style={{ height: 22 }}
                contentContainerStyle={{ alignItems: "center", gap: 5 }}
              >
                {(() => {
                  const items: React.ReactNode[] = [];
                  for (const f of row2Flavors) {
                    if (items.length >= 3) break;
                    items.push(renderFlavorBadge(f, true));
                  }
                  if (items.length < 3 && methodLabel) {
                    items.push(
                      <View key="method" style={[styles.pillSmall, styles.pillBorder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.pillTextSmall, { color: colors.muted }]}>{methodLabel}</Text>
                      </View>
                    );
                  }
                  return items;
                })()}
              </ScrollView>
            )}
          </View>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <Pressable
              onPress={handleMade}
              hitSlop={10}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <IconSymbol
                name={recipe.made ? "checkmark.circle.fill" : "checkmark.circle"}
                size={24}
                color={recipe.made ? colors.success : colors.muted}
              />
            </Pressable>
            <Pressable
              onPress={handleFavorite}
              hitSlop={10}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <IconSymbol
                name={recipe.favorite ? "star.fill" : "star"}
                size={24}
                color={recipe.favorite ? colors.primary : colors.muted}
              />
            </Pressable>
          </View>
        </View>
        <Text className="text-sm text-muted mt-2" numberOfLines={1} style={{ height: 20 }}>
          {ingredientSummary || " "}
        </Text>
      </View>
      {!isLast ? (
        <View className="bg-surface">
          <View
            className="bg-border"
            style={{ height: StyleSheet.hairlineWidth, marginLeft: 16 }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 0,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillBorder: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 11,
    lineHeight: 15,
  },
  pillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillTextSmall: {
    fontSize: 10,
    lineHeight: 14,
  },
});
