import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useBottleStore } from "@/lib/bottles/store";
import { estimatePrepCost } from "@/lib/homemade/cost";
import { prepTypeLabel } from "@/lib/homemade/types";

export default function HomemadeDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPrep, deletePrep } = useHomemadeStore();
  const { bottles } = useBottleStore();
  const prep = getPrep(id);

  if (!prep) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted">{t("hm.notFound")}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>{t("common.back")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const handleDelete = () => {
    const doDelete = () => {
      deletePrep(prep.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    };
    if (Platform.OS === "web") {
      if (window.confirm(t("tags.delete.confirm", { name: prep.name }))) doDelete();
    } else {
      Alert.alert(t("hm.delete.title"), t("tags.delete.confirm", { name: prep.name }), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const infoRows: { label: string; value: string }[] = [
    { label: t("hmform.type"), value: prepTypeLabel(prep.type, lang) },
    ...(prep.yield ? [{ label: t("hm.yield"), value: prep.yield }] : []),
    ...(prep.shelfLife ? [{ label: t("hm.shelfLife"), value: prep.shelfLife }] : []),
    ...(prep.storage ? [{ label: t("hm.storage"), value: prep.storage }] : []),
  ];

  const names = displayNames(prep.name, prep.nameAlt, lang);
  const cost = estimatePrepCost(prep, bottles);

  const sectionTitle = (label: string) => (
    <Text
      className="text-[13px] text-muted uppercase mt-6 mb-2 px-4"
      style={{ letterSpacing: 0.4, lineHeight: 18 }}
    >
      {label}
    </Text>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-1 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.foreground} />
        </Pressable>
        <View className="flex-1" />
        <Pressable
          onPress={() => router.push({ pathname: "/homemade-form", params: { id: prep.id } })}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }, { marginRight: 18 }]}
        >
          <IconSymbol name="pencil" size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="trash.fill" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text className="text-3xl font-bold text-foreground" style={{ lineHeight: 40 }}>
          {names.primary}
        </Text>
        {names.secondary ? (
          <Text className="text-base text-muted mt-1">{names.secondary}</Text>
        ) : null}

        {sectionTitle(t("bottle.info"))}
        <View className="bg-surface rounded-xl px-4">
          {infoRows.map((row, idx) => (
            <View
              key={row.label}
              className="flex-row items-center justify-between py-2.5"
              style={
                idx < infoRows.length - 1
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                  : undefined
              }
            >
              <Text className="text-[15px] text-foreground">{row.label}</Text>
              <Text className="text-[15px] text-muted" style={{ maxWidth: "65%" }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {prep.ingredients.length > 0 ? (
          <>
            {sectionTitle(t("hmform.ingredients"))}
            <View className="bg-surface rounded-xl px-4">
              {prep.ingredients.map((ing, idx) => (
                <View
                  key={`${ing}-${idx}`}
                  className="py-2.5"
                  style={
                    idx < prep.ingredients.length - 1
                      ? {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        }
                      : undefined
                  }
                >
                  <Text className="text-[15px] text-foreground" style={{ lineHeight: 21 }}>
                    {ing}
                  </Text>
                  {cost.items[idx]?.cost !== null && cost.items[idx]?.cost !== undefined ? (
                    <Text className="text-xs text-muted mt-0.5" style={{ lineHeight: 16 }}>
                      ≈ ¥{cost.items[idx].cost!.toFixed(1)}
                      {cost.items[idx].ref ? ` · ${cost.items[idx].ref}` : ""}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Cost estimate card */}
        {cost.estimatedCount > 0 ? (
          <>
            {sectionTitle(t("hm.cost.title"))}
            <View className="bg-surface rounded-xl px-4 py-3">
              <View className="flex-row items-center justify-between py-1">
                <Text className="text-[15px] text-foreground">{t("hm.cost.batch")}</Text>
                <Text className="text-[15px] font-semibold text-foreground">
                  ≈ ¥{cost.batchCost.toFixed(1)}
                </Text>
              </View>
              {cost.costPer100Ml !== null ? (
                <View
                  className="flex-row items-center justify-between py-1"
                  style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
                >
                  <Text className="text-[15px] text-foreground">{t("hm.cost.per100")}</Text>
                  <Text className="text-[15px] text-muted">¥{cost.costPer100Ml.toFixed(2)}</Text>
                </View>
              ) : null}
              {cost.costPer30Ml !== null ? (
                <View
                  className="flex-row items-center justify-between py-1"
                  style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
                >
                  <Text className="text-[15px] text-foreground">{t("hm.cost.per30")}</Text>
                  <Text className="text-[15px] text-muted">¥{cost.costPer30Ml.toFixed(2)}</Text>
                </View>
              ) : null}
              <Text className="text-xs text-muted mt-2" style={{ lineHeight: 17 }}>
                {cost.yieldMl === null
                  ? t("hm.cost.noYield")
                  : t("hm.cost.note", { n: `${cost.estimatedCount}/${cost.totalCount}` })}
              </Text>
            </View>
          </>
        ) : null}

        {prep.recipe ? (
          <>
            {sectionTitle(t("hm.recipe"))}
            <View className="bg-surface rounded-xl px-4 py-3">
              <Text className="text-[15px] text-foreground" style={{ lineHeight: 23 }}>
                {prep.recipe}
              </Text>
            </View>
          </>
        ) : null}

        {prep.notes ? (
          <>
            {sectionTitle(t("hmform.notes"))}
            <View className="bg-surface rounded-xl px-4 py-3">
              <Text className="text-[15px] text-foreground" style={{ lineHeight: 22 }}>
                {prep.notes}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
