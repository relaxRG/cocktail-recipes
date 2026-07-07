import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useRecipeStore } from "@/lib/recipes/store";
import { Recipe, STRENGTH_LABELS } from "@/lib/recipes/types";

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
  const { toggleFavorite, getCategory } = useRecipeStore();
  const category = getCategory(recipe.categoryId);

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
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {recipe.name}
            </Text>
            <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 6 }}>
              {category ? (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: category.color + "22" }}
                >
                  <Text className="text-xs font-medium" style={{ color: category.color }}>
                    {category.name}
                  </Text>
                </View>
              ) : null}
              <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                <Text className="text-xs text-muted">{recipe.baseSpirit}</Text>
              </View>
              <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                <Text className="text-xs text-muted">
                  {lang === "en" ? t(`strength.${recipe.strength}`) : STRENGTH_LABELS[recipe.strength]}
                </Text>
              </View>
              {recipe.codexFamily ? (
                <View
                  className="px-2 py-0.5 rounded-full border"
                  style={{ borderColor: colors.primary + "66", backgroundColor: colors.primary + "12" }}
                >
                  <Text className="text-xs" style={{ color: colors.primary }}>
                    {recipe.codexFamily.split(" ")[0]}
                  </Text>
                </View>
              ) : null}
            </View>
            {recipe.variantOf ? (
              <Text className="text-xs text-muted mt-1.5" numberOfLines={1}>
                {t("card.variant")} · {recipe.variantOf}
              </Text>
            ) : null}
          </View>
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
