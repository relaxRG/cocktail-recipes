import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRecipeStore } from "@/lib/recipes/store";
import { STRENGTH_LABELS } from "@/lib/recipes/types";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getRecipe, getCategory, toggleFavorite, deleteRecipe } = useRecipeStore();
  const recipe = getRecipe(id);

  if (!recipe) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted">配方不存在或已被删除</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text className="text-base mt-3" style={{ color: colors.primary }}>
            返回
          </Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const category = getCategory(recipe.categoryId);

  const handleFavorite = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleFavorite(recipe.id);
  };

  const confirmDelete = () => {
    const doDelete = () => {
      deleteRecipe(recipe.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(`确定删除「${recipe.name}」吗?`)) {
        doDelete();
      }
      return;
    }
    Alert.alert("删除配方", `确定删除「${recipe.name}」吗?此操作无法撤销。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: doDelete },
    ]);
  };

  const metaItems = [
    { label: "基酒", value: recipe.baseSpirit },
    { label: "杯型", value: recipe.glass || "—" },
    { label: "方法", value: recipe.method || "—" },
    { label: "烈度", value: STRENGTH_LABELS[recipe.strength] },
  ];

  return (
    <ScreenContainer>
      {/* Header bar */}
      <View className="flex-row items-center justify-between px-4 py-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.foreground} />
        </Pressable>
        <View className="flex-row items-center" style={{ gap: 18 }}>
          <Pressable
            onPress={handleFavorite}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <IconSymbol
              name={recipe.favorite ? "star.fill" : "star"}
              size={24}
              color={recipe.favorite ? colors.primary : colors.muted}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/recipe-form", params: { id: recipe.id } })}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="pencil" size={23} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="trash.fill" size={22} color={colors.error} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 + insets.bottom }}>
        <Text className="text-3xl font-bold text-foreground mt-2">{recipe.name}</Text>
        {(category || recipe.codexFamily || recipe.flavors.length > 0) ? (
          <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
            {category ? (
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: category.color + "22" }}>
                <Text className="text-xs font-medium" style={{ color: category.color }}>
                  {category.name}
                </Text>
              </View>
            ) : null}
            {recipe.codexFamily ? (
              <View
                className="px-2.5 py-1 rounded-full border"
                style={{ borderColor: colors.primary, backgroundColor: colors.primary + "15" }}
              >
                <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                  {recipe.codexFamily}
                </Text>
              </View>
            ) : null}
            {recipe.flavors.map((tag) => (
              <View
                key={tag}
                className="px-2.5 py-1 rounded-full bg-surface border border-border"
              >
                <Text className="text-xs text-muted">{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {recipe.variantOf ? (
          <Text className="text-sm text-muted mt-2">
            变体来源:{recipe.variantOf}
          </Text>
        ) : null}

        {/* Meta grid */}
        <View className="flex-row mt-5 bg-surface border border-border rounded-2xl overflow-hidden">
          {metaItems.map((m, idx) => (
            <View
              key={m.label}
              className="flex-1 items-center py-3"
              style={idx > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border } : undefined}
            >
              <Text className="text-xs text-muted">{m.label}</Text>
              <Text className="text-sm font-medium text-foreground mt-1" numberOfLines={1}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Ingredients */}
        <Text className="text-lg font-semibold text-foreground mt-6 mb-2">配料</Text>
        <View className="bg-surface border border-border rounded-2xl px-4">
          {recipe.ingredients.length === 0 ? (
            <Text className="text-sm text-muted py-4">未填写配料</Text>
          ) : (
            recipe.ingredients.map((ing, idx) => (
              <View
                key={ing.id}
                className="flex-row items-center justify-between py-3"
                style={
                  idx > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                    : undefined
                }
              >
                <Text className="text-base text-foreground flex-1 pr-3">{ing.name}</Text>
                <Text className="text-base text-muted">{ing.amount}</Text>
              </View>
            ))
          )}
        </View>

        {/* Steps */}
        {recipe.steps ? (
          <>
            <Text className="text-lg font-semibold text-foreground mt-6 mb-2">做法</Text>
            <View className="bg-surface border border-border rounded-2xl p-4">
              <Text className="text-base text-foreground leading-relaxed">{recipe.steps}</Text>
            </View>
          </>
        ) : null}

        {/* Garnish */}
        {recipe.garnish ? (
          <>
            <Text className="text-lg font-semibold text-foreground mt-6 mb-2">装饰</Text>
            <View className="bg-surface border border-border rounded-2xl p-4">
              <Text className="text-base text-foreground">{recipe.garnish}</Text>
            </View>
          </>
        ) : null}

        {/* Notes */}
        {recipe.notes ? (
          <>
            <Text className="text-lg font-semibold text-foreground mt-6 mb-2">笔记</Text>
            <View
              className="rounded-2xl p-4 border"
              style={{ backgroundColor: colors.primary + "11", borderColor: colors.primary + "33" }}
            >
              <Text className="text-base text-foreground leading-relaxed">{recipe.notes}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
