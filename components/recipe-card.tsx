import { router } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { estimateRecipeCost } from "@/lib/bottles/cost";
import { estimateHomemadeIngredientCost } from "@/lib/homemade/cost";
import { useBottleStore } from "@/lib/bottles/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useRecipeStore } from "@/lib/recipes/store";
import {
  Recipe,
  STRENGTH_LABELS,
  STRENGTH_BAND_LABELS,
  codexFamilyLabel,
  localizedTagName,
} from "@/lib/recipes/types";

export function RecipeCard({
  recipe,
  isFirst = true,
  isLast = true,
}: {
  recipe: Recipe;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const colors = useColors();
  const { t, lang } = useI18n();
  const { toggleFavorite, toggleMade, getCategory } = useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps } = useHomemadeStore();
  const category = getCategory(recipe.categoryId);

  /** 单杯成本估算(酒库匹配 + 自制库兜底),与详情页口径一致 */
  const costTotal = useMemo(() => {
    if (recipe.ingredients.length === 0) return null;
    const base = estimateRecipeCost(recipe.ingredients, bottles);
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
    return count > 0 ? total : null;
  }, [recipe.ingredients, bottles, preps]);

  const ingredientSummary = recipe.ingredients
    .map((i) => i.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");

  const handleFavorite = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
                <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                  {dn.primary}
                  {dn.secondary ? (
                    <Text className="text-sm font-normal text-muted">  {dn.secondary}</Text>
                  ) : null}
                </Text>
              );
            })()}
            <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 6 }}>
              {category ? (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: category.color + "22" }}
                >
                  <Text className="text-xs font-medium" style={{ color: category.color }}>
                    {localizedTagName(category.name, category.nameEn, lang)}
                  </Text>
                </View>
              ) : null}
              <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                <Text className="text-xs text-muted">
                  {localizedTagName(recipe.baseSpirit, "", lang)}
                </Text>
              </View>
              <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                <Text className="text-xs text-muted">
                  {lang === "en" ? t(`strength.${recipe.strength}`) : STRENGTH_LABELS[recipe.strength]}
                  {recipe.abv !== null && recipe.abv !== undefined
                    ? ` ≈${recipe.abv}%`
                    : recipe.strengthBand
                      ? ` ${STRENGTH_BAND_LABELS[recipe.strengthBand][lang]}`
                      : ""}
                </Text>
              </View>
              {recipe.codexFamily ? (
                <View
                  className="px-2 py-0.5 rounded-full border"
                  style={{ borderColor: colors.primary + "66", backgroundColor: colors.primary + "12" }}
                >
                  <Text className="text-xs" style={{ color: colors.primary }}>
                    {codexFamilyLabel(recipe.codexFamily, lang)}
                  </Text>
                </View>
              ) : null}
              {costTotal !== null ? (
                <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                  <Text className="text-xs text-muted">≈¥{costTotal.toFixed(1)}</Text>
                </View>
              ) : null}
              {recipe.rating ? (
                <View
                  className="flex-row items-center px-2 py-0.5 rounded-full bg-background border border-border"
                  style={{ gap: 2 }}
                >
                  <IconSymbol name="star.fill" size={11} color="#F5A623" />
                  <Text className="text-xs text-muted">{recipe.rating}/10</Text>
                </View>
              ) : null}
            </View>
            {recipe.variantOf ? (
              <Text className="text-xs text-muted mt-1.5" numberOfLines={1}>
                {t("card.variant")} · {recipe.variantOf}
              </Text>
            ) : null}
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
        {ingredientSummary ? (
          <Text className="text-sm text-muted mt-2.5" numberOfLines={1}>
            {ingredientSummary}
          </Text>
        ) : null}
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
});
