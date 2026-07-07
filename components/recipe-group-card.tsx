import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { RecipeCard } from "@/components/recipe-card";
import { SwipeableRecipeRow } from "@/components/swipeable-recipe-row";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { Recipe } from "@/lib/recipes/types";

/**
 * 同名配方折叠组:同一鸡尾酒的多个版本折叠为一个组头,
 * 点击展开查看各版本;组头提供"对比"入口跳转对比分析页。
 */
export function RecipeGroupCard({
  recipes,
  isFirst = true,
  isLast = true,
}: {
  recipes: Recipe[];
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const colors = useColors();
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);

  // 单版本直接渲染普通卡片
  if (recipes.length <= 1) {
    return <SwipeableRecipeRow recipe={recipes[0]} isFirst={isFirst} isLast={isLast} />;
  }

  const head = recipes[0];
  const dn = displayNames(head.nameEn, head.name, lang);

  const toggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded((v) => !v);
  };

  const goCompare = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: "/compare",
      params: { type: "recipe", ids: recipes.map((r) => r.id).join(",") },
    });
  };

  return (
    <View>
      {/* 组头 */}
      <Pressable onPress={toggle} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <View
          className="bg-surface px-4 py-3"
          style={[
            isFirst && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            isLast && !expanded && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
          ]}
        >
          <View className="flex-row items-center">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                {dn.primary}
                {dn.secondary ? (
                  <Text className="text-sm font-normal text-muted">  {dn.secondary}</Text>
                ) : null}
              </Text>
              <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.primary + "18" }}
                >
                  <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                    {t("group.versions", { n: recipes.length })}
                  </Text>
                </View>
                <Pressable
                  onPress={goCompare}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.compareBtn,
                    { borderColor: colors.primary + "66", backgroundColor: colors.primary + "10" },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <IconSymbol name="rectangle.split.2x1" size={12} color={colors.primary} />
                  <Text style={[styles.compareBtnText, { color: colors.primary }]}>
                    {t("group.compare")}
                  </Text>
                </Pressable>
              </View>
            </View>
            <IconSymbol
              name={expanded ? "chevron.up" : "chevron.down"}
              size={18}
              color={colors.muted}
            />
          </View>
        </View>
      </Pressable>

      {/* 展开的版本列表(缩进条纹标识) */}
      {expanded ? (
        <View
          style={[
            styles.expandWrap,
            { borderLeftColor: colors.primary + "55" },
            isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: "hidden" },
          ]}
        >
          {recipes.map((r, i) => (
            <SwipeableRecipeRow
              key={r.id}
              recipe={r}
              isFirst={false}
              isLast={i === recipes.length - 1 && isLast}
            />
          ))}
        </View>
      ) : null}

      {/* 分隔线(未展开且非组尾) */}
      {!isLast ? (
        <View className="bg-surface">
          <View className="bg-border" style={{ height: StyleSheet.hairlineWidth, marginLeft: 16 }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  compareBtnText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  expandWrap: {
    borderLeftWidth: 3,
  },
});
