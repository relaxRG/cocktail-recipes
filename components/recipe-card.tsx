import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRecipeStore } from "@/lib/recipes/store";
import { Recipe, STRENGTH_LABELS } from "@/lib/recipes/types";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const colors = useColors();
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
      <View className="bg-surface rounded-2xl p-4 border border-border">
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
                <Text className="text-xs text-muted">{STRENGTH_LABELS[recipe.strength]}</Text>
              </View>
            </View>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 12,
  },
});
