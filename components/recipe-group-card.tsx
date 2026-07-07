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
import {
  Recipe,
  STRENGTH_LABELS,
  codexFamilyLabel,
  localizedTagName,
} from "@/lib/recipes/types";
import { useRecipeStore } from "@/lib/recipes/store";

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
  const { getCategory } = useRecipeStore();

  // 单版本直接渲染普通卡片
  if (recipes.length <= 1) {
    return <SwipeableRecipeRow recipe={recipes[0]} isFirst={isFirst} isLast={isLast} />;
  }

  const head = recipes[0];
  const dn = displayNames(head.nameEn, head.name, lang);

  /** 组内全部版本共同拥有的属性(全部相同才展示) */
  const allSame = <T,>(get: (r: Recipe) => T): T | null => {
    const v = get(recipes[0]);
    return v && recipes.every((r) => get(r) === v) ? v : null;
  };
  const commonCategory = (() => {
    const cid = allSame((r) => r.categoryId);
    return cid ? getCategory(cid) : null;
  })();
  const commonBase = allSame((r) => r.baseSpirit);
  const commonFamily = allSame((r) => r.codexFamily);
  const commonStrength = allSame((r) => r.strength);

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
              <View style={{ minHeight: 40 }}>
                <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                  {dn.primary}
                </Text>
                {dn.secondary ? (
                  <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                    {dn.secondary}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row items-center mt-1.5" style={{ gap: 6, overflow: "hidden", height: 24 }}>
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.primary + "18" }}
                >
                  <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                    {t("group.versions", { n: recipes.length })}
                  </Text>
                </View>
                {commonCategory ? (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: commonCategory.color + "22" }}
                  >
                    <Text className="text-xs font-medium" style={{ color: commonCategory.color }}>
                      {localizedTagName(commonCategory.name, commonCategory.nameEn, lang)}
                    </Text>
                  </View>
                ) : null}
                {commonBase ? (
                  <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                    <Text className="text-xs text-muted">
                      {localizedTagName(commonBase, "", lang)}
                    </Text>
                  </View>
                ) : null}
                {commonFamily ? (
                  <View
                    className="px-2 py-0.5 rounded-full border"
                    style={{ borderColor: colors.primary + "66", backgroundColor: colors.primary + "12" }}
                  >
                    <Text className="text-xs" style={{ color: colors.primary }}>
                      {codexFamilyLabel(commonFamily, lang)}
                    </Text>
                  </View>
                ) : null}
                {commonStrength ? (
                  <View className="px-2 py-0.5 rounded-full bg-background border border-border">
                    <Text className="text-xs text-muted">
                      {lang === "en" ? t(`strength.${commonStrength}`) : STRENGTH_LABELS[commonStrength]}
                    </Text>
                  </View>
                ) : null}
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
