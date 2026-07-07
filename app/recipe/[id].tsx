import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { estimateRecipeCost, formatAmountAsMl } from "@/lib/bottles/cost";
import { estimateHomemadeIngredientCost } from "@/lib/homemade/cost";
import {
  garnishDisplayText,
  ingredientDisplayName,
  stepsDisplayText,
} from "@/lib/recipes/ingredient-display";
import { useBottleStore } from "@/lib/bottles/store";
import { matchPrep } from "@/lib/homemade/match";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useRecipeStore } from "@/lib/recipes/store";
import {
  STRENGTH_LABELS,
  STRENGTH_BAND_LABELS,
  codexFamilyLabel,
  localizedTagName,
} from "@/lib/recipes/types";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { getRecipe, getCategory, toggleFavorite, toggleMade, setRating, deleteRecipe, tags } =
    useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps } = useHomemadeStore();
  const recipe = getRecipe(id);

  if (!recipe) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted">{t("detail.notFound")}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text className="text-base mt-3" style={{ color: colors.primary }}>
            {t("common.back")}
          </Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const category = getCategory(recipe.categoryId);
  const tagLabel = (kind: string, name: string) => {
    if (!name) return name;
    const hit = tags.find((tg) => tg.kind === kind && tg.name === name);
    return hit ? displayNames(hit.nameEn ?? "", hit.name, lang).primary : name;
  };
  const baseCostEst = estimateRecipeCost(recipe.ingredients, bottles);
  // Fallback: cost un-matched ingredients via homemade prep unit cost
  const hmCosts = baseCostEst.items.map((item) =>
    item.cost === null && item.reason === "no_bottle"
      ? estimateHomemadeIngredientCost(item.ingredient.name, item.ingredient.amount, preps, bottles)
      : null,
  );
  const costEst = {
    ...baseCostEst,
    total: baseCostEst.total + hmCosts.reduce((s, h) => s + (h?.cost ?? 0), 0),
    estimatedCount: baseCostEst.estimatedCount + hmCosts.filter((h) => h !== null).length,
  };

  const handleFavorite = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleFavorite(recipe.id);
  };

  const handleMade = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    toggleMade(recipe.id);
  };

  const confirmDelete = () => {
    const delName = displayNames(recipe.nameEn, recipe.name, lang).primary;
    const doDelete = () => {
      deleteRecipe(recipe.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    };
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(t("detail.delete.msg", { name: delName }))) {
        doDelete();
      }
      return;
    }
    Alert.alert(t("detail.delete.title"), t("detail.delete.msg", { name: delName }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: doDelete },
    ]);
  };

  const metaItems = [
    { label: t("detail.meta.spirit"), value: tagLabel("spirit", recipe.baseSpirit) },
    { label: t("detail.meta.glass"), value: tagLabel("glass", recipe.glass) || "—" },
    {
      label: t("detail.meta.method"),
      value: recipe.method ? localizedTagName(recipe.method, "", lang) : "—",
    },
    ...(recipe.ice
      ? [{ label: t("detail.meta.ice"), value: localizedTagName(recipe.ice, "", lang) }]
      : []),
    {
      label: t("detail.meta.strength"),
      value:
        recipe.abv !== null && recipe.abv !== undefined
          ? `${STRENGTH_LABELS[recipe.strength]} ≈${recipe.abv}%`
          : recipe.strengthBand
            ? `${STRENGTH_LABELS[recipe.strength]} · ${STRENGTH_BAND_LABELS[recipe.strengthBand][lang]}`
            : STRENGTH_LABELS[recipe.strength],
    },
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
            onPress={handleMade}
            hitSlop={8}
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
        {(() => {
          const dn = displayNames(recipe.nameEn, recipe.name, lang);
          return (
            <>
              <Text className="text-3xl font-bold text-foreground mt-2">{dn.primary}</Text>
              {dn.secondary ? (
                <Text className="text-base text-muted mt-1">{dn.secondary}</Text>
              ) : null}
            </>
          );
        })()}
        {(category || recipe.codexFamily || recipe.flavors.length > 0) ? (
          <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
            {category ? (
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: category.color + "22" }}>
                <Text className="text-xs font-medium" style={{ color: category.color }}>
                  {displayNames(category.nameEn ?? "", category.name, lang).primary}
                </Text>
              </View>
            ) : null}
            {recipe.codexFamily ? (
              <View
                className="px-2.5 py-1 rounded-full border"
                style={{ borderColor: colors.primary, backgroundColor: colors.primary + "15" }}
              >
                <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                  {codexFamilyLabel(recipe.codexFamily, lang)}
                </Text>
              </View>
            ) : null}
            {recipe.flavors.map((tag) => (
              <View
                key={tag}
                className="px-2.5 py-1 rounded-full bg-surface border border-border"
              >
                <Text className="text-xs text-muted">{tagLabel("flavor", tag)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {recipe.variantOf ? (
          <Text className="text-sm text-muted mt-2">
            {t("detail.variantOf", { name: recipe.variantOf })}
          </Text>
        ) : null}

        {/* Meta grid */}
        <View className="flex-row mt-5 bg-surface rounded-xl overflow-hidden">
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

        {/* Rating */}
        <View className="flex-row items-center justify-between bg-surface rounded-xl mt-3 px-4 py-3">
          <Text className="text-sm font-medium text-foreground">
            {t("rating.title")}
            {recipe.rating ? ` ${recipe.rating}/10` : ""}
          </Text>
          <StarRating
            value={recipe.rating}
            size={17}
            onChange={(v) => setRating(recipe.id, v)}
          />
        </View>

        {/* Ingredients */}
        <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.ingredients")}</Text>
        <View className="bg-surface rounded-xl px-4">
          {recipe.ingredients.length === 0 ? (
            <Text className="text-sm text-muted py-4">{t("detail.noIngredients")}</Text>
          ) : (
            recipe.ingredients.map((ing, idx) => (
              (() => {
                const prep = matchPrep(ing.name, preps);
                const inner = (
                  <View
                    className="flex-row items-center justify-between py-3"
                    style={
                      idx > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                        : undefined
                    }
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-base text-foreground">
                        {ingredientDisplayName(ing.name, lang as "zh" | "en", bottles, preps)}
                      </Text>
                      {prep ? (
                        <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                          <IconSymbol name="sparkles" size={12} color={colors.primary} />
                          <Text className="text-xs" style={{ color: colors.primary }}>
                            {t("detail.homemade.link", { name: displayNames(prep.name, prep.nameAlt, lang).primary })}
                          </Text>
                          <IconSymbol name="chevron.right" size={11} color={colors.primary} />
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-base text-muted">{formatAmountAsMl(ing.amount)}</Text>
                  </View>
                );
                return prep ? (
                  <Pressable
                    key={ing.id}
                    onPress={() =>
                      router.push({ pathname: "/homemade/[id]", params: { id: prep.id } })
                    }
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    {inner}
                  </Pressable>
                ) : (
                  <View key={ing.id}>{inner}</View>
                );
              })()
            ))
          )}
        </View>

        {/* Steps */}
        {recipe.steps ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.steps")}</Text>
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-base text-foreground leading-relaxed">
                {stepsDisplayText(recipe.steps, lang as "zh" | "en")}
              </Text>
            </View>
          </>
        ) : null}

        {/* Garnish */}
        {recipe.garnish ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.garnish")}</Text>
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-base text-foreground">
                {garnishDisplayText(recipe.garnish, lang as "zh" | "en", bottles, preps)}
              </Text>
            </View>
          </>
        ) : null}

        {/* Flavor description */}
        {recipe.flavorDesc ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.flavorDesc")}</Text>
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-base text-foreground leading-relaxed">{recipe.flavorDesc}</Text>
            </View>
          </>
        ) : null}

        {/* Notes */}
        {recipe.notes ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.notes")}</Text>
            <View
              className="rounded-xl p-4"
              style={{ backgroundColor: colors.primary + "14" }}
            >
              <Text className="text-base text-foreground leading-relaxed">{recipe.notes}</Text>
            </View>
          </>
        ) : null}

        {/* Story */}
        {recipe.story ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.story")}</Text>
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-base text-foreground leading-relaxed">{recipe.story}</Text>
            </View>
          </>
        ) : null}

        {/* Source */}
        {recipe.source ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.source")}</Text>
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-sm text-muted leading-relaxed">{recipe.source}</Text>
            </View>
          </>
        ) : null}

        {/* Cost estimate — kept last per information hierarchy */}
        {recipe.ingredients.length > 0 ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={styles.groupHeader}>{t("detail.cost")}</Text>
            <View className="bg-surface rounded-xl px-4 pb-1">
              <View
                className="flex-row items-center justify-between py-3.5"
                style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
              >
                <Text className="text-sm text-muted">
                  {t("detail.cost.total", { a: costEst.estimatedCount, b: costEst.totalCount })}
                </Text>
                <Text className="text-xl font-bold" style={{ color: colors.primary }}>
                  {costEst.estimatedCount > 0 ? `¥${costEst.total.toFixed(1)}` : "—"}
                </Text>
              </View>
              {costEst.items.map((item, idx) => {
                const hm = hmCosts[idx];
                return (
                <View
                  key={item.ingredient.id}
                  className="flex-row items-center justify-between py-2.5"
                  style={
                    idx > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                      : undefined
                  }
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {ingredientDisplayName(item.ingredient.name, lang as "zh" | "en", bottles, preps)}
                    </Text>
                    {item.bottle && item.cost !== null ? (
                      <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                        {displayNames(item.bottle.nameEn, item.bottle.nameZh, lang).primary} ¥{item.bottle.priceCny}/{item.bottle.volume} ×{" "}
                        {item.amountMl?.toFixed(0)}ml
                      </Text>
                    ) : hm ? (
                      <Text className="text-xs mt-0.5" numberOfLines={1} style={{ color: colors.primary }}>
                        {t("detail.cost.homemade", {
                          name: displayNames(hm.prep.name, hm.prep.nameAlt, lang).primary,
                          p: hm.costPer30Ml.toFixed(1),
                        })}
                      </Text>
                    ) : (
                      <Text className="text-xs text-muted mt-0.5">
                        {item.reason === "no_bottle"
                          ? t("detail.cost.noBottle")
                          : item.reason === "no_amount"
                            ? t("detail.cost.noAmount")
                            : item.reason === "no_price"
                              ? t("detail.cost.noPrice")
                              : t("detail.cost.noVolume")}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: item.cost !== null || hm ? colors.foreground : colors.muted }}
                  >
                    {item.cost !== null
                      ? `¥${item.cost.toFixed(1)}`
                      : hm
                        ? `¥${hm.cost.toFixed(1)}`
                        : "—"}
                  </Text>
                </View>
                );
              })}
              <Text className="text-[11px] text-muted py-2.5" style={{ lineHeight: 15 }}>
                {t("detail.cost.note")}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    letterSpacing: 0.4,
    lineHeight: 18,
  },
});
