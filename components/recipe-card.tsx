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
import { useCardTagSettings, DEFAULT_CARD_TAG_SETTINGS } from "@/lib/settings/card-tags";

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
  const { toggleFavorite, toggleMade, getCategory, tagsOf } = useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps } = useHomemadeStore();
  const [cardTagSettings] = useCardTagSettings();
  const category = getCategory(recipe.categoryId);
  const flavorTagsData = tagsOf("flavor");

  /** Resolve visible slots: per-recipe override takes priority, else global settings */
  const visibleSlots: CardTagSlot[] = useMemo(() => {
    if (recipe.cardTagOrder) return recipe.cardTagOrder;
    const order = cardTagSettings.recipeCardSlotOrder?.length
      ? cardTagSettings.recipeCardSlotOrder
      : DEFAULT_CARD_TAG_SETTINGS.recipeCardSlotOrder;
    const hidden = cardTagSettings.recipeCardSlotHidden ?? [];
    return order.filter((s) => !hidden.includes(s));
  }, [recipe.cardTagOrder, cardTagSettings]);

  const customColors = cardTagSettings.recipeCardColors ?? {};

  /** Single杯成本估算 */
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

  /** Render a single slot badge. Returns null if nothing to show. */
  const renderSlot = (slot: CardTagSlot): React.ReactNode => {
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

    if (slot === "flavors") {
      if (recipe.flavors.length === 0) return null;
      const maxFlavors = cardTagSettings.maxTagsPerCard > 0 ? cardTagSettings.maxTagsPerCard : 3;
      const visible = recipe.flavors.slice(0, Math.min(maxFlavors, 3));
      const slotColorOverride = customColors.flavors;
      return (
        <React.Fragment key="flavors">
          {visible.map((f) => {
            const tagColor = slotColorOverride ?? (flavorTagsData.find((tg) => tg.name === f)?.color ?? "#FF9500");
            return (
              <Pressable
                key={f}
                onPress={() => handleTagPress("flavor", f)}
                hitSlop={4}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[styles.pill, { backgroundColor: tagColor + "22" }]}>
                  <Text style={[styles.pillText, { fontWeight: "500", color: tagColor }]}>{f}</Text>
                </View>
              </Pressable>
            );
          })}
        </React.Fragment>
      );
    }

    if (slot === "strength") {
      const color = customColors.strength;
      if (color) {
        return (
          <View key="strength" style={[styles.pill, { backgroundColor: color + "22" }]}>
            <Text style={[styles.pillText, { color }]}>
              {lang === "en" ? t(`strength.${recipe.strength}`) : STRENGTH_LABELS[recipe.strength]}
            </Text>
          </View>
        );
      }
      return (
        <Pressable
          key="strength"
          onPress={() => handleTagPress("strength", recipe.strength)}
          hitSlop={4}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.pill, styles.pillBorder, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.muted }]}>
              {lang === "en" ? t(`strength.${recipe.strength}`) : STRENGTH_LABELS[recipe.strength]}
            </Text>
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
          <IconSymbol name="star.fill" size={11} color={color} />
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-1.5"
              style={{ height: 24 }}
              contentContainerStyle={{ alignItems: "center", gap: 6 }}
            >
              {visibleSlots.map((slot) => renderSlot(slot))}
            </ScrollView>
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
});
